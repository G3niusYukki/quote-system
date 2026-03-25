import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";

// POST /api/rules/bulk-import — create rules from resolved ImportBlocks
// Body: { importBlockIds: string[] }
export async function POST(req: NextRequest) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { importBlockIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { importBlockIds } = body;
  if (!importBlockIds || !Array.isArray(importBlockIds) || importBlockIds.length === 0) {
    return NextResponse.json(
      { error: "importBlockIds must be a non-empty array of strings" },
      { status: 400 }
    );
  }

  try {
    const result = await withOrgContext(auth, async () => {
      // Fetch all blocks with their importJob upstream info
      const blocks = await prisma.importBlock.findMany({
        where: { id: { in: importBlockIds } },
        include: {
          importJob: { select: { id: true, upstream: true } },
          parseIssues: {
            where: { resolvedAt: { not: null } },
            orderBy: { resolvedAt: "desc" },
            take: 1,
          },
        },
      });

      if (blocks.length === 0) {
        return { created: 0, skipped: 0, errors: ["No blocks found"] };
      }

      const errors: string[] = [];
      let created = 0;
      let skipped = 0;

      for (const block of blocks) {
        const upstream = block.importJob.upstream;
        if (!upstream) {
          errors.push(`Block ${block.id}: no upstream found`);
          skipped++;
          continue;
        }

        // Find or create a draft RuleVersion for this upstream
        let ruleVersion = await prisma.ruleVersion.findFirst({
          where: { upstream, status: "draft" },
          orderBy: { createdAt: "desc" },
        });

        if (!ruleVersion) {
          // The db.ts org-extension will inject organizationId automatically
          ruleVersion = await prisma.ruleVersion.create({
            data: {
              upstream,
              status: "draft",
            } as Parameters<typeof prisma.ruleVersion.create>[0]["data"],
          });
        }

        // Get the most recent resolved parseIssue for this block
        const resolvedIssue = block.parseIssues[0];
        if (!resolvedIssue) {
          errors.push(`Block ${block.id}: no resolved issue found`);
          skipped++;
          continue;
        }

        // Extract fields from aiExtraction JSON
        const ai = resolvedIssue.aiExtraction as Record<string, unknown>;
        if (!ai || typeof ai !== "object") {
          errors.push(`Block ${block.id}: invalid aiExtraction`);
          skipped++;
          continue;
        }

        // Map aiExtraction fields to Rule fields
        const ruleData: Record<string, unknown> = {
          ruleVersionId: ruleVersion.id,
          category: (ai.category as string) || "surcharge",
          source: "ai",
          confidence: "high",
          rawEvidence: block.rawText,
        };

        if (ai.type !== undefined) ruleData.type = ai.type;
        if (ai.itemType !== undefined) ruleData.itemType = ai.itemType;
        if (ai.chargeType !== undefined) ruleData.chargeType = ai.chargeType;
        if (ai.chargeValue !== undefined && ai.chargeValue !== null) {
          ruleData.chargeValue = String(ai.chargeValue);
        }
        if (ai.condition !== undefined) ruleData.condition = ai.condition;
        if (ai.description !== undefined) ruleData.description = ai.description;
        if (ai.content !== undefined) ruleData.content = ai.content;
        if (ai.priority !== undefined) ruleData.priority = ai.priority;

        try {
          await prisma.rule.create({
            data: ruleData as Parameters<typeof prisma.rule.create>[0]["data"],
          });
          created++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Block ${block.id}: ${msg}`);
          skipped++;
        }
      }

      return { created, skipped, errors: errors.slice(0, 20) };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[POST /api/rules/bulk-import]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
