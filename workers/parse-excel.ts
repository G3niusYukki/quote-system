/**
 * BullMQ Worker — Excel parsing and block extraction.
 *
 * Run as a standalone Node.js process:
 *   npx tsx workers/parse-excel.ts
 *
 * Note: We use a raw PrismaClient here because the worker runs as an independent
 * Node.js process without HTTP request context. Organization ID is passed
 * explicitly via BullMQ job data (job.data.organizationId) rather than
 * inferred from AsyncLocalStorage.
 */

import { Job } from "bullmq";
import * as XLSX from "xlsx";
import { readFile, stat } from "fs/promises";
import { createHash } from "crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { createParseExcelWorker } from "../lib/queue";
import { createDashScopeProvider } from "../lib/ai/dashscope";
import type { AIResult } from "../lib/ai/provider";
import path from "path";

// ─── Worker-scoped Prisma (no org-isolation extension) ───────────────────────
const workerPrisma = new PrismaClient();

// ─── Job payload shape ────────────────────────────────────────────────────────
interface ParseExcelJobData {
  jobId: string;
  organizationId: string;
  upstream: string;
}

type ParseExcelJob = Job<ParseExcelJobData>;

// ─── Constants ────────────────────────────────────────────────────────────────
// Upload directory: env var for Docker (/data/uploads), default to local ./data/uploads
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "data", "uploads");
const API_TIMEOUT_MS = 120_000; // 2 min
const CONFIDENCE = {
  HIGH_THRESHOLD: 80,
  MEDIUM_THRESHOLD: 50,
} as const;

// Non-retryable error codes (direct fail, no BullMQ retry)
const NON_RETRYABLE_CODES = new Set(["CORRUPT_FILE", "MD5_MISMATCH", "PARSE_ASSERTION"]);

// ─── Helper: classify block type from sheet name or content ──────────────────
function classifyBlockType(sheetName: string, headerRow: string[]): AIResult["type"] {
  const text = [sheetName, ...headerRow].join(" ").toLowerCase();
  if (/附加|费|surcharge|偏远|超尺寸|超重|拦截/i.test(text)) return "surcharge";
  if (/限制|禁收|品类|尺寸|不接受|拒收/i.test(text)) return "restriction";
  if (/备注|notes|条款|赔偿/i.test(text)) return "notes";
  if (/条款|clause|协议|contract/i.test(text)) return "clause";
  return "pricing";
}

// ─── Step 1: Read Excel and create import blocks ──────────────────────────────
interface SheetBlock {
  sheetName: string;
  blockType: AIResult["type"];
  rowRange: string; // e.g. "5-20"
  rawText: string;
}

async function parseExcelIntoBlocks(jobId: string, filePath: string): Promise<SheetBlock[]> {
  const buffer = await readFile(filePath);

  // Verify MD5 matches what was stored at upload time
  const storedJob = await workerPrisma.importJob.findUnique({ where: { id: jobId } });
  if (!storedJob) throw Object.assign(new Error("Import job not found in DB"), { code: "CORRUPT_FILE" });

  const actualMd5 = createHash("md5").update(buffer).digest("hex");
  if (actualMd5 !== storedJob.checksum) {
    throw Object.assign(new Error("File MD5 checksum mismatch"), { code: "MD5_MISMATCH" });
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellNF: true });
  } catch {
    throw Object.assign(new Error("Failed to parse Excel file — malformed or corrupted"), { code: "CORRUPT_FILE" });
  }

  if (!workbook.SheetNames.length) {
    throw Object.assign(new Error("Excel file contains no sheets"), { code: "CORRUPT_FILE" });
  }

  const blocks: SheetBlock[] = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;

    // Convert to array of row arrays (skip fully empty rows)
    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    const rows: string[][] = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row: string[] = [];
      let hasContent = false;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const v = ws[addr]?.v;
        const cell = v !== undefined && v !== null ? String(v).trim() : "";
        row.push(cell);
        if (cell) hasContent = true;
      }
      if (hasContent) rows.push(row);
    }

    if (rows.length < 2) continue; // Need at least header + 1 data row

    // Detect header row (row with most string cells)
    let headerRowIdx = 0;
    let maxStringCells = 0;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const stringCount = rows[i].filter((c) => c.length > 0 && isNaN(Number(c))).length;
      if (stringCount > maxStringCells) {
        maxStringCells = stringCount;
        headerRowIdx = i;
      }
    }

    // Classify block type from sheet name + header
    const blockType = classifyBlockType(sheetName, rows[headerRowIdx]);

    // Slice data rows (everything below header)
    const dataRows = rows.slice(headerRowIdx + 1);

    // If there are many rows, split into sub-blocks of ~20 rows each
    const CHUNK_SIZE = 20;
    for (let i = 0; i < dataRows.length; i += CHUNK_SIZE) {
      const chunk = dataRows.slice(i, i + CHUNK_SIZE);
      const startRow = range.s.r + headerRowIdx + 1 + i;
      const endRow = startRow + chunk.length - 1;
      const rawText = [rows[headerRowIdx].join("\t"), ...chunk.map((r) => r.join("\t"))].join("\n");

      blocks.push({
        sheetName,
        blockType,
        rowRange: `${startRow + 1}-${endRow + 1}`, // 1-indexed for display
        rawText,
      });
    }
  }

  return blocks;
}

