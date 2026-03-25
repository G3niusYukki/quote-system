import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";

// GET /api/rule-versions — list all rule versions for the org
// Query params: upstream, status, page, pageSize
export async function GET(req: NextRequest) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const upstream = searchParams.get("upstream");
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

  try {
    const result = await withOrgContext(auth, async () => {
      const where: Record<string, unknown> = {};
      if (upstream) where.upstream = upstream;
      if (status) where.status = status;

      const [items, total] = await Promise.all([
        prisma.ruleVersion.findMany({
          where,
          orderBy: [{ upstream: "asc" }, { version: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            publishedBy: { select: { id: true, name: true, email: true } },
            _count: { select: { rules: true } },
          },
        }),
        prisma.ruleVersion.count({ where }),
      ]);

      const mapped = items.map((v) => ({
        id: v.id,
        upstream: v.upstream,
        version: v.version,
        status: v.status,
        publishedBy: v.publishedBy ? { id: v.publishedBy.id, name: v.publishedBy.name, email: v.publishedBy.email } : null,
        publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
        createdAt: v.createdAt ? v.createdAt.toISOString() : null,
        ruleCount: v._count.rules,
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
    console.error("[GET /api/rule-versions]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/rule-versions — create a new rule version (always draft)
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

  const { upstream } = body;
  if (!upstream || typeof upstream !== "string") {
    return NextResponse.json({ error: "upstream is required" }, { status: 400 });
  }

  try {
    const result = await withOrgContext(auth, async () => {
      // Find the max version number for this upstream
      const maxVersion = await prisma.ruleVersion.findFirst({
        where: { upstream: upstream as string },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const nextVersion = (maxVersion?.version ?? 0) + 1;

      const version = await prisma.ruleVersion.create({
        data: {
          organizationId: auth.organizationId,
          upstream: upstream as string,
          version: nextVersion,
          status: "draft",
        },
        include: {
          publishedBy: { select: { id: true, name: true, email: true } },
          _count: { select: { rules: true } },
        },
      });

      return {
        id: version.id,
        upstream: version.upstream,
        version: version.version,
        status: version.status,
        publishedBy: version.publishedBy ? { id: version.publishedBy.id, name: version.publishedBy.name, email: version.publishedBy.email } : null,
        publishedAt: version.publishedAt ? version.publishedAt.toISOString() : null,
        createdAt: version.createdAt ? version.createdAt.toISOString() : null,
        ruleCount: version._count.rules,
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[POST /api/rule-versions]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
