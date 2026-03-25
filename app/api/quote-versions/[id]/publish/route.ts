import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";

// POST /api/quote-versions/[id]/publish
// Publish a draft quote version: status=published, publishedAt, publishedBy
// No empty-check required for quote versions (quotes may be added later)
export async function POST(
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
      const version = await prisma.quoteVersion.findUnique({ where: { id } });
      if (!version) throw new Error("NOT_FOUND");
      if (version.status !== "draft") throw new Error("NOT_DRAFT");

      // Archive any previously published version for the same upstream
      await prisma.quoteVersion.updateMany({
        where: { upstream: version.upstream, status: "published" },
        data: { status: "archived" },
      });

      const updated = await prisma.quoteVersion.update({
        where: { id },
        data: {
          status: "published",
          publishedAt: new Date(),
          publishedById: auth.userId,
        },
        include: {
          publishedBy: { select: { id: true, name: true, email: true } },
          ruleVersion: { select: { id: true, version: true, upstream: true, status: true } },
          _count: { select: { quotes: true, surcharges: true, billingRules: true, restrictions: true } },
        },
      });

      return {
        id: updated.id,
        upstream: updated.upstream,
        version: updated.version,
        status: updated.status,
        ruleVersionId: updated.ruleVersionId,
        ruleVersion: updated.ruleVersion ? { id: updated.ruleVersion.id, version: updated.ruleVersion.version, upstream: updated.ruleVersion.upstream, status: updated.ruleVersion.status } : null,
        publishedBy: updated.publishedBy ? { id: updated.publishedBy.id, name: updated.publishedBy.name, email: updated.publishedBy.email } : null,
        publishedAt: updated.publishedAt ? updated.publishedAt.toISOString() : null,
        createdAt: updated.createdAt ? updated.createdAt.toISOString() : null,
        quoteCount: updated._count.quotes,
        surchargeCount: updated._count.surcharges,
        billingRuleCount: updated._count.billingRules,
        restrictionCount: updated._count.restrictions,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/quote-versions/[id]/publish]", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "QuoteVersion not found" }, { status: 404 });
    if (msg === "NOT_DRAFT") return NextResponse.json({ error: "Only draft quote versions can be published" }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