// ─── Step 2: Normalize using mapping dictionary ───────────────────────────────
interface NormalizationResult {
  normalizedText: string;
  appliedMappings: string[];
}

async function normalizeText(
  orgId: string,
  rawText: string
): Promise<NormalizationResult> {
  const dictionaries = await workerPrisma.mappingDictionary.findMany({
    where: { organizationId: orgId },
  });

  if (!dictionaries.length) return { normalizedText: rawText, appliedMappings: [] };

  const byCategory = new Map<string, { normalizedValue: string; aliases: string[] }[]>();
  for (const d of dictionaries) {
    const aliases = (d.aliases as string[]) ?? [];
    const entry = { normalizedValue: d.normalizedValue, aliases };
    const list = byCategory.get(d.category) ?? [];
    list.push(entry);
    byCategory.set(d.category, list);
  }

  let normalized = rawText;
  const applied: string[] = [];

  for (const [, entries] of byCategory) {
    for (const { normalizedValue, aliases } of entries) {
      for (const alias of aliases) {
        if (alias && normalized.includes(alias)) {
          normalized = normalized.replace(new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), normalizedValue);
          applied.push(`${alias}→${normalizedValue}`);
        }
      }
    }
  }

  return { normalizedText: normalized, appliedMappings: applied };
}

// ─── Step 3: Get previous version rules for version consistency check ──────────
async function getPreviousPublishedRules(orgId: string, upstream: string) {
  const prevVersion = await workerPrisma.ruleVersion.findFirst({
    where: { organizationId: orgId, upstream, status: "published" },
    orderBy: { publishedAt: "desc" },
    include: {
      rules: { select: { id: true, category: true, chargeValue: true, condition: true } },
    },
  });
  return prevVersion ?? null;
}

// ─── Step 4: Confidence scoring ───────────────────────────────────────────────
interface ConfidenceBreakdown {
  headerClarity: number;   // 0-25
  dataCompleteness: number; // 0-25
  conditionClarity: number; // 0-25
  valueReasonableness: number; // 0-25
  versionConsistency: number;  // 0-25
  total: number; // 0-100
}

