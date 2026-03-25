import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";

// GET /api/rules — list rules with optional filters
// Query params: version_id, category, type, source, page, pageSize, upstream
export async function GET(req: NextRequest) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const versionId = searchParams.get("version_id");
  const category = searchParams.get("category");
  const type = searchParams.get("type");
  const source = searchParams.get("source");
  const upstream = searchParams.get("upstream");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50", 10)));

  try {
    const result = await withOrgContext(auth, async () => {
      const where: Record<string, unknown> = {};
      if (versionId) where.ruleVersionId = versionId;
      if (category) where.category = category;
      if (type) where.type = type;
      if (source) where.source = source;

      // If upstream is provided, first find matching RuleVersion IDs
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let versionIds: string[] | undefined;
      if (upstream) {
        const versions = await prisma.ruleVersion.findMany({
          where: { upstream },
          select: { id: true },
        });
        versionIds = versions.map((v) => v.id);
        if (versionIds.length === 0) {
          return {
            rules: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
          };
        }
      }

      // Apply upstream filter via versionIds
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
            ruleVersion: {
              select: { id: true, upstream: true, version: true, status: true },
            },
          },
        }),
        prisma.rule.count({ where }),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (items as any[]).map((r) => ({
        id: r.id,
        ruleVersionId: r.ruleVersionId,
        upstream: r.ruleVersion?.upstream ?? upstream ?? "",
        version: r.ruleVersion?.version ?? 0,
        versionStatus: r.ruleVersion?.status ?? "draft",
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
        createdAt: r.createdAt ? r.createdAt.toISOString() : null,
        updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
      }));

      return {
        rules: mapped,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/rules]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/rules — create a new rule
export async function POST(req: NextRequest) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { ruleVersionId, category, type, itemType, chargeType, chargeValue, condition, description, content, priority, confidence, source, rawEvidence } = body;

  if (!ruleVersionId || !category) {
    return NextResponse.json(
      { error: "ruleVersionId and category are required" },
      { status: 400 }
    );
  }

  const VALID_CATEGORIES = ["surcharge", "restriction", "compensation", "billing"];
  if (!VALID_CATEGORIES.includes(category as string)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const result = await withOrgContext(auth, async () => {
      // Verify the rule version exists
      const existing = await prisma.ruleVersion.findUnique({ where: { id: ruleVersionId as string } });
      if (!existing) {
        throw new Error("RuleVersion not found");
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[POST /api/rules]", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg === "RuleVersion not found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
