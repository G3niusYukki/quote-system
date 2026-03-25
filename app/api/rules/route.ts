import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { withErrorHandler, BadRequestError, NotFoundError, UnauthorizedError } from "@/lib/error";

// GET /api/rules — list rules with optional filters
// Query params: version_id, category, type, source, page, pageSize, upstream
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = getRequestAuth(req);
  if (!auth) throw new UnauthorizedError("Unauthorized");
  requirePermission(auth.role, "review_rules");

  const { searchParams } = new URL(req.url);
  const versionId = searchParams.get("version_id");
  const category = searchParams.get("category");
  const type = searchParams.get("type");
  const source = searchParams.get("source");
  const upstream = searchParams.get("upstream");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10)));

  const result = await withOrgContext(auth, async () => {
    const where: Record<string, unknown> = {};
    if (versionId) where.ruleVersionId = versionId;
    if (category) where.category = category;
    if (type) where.type = type;
    if (source) where.source = source;

    let versionIds: string[] | undefined;
    if (upstream) {
      const versions = await prisma.ruleVersion.findMany({
        where: { upstream },
        select: { id: true },
      });
      versionIds = versions.map((v) => v.id);
      if (versionIds.length === 0) {
        return { rules: [], total: 0, page, pageSize, totalPages: 0 };
      }
    }

    if (versionIds) {
      where.ruleVersionId = { in: versionIds };
    }

    const [items, total] = await Promise.all([
      prisma.rule.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          ruleVersion: { select: { id: true, upstream: true, version: true, status: true } },
        },
      }),
      prisma.rule.count({ where }),
    ]);

    const mapped = (items as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: r.id,
      ruleVersionId: r.ruleVersionId,
      upstream: (r.ruleVersion as Record<string, unknown>)?.upstream ?? upstream ?? "",
      version: (r.ruleVersion as Record<string, unknown>)?.version ?? 0,
      versionStatus: (r.ruleVersion as Record<string, unknown>)?.status ?? "draft",
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
    }));

    return { rules: mapped, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  });

  return NextResponse.json(result);
});

// POST /api/rules — create a new rule
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = getRequestAuth(req);
  if (!auth) throw new UnauthorizedError("Unauthorized");
  requirePermission(auth.role, "review_rules");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    throw new BadRequestError("Invalid JSON body");
  }

  const { ruleVersionId, category, type, itemType, chargeType, chargeValue, condition, description, content, priority, confidence, source, rawEvidence } = body;

  if (!ruleVersionId || !category) {
    throw new BadRequestError("ruleVersionId and category are required");
  }

  const VALID_CATEGORIES = ["surcharge", "restriction", "compensation", "billing"];
  if (!VALID_CATEGORIES.includes(category as string)) {
    throw new BadRequestError(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`);
  }

  const result = await withOrgContext(auth, async () => {
    const existing = await prisma.ruleVersion.findUnique({ where: { id: ruleVersionId as string } });
    if (!existing) throw new NotFoundError("RuleVersion not found");

    const rule = await prisma.rule.create({
      data: {
        ruleVersionId: ruleVersionId as string,
        category: category as string,
        type: type as string | undefined,
        itemType: itemType as object | undefined,
        chargeType: chargeType as string | undefined,
        chargeValue: chargeValue !== undefined && chargeValue !== null ? String(chargeValue) : undefined,
        condition: condition as string | undefined,
        description: description as string | undefined,
        content: content as string | undefined,
        priority: typeof priority === "number" ? priority : 0,
        confidence: (confidence as string) || "medium",
        source: (source as string) || "manual",
        rawEvidence: rawEvidence as string | undefined,
      } as Parameters<typeof prisma.rule.create>[0]["data"],
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

  return NextResponse.json(result, { status: 201 });
});
