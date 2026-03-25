import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";

// POST /api/quote-versions/[id]/rollback
// Finds the most recent archived version for the same upstream,
// copies all its quotes, surcharges, billingRules, and restrictions into a new draft.
// Returns 400 if no archived version exists.
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
      const current = await prisma.quoteVersion.findUnique({ where: { id } });
      if (!current) throw new Error("NOT_FOUND");

      const archivedVersion = await prisma.quoteVersion.findFirst({
        where: { upstream: current.upstream, status: "archived" },
        orderBy: { version: "desc" },
      });

      if (!archivedVersion) throw new Error("NO_ARCHIVED");

      // Load all related records from archived version
      const [quotes, surcharges, billingRules, restrictions] = await Promise.all([
        prisma.quote.findMany({ where: { quoteVersionId: archivedVersion.id } }),
        prisma.surcharge.findMany({ where: { quoteVersionId: archivedVersion.id } }),
        prisma.billingRule.findMany({ where: { quoteVersionId: archivedVersion.id } }),
        prisma.restriction.findMany({ where: { quoteVersionId: archivedVersion.id } }),
      ]);

      const maxVersion = await prisma.quoteVersion.findFirst({
        where: { upstream: current.upstream },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const nextVersion = (maxVersion?.version ?? 0) + 1;

      const newVersion = await prisma.quoteVersion.create({
        data: {
          organizationId: auth.organizationId,
          ruleVersionId: current.ruleVersionId,
          upstream: current.upstream,
          version: nextVersion,
          status: "draft",
          quotes: {
            create: quotes.map((q) => ({
              organizationId: auth.organizationId,
              country: q.country,
              transportType: q.transportType,
              cargoType: q.cargoType,
              channelName: q.channelName,
              zone: q.zone,
              postcodeMin: q.postcodeMin,
              postcodeMax: q.postcodeMax,
              weightMin: q.weightMin,
              weightMax: q.weightMax,
              unitPrice: q.unitPrice,
              timeEstimate: q.timeEstimate,
              rawText: q.rawText,
            })),
          },
          surcharges: {
            create: surcharges.map((s) => ({
              organizationId: auth.organizationId,
              category: s.category,
              chargeType: s.chargeType,
              chargeValue: s.chargeValue,
              condition: s.condition,
              rawEvidence: s.rawEvidence,
            })),
          },
          billingRules: {
            create: billingRules.map((br) => ({
              organizationId: auth.organizationId,
              ruleType: br.ruleType,
              ruleKey: br.ruleKey,
              ruleValue: br.ruleValue,
              rawEvidence: br.rawEvidence,
            })),
          },
          restrictions: {
            create: restrictions.map((r) => ({
              organizationId: auth.organizationId,
              type: r.type,
              content: r.content,
              rawEvidence: r.rawEvidence,
            })),
          },
        },
        include: {
          publishedBy: { select: { id: true, name: true, email: true } },
          ruleVersion: { select: { id: true, version: true, upstream: true, status: true } },
          _count: { select: { quotes: true, surcharges: true, billingRules: true, restrictions: true } },
        },
      });

      return {
        id: newVersion.id,
        upstream: newVersion.upstream,
        version: newVersion.version,
        status: newVersion.status,
        ruleVersionId: newVersion.ruleVersionId,
        ruleVersion: newVersion.ruleVersion ? { id: newVersion.ruleVersion.id, version: newVersion.ruleVersion.version, upstream: newVersion.ruleVersion.upstream, status: newVersion.ruleVersion.status } : null,
        publishedBy: null,
        publishedAt: null,
        createdAt: newVersion.createdAt ? newVersion.createdAt.toISOString() : null,
        quoteCount: newVersion._count.quotes,
        surchargeCount: newVersion._count.surcharges,
        billingRuleCount: newVersion._count.billingRules,
        restrictionCount: newVersion._count.restrictions,
        rolledBackFrom: {
          id: archivedVersion.id,
          version: archivedVersion.version,
          quoteCount: quotes.length,
          surchargeCount: surcharges.length,
          billingRuleCount: billingRules.length,
          restrictionCount: restrictions.length,
        },
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[POST /api/quote-versions/[id]/rollback]", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "QuoteVersion not found" }, { status: 404 });
    if (msg === "NO_ARCHIVED") return NextResponse.json({ error: "No archived quote version found to roll back to" }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
