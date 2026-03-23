import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { chat } from "./dashscope";
import type { RuleRecord } from "@/types";

const CONFIG_PATH = path.join(process.cwd(), "data", "config.json");

function getApiKey(): string | null {
  const envKey = process.env.DASHSCOPE_API_KEY;
  if (envKey) return envKey;
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      const config = JSON.parse(raw);
      const key = config.dashscopeApiKey || null;
      console.log("[rule-extractor] config check:", CONFIG_PATH, "hasKey:", !!key);
      return key;
    } else {
      console.log("[rule-extractor] config not found:", CONFIG_PATH, "cwd:", process.cwd());
    }
  } catch (e) {
    console.log("[rule-extractor] config read error:", e);
  }
  return null;
}

function getBaseUrl(): string | null {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      return config.baseUrl || null;
    }
  } catch {}
  return null;
}

function excelToText(buffer: Buffer): string {
  const wb = XLSX.read(buffer, { type: "buffer", cellNF: true });
  const lines: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    lines.push(`\n=== Sheet: ${name} ===`);
    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    for (let R = range.s.r; R <= range.e.r; R++) {
      const row: string[] = [];
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (cell && cell.v !== undefined && cell.v !== null) {
          row.push(String(cell.v).trim());
        }
      }
      if (row.length > 0) lines.push(`R${R + 1}: ${row.join(" | ")}`);
    }
  }
  return lines.join("\n");
}

interface AIExtractResult {
  surcharges: Array<{
    category: string; item_type?: string; charge_type?: string; charge_value?: number;
    condition: string; description: string; raw_text: string;
  }>;
  restrictions: Array<{ type: string; content: string; raw_text: string }>;
  compensationRules: Array<{
    scenario: string; standard: string; rate_per_kg?: number;
    max_compensation?: number; notes?: string; raw_text: string;
  }>;
  billingRules: Array<{ rule_type: string; rule_key: string; rule_value: string; raw_text: string }>;
}

function buildPrompt(excelText: string): string {
  return `你是一个物流报价单条款提取专家。以下是一份国际快递报价Excel的内容（已转为文本格式）：
---
${excelText}
---

请从中提取所有条款规则，输出JSON。不要提取定价数据，只提取规则（附加费、拒收限制、赔偿条款、计费规则）。

特别重要：请同时提取【全局附加费规则】——即不区分货物类型、对所有货物都适用的附加费，例如：
- 超重附加费（实重超过XX KG）→ category="超重"
- 超尺寸附加费（单边超长、第二边超长、围长超限）→ category="超尺寸"
- 材重超限附加费（体积重超过XX KG）→ category="材重超限"
- 偏远附加费 → category="偏远"

输出格式：
{
  "surcharges": [
    {
      "category": "超尺寸|超重|材重超限|偏远|品类|私人地址|拦截",
      "item_type": "具体品名（仅品类规则填），全局规则一律填null",
      "charge_type": "per_kg|per_item|fixed|null",
      "charge_value": 数字,
      "condition": "触发条件，例如：最长边>120CM 或 实重>22.5KG且≤49KG 或 围长>263CM且≤330CM",
      "description": "规则名称",
      "raw_text": "原始条款文本"
    }
  ],
  "restrictions": [
    {
      "type": "品类限制|尺寸限制|服务范围",
      "content": "限制内容",
      "raw_text": "原始条款文本"
    }
  ],
  "compensationRules": [
    {
      "scenario": "赔偿场景",
      "standard": "赔偿标准文字",
      "rate_per_kg": 数字或null,
      "max_compensation": 数字或null,
      "notes": "备注",
      "raw_text": "原始条款文本"
    }
  ],
  "billingRules": [
    {
      "rule_type": "规则类型",
      "rule_key": "键名",
      "rule_value": "值",
      "raw_text": "原始条款文本"
    }
  ]
}

请只输出JSON，不要有其他文字。`;
}

