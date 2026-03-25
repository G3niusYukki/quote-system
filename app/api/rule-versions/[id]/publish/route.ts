import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";

// POST /api/rule-versions/[id]/publish
// Publish a draft rule version: sets status=published, publishedAt, publishedBy
// Fails if version has no rules, or if version is not draft
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  requirePermission(auth.role, "publish_versions");

  try {
    const result = await withOrgContext(auth, async () => {
      const version = await prisma.ruleVersion.findUnique({
        where: { id },
        include: { _count: { select: { rules: true } } },
      });

      if (!version) throw new Error("NOT_FOUND");
      if (version.status !== "draft") throw new Error("NOT_DRAFT");
      if (version._count.rules === 0) throw new Error("EMPTY_VERSION");

      // Archive any previously published version for the same upstream
      await prisma.ruleVersion.updateMany({
        where: { upstream: version.upstream, status: "published" },
        data: { status: "archived" },
      });

      // Publish this version
      const updated = await prisma.ruleVersion.update({
        where: { id },
        data: {
          status: "published",
          publishedAt: new Date(),
          publishedById: auth.userId,
        },
        include: {
          publishedBy: { select: { id: true, name: true, email: true } },
          _count: { select: { rules: true, quoteVersions: true } },
        },
      });

      return {
        id: updated.id,
        upstream: updated.upstream,
        version: updated.version,
        status: updated.status,
        publishedBy: updated.publishedBy ? { id: updated.publishedBy.id, name: updated.publishedBy.name, email: updated.publishedBy.email } : null,
        publishedAt: updated.publishedAt ? updated.publishedAt.toISOString() : null,
        createdAt: updated.createdAt ? updated.createdAt.toISOString() : null,
        ruleCount: updated._count.rules,
        quoteVersionCount: updated._count.quoteVersions,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/rule-versions/[id]/publish]", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "RuleVersion not found" }, { status: 404 });
    if (msg === "NOT_DRAFT") return NextResponse.json({ error: "Only draft versions can be published" }, { status: 400 });
    if (msg === "EMPTY_VERSION") return NextResponse.json({ error: "Cannot publish an empty version (no rules)" }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
