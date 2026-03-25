import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";
import { withErrorHandler, BadRequestError, UnauthorizedError } from "@/lib/error";

// GET /api/rule-versions — list all rule versions for the org
// Query params: upstream, status, page, pageSize
export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = getRequestAuth(req);
  if (!auth) throw new UnauthorizedError("Unauthorized");

  const { searchParams } = new URL(req.url);
  const upstream = searchParams.get("upstream");
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

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
});

// POST /api/rule-versions — create a new rule version (always draft)
export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = getRequestAuth(req);
  if (!auth) throw new UnauthorizedError("Unauthorized");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    throw new BadRequestError("Invalid JSON body");
  }

  const { upstream } = body;
  if (!upstream || typeof upstream !== "string") {
    throw new BadRequestError("upstream is required");
  }

  const result = await withOrgContext(auth, async () => {
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
});