function parseAIResponse(text: string): AIExtractResult {
  // Strip markdown code fences first
  const stripped = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/im, "")
    .replace(/\s*```$/im, "");
  const trimmed = stripped.trim();

  // Try full JSON first
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    const slice = trimmed.slice(jsonStart, jsonEnd + 1);
    // Try parsing as-is
    try { return JSON.parse(slice); } catch { /* fall through */ }

    // Try auto-close: count unclosed brackets and append closing ] or }
    const closeBracket = (s: string): string => {
      let objDepth = 0; // unclosed {
      let arrDepth = 0;  // unclosed [
      let inStr = false;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === "\\" && i + 1 < s.length) { i++; continue; }
        if (c === '"' && (i === 0 || s[i - 1] !== "\\")) { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === "{") objDepth++;
        else if (c === "[") arrDepth++;
        else if (c === "]") arrDepth = Math.max(0, arrDepth - 1);
        else if (c === "}") objDepth = Math.max(0, objDepth - 1);
      }
      return s + "]".repeat(arrDepth) + "}".repeat(objDepth);
    };

    const closed = closeBracket(slice);
    try { return JSON.parse(closed); } catch { /* fall through */ }
  }

  // Fallback: extract each section independently
  const result: AIExtractResult = { surcharges: [], restrictions: [], compensationRules: [], billingRules: [] };

  // Find array content by bracket counting (safe for nested objects AND strings containing brackets)
  const findArrayContent = (key: string): string | null => {
    const keyPos = trimmed.indexOf(`"${key}"`);
    if (keyPos === -1) return null;
    const bracketPos = trimmed.indexOf("[", keyPos);
    if (bracketPos === -1) return null;
    let depth = 0;
    let inString = false;
    for (let i = bracketPos; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (inString) {
        if (ch === "\\" && i + 1 < trimmed.length) { i++; continue; }
        if (ch === "\"") { inString = false; continue; }
      } else {
        if (ch === "\"") { inString = true; continue; }
        if (ch === "[") depth++;
        else if (ch === "]") { depth--; if (depth === 0) return trimmed.slice(bracketPos + 1, i); }
      }
    }
    return null;
  };

  const extractArray = (key: string): any[] => {
    const content = findArrayContent(key);
    if (!content) return [];
    try { return JSON.parse(`[${content}]`); } catch {
      const objMatches = [...content.matchAll(/\{[\s\S]*?\}/g)];
      const valid: any[] = [];
      for (const obj of objMatches) {
        try { valid.push(JSON.parse(obj[0])); } catch { /* skip bad object */ }
      }
      return valid;
    }
  };

  result.surcharges = extractArray("surcharges");
  result.restrictions = extractArray("restrictions");
  result.compensationRules = extractArray("compensationRules");
  result.billingRules = extractArray("billingRules");

  if (result.surcharges.length === 0 && result.restrictions.length === 0 &&
      result.compensationRules.length === 0 && result.billingRules.length === 0) {
    throw new Error("无法从AI响应中提取任何规则");
  }

  return result;
}

export async function extractRulesFromExcel(
  buffer: Buffer,
  upstream: string
): Promise<{ rules: Omit<RuleRecord, "id" | "created_at" | "updated_at">[]; aiWarning?: string }> {
  const excelText = excelToText(buffer);
  const prompt = buildPrompt(excelText);

  let rawResponse = "";
  try {
    const apiKey = getApiKey();
    if (!apiKey) return { rules: [], aiWarning: "AI规则提取失败: 请先在设置页配置百炼 API Key" };
    const baseUrl = getBaseUrl();
    rawResponse = await chat({ apiKey, prompt, baseUrl: baseUrl || undefined });
  } catch (e) {
    return { rules: [], aiWarning: `AI规则提取失败: ${e}` };
  }

  let parsed: AIExtractResult;
  try {
    parsed = parseAIResponse(rawResponse);
  } catch (e) {
    return { rules: [], aiWarning: `AI规则解析失败: ${e}` };
  }

  const rules: Omit<RuleRecord, "id" | "created_at" | "updated_at">[] = [];

  for (const s of parsed.surcharges ?? []) {
    rules.push({
      upstream, category: "surcharge", source: "ai",
      type: s.category ?? "", item_type: s.item_type ?? null,
      charge_type: (s.charge_type as any) ?? null, charge_value: s.charge_value ?? null,
      condition: s.condition ?? "", description: s.description ?? "",
      content: "", standard: null, rate_per_kg: null, max_compensation: null, notes: null,
      rule_type: null, rule_key: null, rule_value: null, raw_text: s.raw_text ?? "",
    });
  }

  for (const r of parsed.restrictions ?? []) {
    rules.push({
      upstream, category: "restriction", source: "ai",
      type: r.type ?? "", item_type: null, charge_type: null, charge_value: null,
      condition: "", description: r.type ?? "", content: r.content ?? "",
      standard: null, rate_per_kg: null, max_compensation: null, notes: null,
      rule_type: null, rule_key: null, rule_value: null, raw_text: r.raw_text ?? "",
    });
  }

  for (const c of parsed.compensationRules ?? []) {
    rules.push({
      upstream, category: "compensation", source: "ai",
      type: c.scenario ?? "", item_type: null, charge_type: null, charge_value: null,
      condition: "", description: c.scenario ?? "",
      content: c.standard ?? "", standard: c.standard ?? null,
      rate_per_kg: c.rate_per_kg ?? null, max_compensation: c.max_compensation ?? null,
      notes: c.notes ?? null,
      rule_type: null, rule_key: null, rule_value: null, raw_text: c.raw_text ?? "",
    });
  }

  for (const b of parsed.billingRules ?? []) {
    rules.push({
      upstream, category: "billing", source: "ai",
      type: b.rule_type ?? "", item_type: null, charge_type: null, charge_value: null,
      condition: "", description: b.rule_type ?? "",
      content: "",
      standard: null, rate_per_kg: null, max_compensation: null, notes: null,
      rule_type: b.rule_type ?? null, rule_key: b.rule_key ?? null,
      rule_value: b.rule_value ?? null, raw_text: b.raw_text ?? "",
    });
  }

  return { rules };
}

export { excelToText };
