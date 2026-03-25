import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";

// GET /api/quote-versions — list all quote versions
// Query params: upstream, status, rule_version_id, page, pageSize
export async function GET(req: NextRequest) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const upstream = searchParams.get("upstream");
  const status = searchParams.get("status");
  const ruleVersionId = searchParams.get("rule_version_id");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

  try {
    const result = await withOrgContext(auth, async () => {
      const where: Record<string, unknown> = {};
      if (upstream) where.upstream = upstream;
      if (status) where.status = status;
      if (ruleVersionId) where.ruleVersionId = ruleVersionId;

      const [items, total] = await Promise.all([
        prisma.quoteVersion.findMany({
          where,
          orderBy: [{ upstream: "asc" }, { version: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            publishedBy: { select: { id: true, name: true, email: true } },
            ruleVersion: { select: { id: true, version: true, upstream: true } },
            _count: { select: { quotes: true } },
          },
        }),
        prisma.quoteVersion.count({ where }),
      ]);

      const mapped = items.map((v) => ({
        id: v.id,
        upstream: v.upstream,
        version: v.version,
        status: v.status,
        ruleVersionId: v.ruleVersionId,
        ruleVersion: v.ruleVersion ? { id: v.ruleVersion.id, version: v.ruleVersion.version, upstream: v.ruleVersion.upstream } : null,
        publishedBy: v.publishedBy ? { id: v.publishedBy.id, name: v.publishedBy.name, email: v.publishedBy.email } : null,
        publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
        createdAt: v.createdAt ? v.createdAt.toISOString() : null,
        quoteCount: v._count.quotes,
      }));

      return {
        versions: mapped,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/quote-versions]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/quote-versions — create a new quote version (always draft)
// Requires rule_version_id; optional upstream (defaults from rule version)
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

  const { rule_version_id, upstream } = body;
  if (!rule_version_id || typeof rule_version_id !== "string") {
    return NextResponse.json({ error: "rule_version_id is required" }, { status: 400 });
  }

  try {
    const result = await withOrgContext(auth, async () => {
      const ruleVersion = await prisma.ruleVersion.findUnique({
        where: { id: rule_version_id as string },
      });
      if (!ruleVersion) throw new Error("RULE_VERSION_NOT_FOUND");

      const effectiveUpstream = (upstream as string) ?? ruleVersion.upstream;

      // Find max version for this upstream
      const maxVersion = await prisma.quoteVersion.findFirst({
        where: { upstream: effectiveUpstream },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const nextVersion = (maxVersion?.version ?? 0) + 1;

      const quoteVersion = await prisma.quoteVersion.create({
        data: {
          organizationId: auth.organizationId,
          ruleVersionId: rule_version_id as string,
          upstream: effectiveUpstream,
          version: nextVersion,
          status: "draft",
        },
        include: {
          publishedBy: { select: { id: true, name: true, email: true } },
          ruleVersion: { select: { id: true, version: true, upstream: true } },
          _count: { select: { quotes: true } },
        },
      });

      return {
        id: quoteVersion.id,
        upstream: quoteVersion.upstream,
        version: quoteVersion.version,
        status: quoteVersion.status,
        ruleVersionId: quoteVersion.ruleVersionId,
        ruleVersion: quoteVersion.ruleVersion ? { id: quoteVersion.ruleVersion.id, version: quoteVersion.ruleVersion.version, upstream: quoteVersion.ruleVersion.upstream } : null,
        publishedBy: null,
        publishedAt: null,
        createdAt: quoteVersion.createdAt ? quoteVersion.createdAt.toISOString() : null,
        quoteCount: quoteVersion._count.quotes,
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[POST /api/quote-versions]", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg === "RULE_VERSION_NOT_FOUND") {
      return NextResponse.json({ error: "RuleVersion not found" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