function scoreConfidence(
  aiResult: AIResult,
  prevRules: Awaited<ReturnType<typeof getPreviousPublishedRules>> | null
): ConfidenceBreakdown {
  const data = aiResult.data;
  // Handle both { items: [...] } wrapper and raw [...]
  const rawItems = Array.isArray(data) ? data : (data as Record<string, unknown>).items;
  const isArray = Array.isArray(rawItems);
  const firstItem = isArray ? rawItems[0] : data;

  // Header clarity: block has enough fields populated
  let headerClarity = 25;
  if (firstItem && typeof firstItem === "object") {
    const keys = Object.keys(firstItem as Record<string, unknown>).filter(
      (k) => (firstItem as Record<string, unknown>)[k] !== null &&
             (firstItem as Record<string, unknown>)[k] !== undefined &&
             (firstItem as Record<string, unknown>)[k] !== ""
    ).length;
    headerClarity = Math.min(25, keys * 5);
  }

  // Data completeness: key fields present
  let dataCompleteness = 25;
  if (firstItem && typeof firstItem === "object") {
    const obj = firstItem as Record<string, unknown>;
    const criticalFields = aiResult.type === "pricing"
      ? ["country", "transport_type", "cargo_type", "unit_price"]
      : ["category", "charge_type", "charge_value"];
    const missing = criticalFields.filter((f) => obj[f] === null || obj[f] === undefined || obj[f] === "");
    dataCompleteness = Math.max(0, 25 - missing.length * 7);
  }

  // Condition clarity: conditions or descriptions present
  let conditionClarity = 25;
  if (firstItem && typeof firstItem === "object") {
    const obj = firstItem as Record<string, unknown>;
    const hasCondition = !!(obj.condition || obj.content || obj.description);
    conditionClarity = hasCondition ? 25 : 10;
  }

  // Value reasonableness: prices/values are within expected ranges
  let valueReasonableness = 25;
  if (firstItem && typeof firstItem === "object") {
    const obj = firstItem as Record<string, unknown>;
    const price = typeof obj.unit_price === "number" ? obj.unit_price
      : typeof obj.charge_value === "number" ? obj.charge_value : null;
    if (price !== null) {
      if (price < 0) valueReasonableness = 0;
      else if (price > 10000) valueReasonableness = 10; // Suspiciously high for logistics
      else valueReasonableness = 25;
    }
  }

  // Version consistency: compare against previous published rules
  let versionConsistency = 25;
  if (prevRules && prevRules.rules.length > 0 && firstItem && typeof firstItem === "object") {
    const obj = firstItem as Record<string, unknown>;
    const currentPrice = typeof obj.unit_price === "number" ? obj.unit_price
      : typeof obj.charge_value === "number" ? obj.charge_value : null;

    if (currentPrice !== null) {
      const prevRulesSameCategory = prevRules.rules.filter(
        (r) => r.category === obj.category || r.category === obj.type
      );
      if (prevRulesSameCategory.length > 0) {
        const prevPrice = prevRulesSameCategory[0].chargeValue
          ? Number(prevRulesSameCategory[0].chargeValue)
          : null;
        if (prevPrice !== null && prevPrice > 0) {
          const change = Math.abs(currentPrice - prevPrice) / prevPrice;
          if (change > 0.5) versionConsistency = 5; // >50% price change
          else if (change > 0.2) versionConsistency = 15; // >20% change
        }
      }
    }
  }

  const total = headerClarity + dataCompleteness + conditionClarity + valueReasonableness + versionConsistency;
  return { headerClarity, dataCompleteness, conditionClarity, valueReasonableness, versionConsistency, total };
}

// ─── Step 6: Persist blocks, issues, and rules ───────────────────────────────
type ConfidenceLevel = "high" | "medium" | "low";

function confidenceLevel(total: number): ConfidenceLevel {
  if (total >= CONFIDENCE.HIGH_THRESHOLD) return "high";
  if (total >= CONFIDENCE.MEDIUM_THRESHOLD) return "medium";
  return "low";
}

function determineIssueType(
  breakdown: ConfidenceBreakdown
): { type: string; reason: string } | null {
  if (breakdown.headerClarity < 10) {
    return { type: "unclear_header", reason: "表头不清晰，无法识别关键字段" };
  }
  if (breakdown.dataCompleteness < 10) {
    return { type: "missing_field", reason: "缺少关键字段数据" };
  }
  if (breakdown.versionConsistency < 10) {
    return { type: "conflict", reason: "与上一版本规则存在重大差异（价格变化超过50%）" };
  }
  if (breakdown.conditionClarity < 10) {
    return { type: "ambiguous_condition", reason: "条件描述不明确" };
  }
  return null;
}

