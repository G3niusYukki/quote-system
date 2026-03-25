import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";

// GET /api/quote-versions/[id] — get a single quote version
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
      const version = await prisma.quoteVersion.findUnique({
        where: { id },
        include: {
          publishedBy: { select: { id: true, name: true, email: true } },
          ruleVersion: { select: { id: true, version: true, upstream: true, status: true } },
          _count: { select: { quotes: true, surcharges: true, billingRules: true, restrictions: true } },
        },
      });

      if (!version) return null;

      return {
        id: version.id,
        upstream: version.upstream,
        version: version.version,
        status: version.status,
        ruleVersionId: version.ruleVersionId,
        ruleVersion: version.ruleVersion ? { id: version.ruleVersion.id, version: version.ruleVersion.version, upstream: version.ruleVersion.upstream, status: version.ruleVersion.status } : null,
        publishedBy: version.publishedBy ? { id: version.publishedBy.id, name: version.publishedBy.name, email: version.publishedBy.email } : null,
        publishedAt: version.publishedAt ? version.publishedAt.toISOString() : null,
        createdAt: version.createdAt ? version.createdAt.toISOString() : null,
        quoteCount: version._count.quotes,
        surchargeCount: version._count.surcharges,
        billingRuleCount: version._count.billingRules,
        restrictionCount: version._count.restrictions,
      };
    });

    if (!result) {
      return NextResponse.json({ error: "QuoteVersion not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/quote-versions/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/quote-versions/[id] — update a draft quote version's basic info
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

  try {
    const result = await withOrgContext(auth, async () => {
      const existing = await prisma.quoteVersion.findUnique({ where: { id } });
      if (!existing) throw new Error("NOT_FOUND");
      if (existing.status !== "draft") throw new Error("NOT_DRAFT");

      const { upstream, rule_version_id } = body;
      const version = await prisma.quoteVersion.update({
        where: { id },
        data: {
          ...(upstream !== undefined && { upstream: upstream as string }),
          ...(rule_version_id !== undefined && { ruleVersionId: rule_version_id as string }),
        },
        include: {
          publishedBy: { select: { id: true, name: true, email: true } },
          ruleVersion: { select: { id: true, version: true, upstream: true, status: true } },
          _count: { select: { quotes: true, surcharges: true, billingRules: true, restrictions: true } },
        },
      });

      return {
        id: version.id,
        upstream: version.upstream,
        version: version.version,
        status: version.status,
        ruleVersionId: version.ruleVersionId,
        ruleVersion: version.ruleVersion ? { id: version.ruleVersion.id, version: version.ruleVersion.version, upstream: version.ruleVersion.upstream, status: version.ruleVersion.status } : null,
        publishedBy: null,
        publishedAt: null,
        createdAt: version.createdAt ? version.createdAt.toISOString() : null,
        quoteCount: version._count.quotes,
        surchargeCount: version._count.surcharges,
        billingRuleCount: version._count.billingRules,
        restrictionCount: version._count.restrictions,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[PUT /api/quote-versions/[id]]", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "QuoteVersion not found" }, { status: 404 });
    if (msg === "NOT_DRAFT") return NextResponse.json({ error: "Only draft quote versions can be edited" }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
