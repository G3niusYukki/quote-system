import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";

// GET /api/rules/[id] — get single rule
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await withOrgContext(auth, async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rule = await prisma.rule.findUnique({
        where: { id },
        include: {
          ruleVersion: { select: { id: true, upstream: true, version: true, status: true } },
        },
      }) as unknown as {
        id: string; ruleVersionId: string; category: string; type: string | null; itemType: object | null;
        chargeType: string | null; chargeValue: object | null; condition: string | null;
        description: string | null; content: string | null; priority: number; confidence: string;
        source: string; rawEvidence: string | null; createdAt: Date; updatedAt: Date;
        ruleVersion: { id: string; upstream: string; version: number; status: string };
      } | null;

      if (!rule) return null;

      return {
        id: rule.id,
        ruleVersionId: rule.ruleVersionId,
        upstream: rule.ruleVersion.upstream,
        version: rule.ruleVersion.version,
        versionStatus: rule.ruleVersion.status,
        category: rule.category,
        type: rule.type,
        itemType: rule.itemType,
        chargeType: rule.chargeType,
        chargeValue: rule.chargeValue ? Number(rule.chargeValue) : null,
        condition: rule.condition,
        description: rule.description,
        content: rule.content,
        priority: rule.priority,
        confidence: rule.confidence,
        source: rule.source,
        rawEvidence: rule.rawEvidence,
        createdAt: rule.createdAt ? rule.createdAt.toISOString() : null,
        updatedAt: rule.updatedAt ? rule.updatedAt.toISOString() : null,
      };
    });

    if (!result) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/rules/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/rules/[id] — update a rule
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { category, type, itemType, chargeType, chargeValue, condition, description, content, priority, confidence, source, rawEvidence } = body;

  if (category) {
    const VALID_CATEGORIES = ["surcharge", "restriction", "compensation", "billing"];
    if (!VALID_CATEGORIES.includes(category as string)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }
  }

  try {
    const result = await withOrgContext(auth, async () => {
      const existing = await prisma.rule.findUnique({ where: { id } });
      if (!existing) throw new Error("NOT_FOUND");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rule = await prisma.rule.update({
        where: { id },
        data: {
          ...(category !== undefined && { category: category as string }),
          ...(type !== undefined && { type: type as string | null }),
          ...(itemType !== undefined && { itemType: itemType as object | null }),
          ...(chargeType !== undefined && { chargeType: chargeType as string | null }),
          ...(chargeValue !== undefined && { chargeValue: chargeValue !== null ? String(chargeValue) : null }),
          ...(condition !== undefined && { condition: condition as string | null }),
          ...(description !== undefined && { description: description as string | null }),
          ...(content !== undefined && { content: content as string | null }),
          ...(priority !== undefined && { priority: priority as number }),
          ...(confidence !== undefined && { confidence: confidence as string }),
          ...(source !== undefined && { source: source as string }),
          ...(rawEvidence !== undefined && { rawEvidence: rawEvidence as string | null }),
        } as Parameters<typeof prisma.rule.update>[0]["data"],
        include: {
          ruleVersion: { select: { id: true, upstream: true, version: true, status: true } },
        },
      }) as unknown as {
        id: string; ruleVersionId: string; category: string; type: string | null; itemType: object | null;
        chargeType: string | null; chargeValue: object | null; condition: string | null;
        description: string | null; content: string | null; priority: number; confidence: string;
        source: string; rawEvidence: string | null; createdAt: Date; updatedAt: Date;
        ruleVersion: { id: string; upstream: string; version: number; status: string };
      };

      return {
        id: rule.id,
        ruleVersionId: rule.ruleVersionId,
        upstream: rule.ruleVersion.upstream,
        version: rule.ruleVersion.version,
        category: rule.category,
        type: rule.type,
        itemType: rule.itemType,
        chargeType: rule.chargeType,
        chargeValue: rule.chargeValue ? Number(rule.chargeValue) : null,
        condition: rule.condition,
        description: rule.description,
        content: rule.content,
        priority: rule.priority,
        confidence: rule.confidence,
        source: rule.source,
        rawEvidence: rule.rawEvidence,
        createdAt: rule.createdAt ? rule.createdAt.toISOString() : null,
        updatedAt: rule.updatedAt ? rule.updatedAt.toISOString() : null,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[PUT /api/rules/[id]]", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/rules/[id] — delete a rule
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await withOrgContext(auth, async () => {
      const existing = await prisma.rule.findUnique({ where: { id } });
      if (!existing) throw new Error("NOT_FOUND");

      await prisma.rule.delete({ where: { id } });
      return { deleted: true };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[DELETE /api/rules/[id]]", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