async function persistBlock(
  jobId: string,
  orgId: string,
  block: SheetBlock,
  normalized: NormalizationResult,
  aiResult: AIResult,
  breakdown: ConfidenceBreakdown
): Promise<void> {
  const level = confidenceLevel(breakdown.total);
  const needsReview = level !== "high";
  const issueInfo = determineIssueType(breakdown);

  // Create ImportBlock
  const importBlock = await workerPrisma.importBlock.create({
    data: {
      importJobId: jobId,
      blockType: block.blockType,
      sheetName: block.sheetName,
      rowRange: block.rowRange,
      rawText: block.rawText,
      normalizedText: normalized.normalizedText,
      confidence: breakdown.total,
      needsReview,
    },
  });

  // For high-confidence pricing/surcharge blocks, create Rule records
  if (level === "high" && (block.blockType === "pricing" || block.blockType === "surcharge")) {
    // Get or create a draft RuleVersion for this import
    let ruleVersion = await workerPrisma.ruleVersion.findFirst({
      where: { organizationId: orgId, status: "draft" },
    });
    if (!ruleVersion) {
      ruleVersion = await workerPrisma.ruleVersion.create({
        data: { organizationId: orgId, upstream: block.sheetName, status: "draft" },
      });
    }

    const rawItems: unknown = Array.isArray(aiResult.data)
      ? aiResult.data
      : (aiResult.data as Record<string, unknown>).items ?? aiResult.data;
    const items: unknown[] = Array.isArray(rawItems) ? rawItems : [rawItems];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;

      const ruleData: Prisma.RuleCreateInput = {
        organization: { connect: { id: orgId } },
        ruleVersion: { connect: { id: ruleVersion.id } },
        category: block.blockType === "pricing" ? "quote" : "surcharge",
        type: (obj.category as string | undefined) ?? (obj.type as string | undefined) ?? undefined,
        itemType: obj.item_type != null ? [String(obj.item_type)] as unknown as Prisma.InputJsonValue : undefined,
        chargeType: (obj.charge_type as string | undefined) ?? undefined,
        chargeValue: (obj.unit_price ?? obj.charge_value ?? null) as Prisma.Decimal | null,
        condition: (obj.condition as string | undefined) ?? (obj.content as string | undefined) ?? undefined,
        description: (obj.description as string | undefined) ?? undefined,
        rawEvidence: block.rawText.slice(0, 500),
      };

      await workerPrisma.rule.create({ data: ruleData });
    }
  }

  // For medium/low confidence, create ParseIssue records
  if (needsReview && issueInfo) {
    await workerPrisma.parseIssue.create({
      data: {
        importBlockId: importBlock.id,
        issueType: issueInfo.type,
        rawSegment: block.rawText.slice(0, 1000),
        aiExtraction: aiResult.data as unknown as Prisma.InputJsonValue,
        reason: issueInfo.reason,
        suggestedFix: breakdown.dataCompleteness < 15
          ? "请手动填写缺失字段"
          : breakdown.versionConsistency < 15
          ? "请确认价格变更是否正确"
          : "请审核并确认条款内容",
      },
    });
  }
}

