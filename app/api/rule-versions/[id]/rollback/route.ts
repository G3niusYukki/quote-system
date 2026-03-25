import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";

// POST /api/rule-versions/[id]/rollback
// Finds the most recent archived version for the same upstream,
// copies all its rules into a new draft RuleVersion.
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
      const current = await prisma.ruleVersion.findUnique({ where: { id } });
      if (!current) throw new Error("NOT_FOUND");

      // Find the most recent archived version for the same upstream
      const archivedVersion = await prisma.ruleVersion.findFirst({
        where: { upstream: current.upstream, status: "archived" },
        orderBy: { version: "desc" },
      });

      if (!archivedVersion) throw new Error("NO_ARCHIVED");

      // Get all rules from the archived version
      const archivedRules = await prisma.rule.findMany({
        where: { ruleVersionId: archivedVersion.id },
      });

      // Find the max version number for this upstream
      const maxVersion = await prisma.ruleVersion.findFirst({
        where: { upstream: current.upstream },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const nextVersion = (maxVersion?.version ?? 0) + 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newVersion = await prisma.ruleVersion.create({
        data: {
          organizationId: auth.organizationId,
          upstream: current.upstream,
          version: nextVersion,
          status: "draft",
          rules: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            create: archivedRules.map((r) => ({
              organizationId: auth.organizationId,
              category: r.category,
              type: r.type,
              itemType: r.itemType,
              chargeType: r.chargeType,
              chargeValue: r.chargeValue,
              condition: r.condition,
              description: r.description,
              content: r.content,
              priority: r.priority,
              confidence: r.confidence,
              source: r.source,
              rawEvidence: r.rawEvidence,
            } as any)),
          },
        },
        include: {
          publishedBy: { select: { id: true, name: true, email: true } },
          _count: { select: { rules: true, quoteVersions: true } },
        },
      }) as unknown as {
        id: string; upstream: string; version: number; status: string;
        createdAt: Date;
        publishedBy: { id: string; name: string; email: string } | null;
        publishedAt: Date | null;
        _count: { rules: number; quoteVersions: number };
      };

      return {
        id: newVersion.id,
        upstream: newVersion.upstream,
        version: newVersion.version,
        status: newVersion.status,
        publishedBy: null,
        publishedAt: null,
        createdAt: newVersion.createdAt ? newVersion.createdAt.toISOString() : null,
        ruleCount: newVersion._count.rules,
        quoteVersionCount: newVersion._count.quoteVersions,
        rolledBackFrom: {
          id: archivedVersion.id,
          version: archivedVersion.version,
          ruleCount: archivedRules.length,
        },
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[POST /api/rule-versions/[id]/rollback]", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "RuleVersion not found" }, { status: 404 });
    if (msg === "NO_ARCHIVED") return NextResponse.json({ error: "No archived version found to roll back to" }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
