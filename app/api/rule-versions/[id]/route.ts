import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";

// GET /api/rule-versions/[id] — get a single rule version with rule count
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
      const version = await prisma.ruleVersion.findUnique({
        where: { id },
        include: {
          publishedBy: { select: { id: true, name: true, email: true } },
          _count: { select: { rules: true, quoteVersions: true } },
        },
      });

      if (!version) return null;

      return {
        id: version.id,
        upstream: version.upstream,
        version: version.version,
        status: version.status,
        publishedBy: version.publishedBy ? { id: version.publishedBy.id, name: version.publishedBy.name, email: version.publishedBy.email } : null,
        publishedAt: version.publishedAt ? version.publishedAt.toISOString() : null,
        createdAt: version.createdAt ? version.createdAt.toISOString() : null,
        ruleCount: version._count.rules,
        quoteVersionCount: version._count.quoteVersions,
      };
    });

    if (!result) {
      return NextResponse.json({ error: "RuleVersion not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/rule-versions/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/rule-versions/[id] — update a draft rule version's basic info
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
      const existing = await prisma.ruleVersion.findUnique({ where: { id } });
      if (!existing) throw new Error("NOT_FOUND");
      if (existing.status !== "draft") {
        throw new Error("Only draft versions can be edited");
      }

      // Only allow updating upstream on draft versions
      const { upstream } = body;
      const version = await prisma.ruleVersion.update({
        where: { id },
        data: {
          ...(upstream !== undefined && { upstream: upstream as string }),
        },
        include: {
          publishedBy: { select: { id: true, name: true, email: true } },
          _count: { select: { rules: true, quoteVersions: true } },
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
        quoteVersionCount: version._count.quoteVersions,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[PUT /api/rule-versions/[id]]", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ error: "RuleVersion not found" }, { status: 404 });
    }
    if (msg === "Only draft versions can be edited") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