// ─── Main job processor ────────────────────────────────────────────────────────
async function processParseExcelJob(job: ParseExcelJob): Promise<void> {
  const { jobId, organizationId, upstream } = job.data;
  console.log(`[parse-excel] Starting job ${jobId} for org ${organizationId}`);

  // Update job status to processing
  await workerPrisma.importJob.update({
    where: { id: jobId },
    data: { status: "processing" },
  });

  const filePath = `${UPLOADS_DIR}/${jobId}.xlsx`;

  // Verify file exists
  try {
    await stat(filePath);
  } catch {
    throw Object.assign(new Error(`File not found: ${filePath}`), { code: "CORRUPT_FILE" });
  }

  // Idempotency: if blocks already exist (e.g. this is a retry after partial failure),
  // delete them first to avoid duplicate blocks. This keeps retry logic clean for V1.
  const existingBlocks = await workerPrisma.importBlock.findMany({
    where: { importJobId: jobId },
    select: { id: true },
  });
  if (existingBlocks.length > 0) {
    console.log(`[parse-excel] Job ${jobId}: ${existingBlocks.length} existing blocks found, deleting before retry`);
    await workerPrisma.importBlock.deleteMany({ where: { importJobId: jobId } });
  }

  // Step 1: Parse Excel into blocks
  const blocks = await parseExcelIntoBlocks(jobId, filePath);
  console.log(`[parse-excel] Job ${jobId}: ${blocks.length} blocks extracted`);

  // Step 2: Get previous published rules for version consistency
  const prevRules = await getPreviousPublishedRules(organizationId, upstream);

  // Step 3: Initialize AI provider (shared across all blocks)
  const aiProvider = createDashScopeProvider();

  // Process each block sequentially to avoid overwhelming the AI API
  const totalBlocks = blocks.length;
  for (let i = 0; i < totalBlocks; i++) {
    const block = blocks[i];

    // Report progress to BullMQ
    await job.updateProgress(Math.floor(((i + 1) / totalBlocks) * 100));

    try {
      // Step 3: Normalize
      const normalized = await normalizeText(organizationId, block.rawText);

      // Step 4: AI extraction (with timeout handled inside the provider)
      const aiResult = await aiProvider.extract(block.blockType, normalized.normalizedText);

      // Step 4: Confidence scoring
      const breakdown = scoreConfidence(aiResult, prevRules);

      // Step 5: Persist
      await persistBlock(jobId, organizationId, block, normalized, aiResult, breakdown);

      console.log(
        `[parse-excel] Block ${i + 1}/${totalBlocks} (${block.blockType}) confidence=${breakdown.total} needsReview=${breakdown.total < CONFIDENCE.HIGH_THRESHOLD}`
      );
    } catch (err) {
      const error = err as Error & { code?: string };
      const isRetryable =
        error.name === "AbortError" || // timeout
        error.message?.includes("429") ||
        error.message?.includes("500") ||
        error.message?.includes("503") ||
        error.message?.includes("Redis") ||
        error.message?.includes("timeout");

      if (!isRetryable && error.code && NON_RETRYABLE_CODES.has(error.code)) {
        // Non-retryable — fail immediately
        await workerPrisma.importJob.update({
          where: { id: jobId },
          data: { status: "failed", errorMessage: error.message },
        });
        console.error(`[parse-excel] Job ${jobId} failed permanently: ${error.message}`);
        return;
      }

      console.error(`[parse-excel] Block ${i + 1} failed (will retry if attempts remain): ${error.message}`);
      throw error; // Let BullMQ handle retry
    }
  }

  // Mark job as completed
  await workerPrisma.importJob.update({
    where: { id: jobId },
    data: { status: "completed", completedAt: new Date() },
  });

  console.log(`[parse-excel] Job ${jobId} completed successfully`);
}

// ─── Register and start worker ────────────────────────────────────────────────
const worker = createParseExcelWorker(async (job) => {
  return processParseExcelJob(job as ParseExcelJob);
});

worker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} completed`);
});

worker.on("failed", async (job, err) => {
  if (!job) return;
  const attempts = job.attemptsMade ?? 0;
  const maxAttempts = job.opts.attempts ?? 3;

  console.error(`[worker] Job ${job.id} failed (attempt ${attempts}/${maxAttempts}): ${err.message}`);

  // After all retries exhausted, mark as failed in DB
  if (attempts >= maxAttempts) {
    await workerPrisma.importJob.update({
      where: { id: job.data.jobId },
      data: { status: "failed", errorMessage: err.message },
    }).catch((e) => console.error("[worker] Failed to update job status:", e));
  }
});

worker.on("error", (err) => {
  console.error("[worker] Unexpected worker error:", err);
});

// Graceful shutdown
async function shutdown() {
  console.log("[worker] Shutting down...");
  await worker.close();
  await workerPrisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("[worker] parse-excel worker started");
