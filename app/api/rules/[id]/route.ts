import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";
import { withErrorHandler, BadRequestError, NotFoundError, UnauthorizedError } from "@/lib/error";

// GET /api/rules/[id] — get single rule
export const GET = withErrorHandler(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const auth = getRequestAuth(req);
    if (!auth) throw new UnauthorizedError("Unauthorized");

    const { id } = await params;

    const rule = await withOrgContext(auth, async () => {
      const r = await prisma.rule.findUnique({
        where: { id },
        include: {
          ruleVersion: { select: { id: true, upstream: true, version: true, status: true } },
        },
      }) as unknown as Record<string, unknown> | null;

      if (!r) throw new NotFoundError("Rule not found");

      return {
        id: r.id,
        ruleVersionId: r.ruleVersionId,
        upstream: (r.ruleVersion as Record<string, unknown>)?.upstream,
        version: (r.ruleVersion as Record<string, unknown>)?.version,
        versionStatus: (r.ruleVersion as Record<string, unknown>)?.status,
        category: r.category,
        type: r.type,
        itemType: r.itemType,
        chargeType: r.chargeType,
        chargeValue: r.chargeValue ? Number(r.chargeValue) : null,
        condition: r.condition,
        description: r.description,
        content: r.content,
        priority: r.priority,
        confidence: r.confidence,
        source: r.source,
        rawEvidence: r.rawEvidence,
        createdAt: (r.createdAt as Date)?.toISOString() ?? null,
        updatedAt: (r.updatedAt as Date)?.toISOString() ?? null,
      };
    });

    return NextResponse.json(rule);
  }
);

// PUT /api/rules/[id] — update a rule
export const PUT = withErrorHandler(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const auth = getRequestAuth(req);
    if (!auth) throw new UnauthorizedError("Unauthorized");

    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw new BadRequestError("Invalid JSON body");
    }

    const { category, type, itemType, chargeType, chargeValue, condition, description, content, priority, confidence, source, rawEvidence } = body;

    if (category) {
      const VALID_CATEGORIES = ["surcharge", "restriction", "compensation", "billing"];
      if (!VALID_CATEGORIES.includes(category as string)) {
        throw new BadRequestError(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`);
      }
    }

    const result = await withOrgContext(auth, async () => {
      const existing = await prisma.rule.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("Rule not found");

      const rule = await prisma.rule.update({
        where: { id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      }) as unknown as Record<string, unknown>;

      return {
        id: rule.id,
        ruleVersionId: rule.ruleVersionId,
        upstream: (rule.ruleVersion as Record<string, unknown>)?.upstream,
        version: (rule.ruleVersion as Record<string, unknown>)?.version,
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
        createdAt: (rule.createdAt as Date)?.toISOString() ?? null,
        updatedAt: (rule.updatedAt as Date)?.toISOString() ?? null,
      };
    });

    return NextResponse.json(result);
  }
);

// DELETE /api/rules/[id] — delete a rule
export const DELETE = withErrorHandler(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const auth = getRequestAuth(req);
    if (!auth) throw new UnauthorizedError("Unauthorized");

    const { id } = await params;

    const result = await withOrgContext(auth, async () => {
      const existing = await prisma.rule.findUnique({ where: { id } });
      if (!existing) throw new NotFoundError("Rule not found");

      await prisma.rule.delete({ where: { id } });
      return { deleted: true };
    });

    return NextResponse.json(result);
  }
);
