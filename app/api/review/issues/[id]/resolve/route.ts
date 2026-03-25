import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";

// POST /api/review/issues/[id]/resolve
// Body: { action: "accept" | "correct" | "unresolvable", corrections?: Record<string, unknown> }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  requirePermission(auth.role, "review_rules");

  let body: {
    action?: string;
    corrections?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, corrections } = body;
  if (!action || !["accept", "correct", "unresolvable"].includes(action)) {
    return NextResponse.json(
      { error: "action must be one of: accept, correct, unresolvable" },
      { status: 400 }
    );
  }

  if (action === "correct" && (!corrections || Object.keys(corrections).length === 0)) {
    return NextResponse.json(
      { error: "corrections are required when action is 'correct'" },
      { status: 400 }
    );
  }

  try {
    const result = await withOrgContext(auth, async () => {
      // Fetch the issue with its block and import job
      const issue = await prisma.parseIssue.findUnique({
        where: { id },
        include: {
          importBlock: {
            include: {
              importJob: { select: { id: true, upstream: true } },
            },
          },
        },
      });

      if (!issue) throw new Error("NOT_FOUND");
      if (issue.resolvedAt) throw new Error("ALREADY_RESOLVED");

      const upstream = issue.importBlock.importJob.upstream;

      // Always mark the issue as resolved
      const now = new Date();
      await prisma.parseIssue.update({
        where: { id },
        data: { resolvedAt: now, resolvedById: auth.userId },
      });

      // Action: unresolvable — just mark resolved, no rule created
      if (action === "unresolvable") {
        return {
          resolved: true,
          action,
          ruleCreated: false,
          issueId: id,
        };
      }

      // For accept/correct: need to create a rule
      if (!upstream) {
        throw new Error("NO_UPSTREAM");
      }

      // Find or create a draft RuleVersion for this upstream
      let ruleVersion = await prisma.ruleVersion.findFirst({
        where: { upstream, status: "draft" },
        orderBy: { createdAt: "desc" },
      });

      if (!ruleVersion) {
        // The db.ts org-extension injects organizationId automatically
        ruleVersion = await prisma.ruleVersion.create({
          data: {
            upstream,
            status: "draft",
          } as Parameters<typeof prisma.ruleVersion.create>[0]["data"],
        });
      }

      // Start with aiExtraction
      const ai = (issue.aiExtraction || {}) as Record<string, unknown>;
      const fields = action === "correct" && corrections
        ? { ...ai, ...corrections }
        : ai;

      const ruleData: Record<string, unknown> = {
        ruleVersionId: ruleVersion.id,
        category: (fields.category as string) || "surcharge",
        source: action === "accept" ? "ai" : "manual",
        confidence: "high",
        rawEvidence: issue.rawSegment,
      };

      if (fields.type !== undefined) ruleData.type = fields.type;
      if (fields.itemType !== undefined) ruleData.itemType = fields.itemType;
      if (fields.chargeType !== undefined) ruleData.chargeType = fields.chargeType;
      if (fields.chargeValue !== undefined && fields.chargeValue !== null) {
        ruleData.chargeValue = String(fields.chargeValue);
      }
      if (fields.condition !== undefined) ruleData.condition = fields.condition;
      if (fields.description !== undefined) ruleData.description = fields.description;
      if (fields.content !== undefined) ruleData.content = fields.content;
      if (fields.priority !== undefined) ruleData.priority = fields.priority;

      // Create the rule
      const rule = await prisma.rule.create({
        data: ruleData as Parameters<typeof prisma.rule.create>[0]["data"],
      });

      // Update the ImportBlock: set confidence=100, needs_review=false
      await prisma.importBlock.update({
        where: { id: issue.importBlockId },
        data: { confidence: 100, needsReview: false },
      });

      return {
        resolved: true,
        action,
        ruleCreated: true,
        ruleId: rule.id,
        issueId: id,
        importBlockId: issue.importBlockId,
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[POST /api/review/issues/[id]/resolve]", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }
    if (msg === "ALREADY_RESOLVED") {
      return NextResponse.json({ error: "Issue already resolved" }, { status: 409 });
    }
    if (msg === "NO_UPSTREAM") {
      return NextResponse.json({ error: "ImportJob has no upstream" }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
