import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";

// GET /api/import-jobs/[id]/blocks — Get blocks for an import job (paginated + filtered)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
  const needsReview = searchParams.get("needs_review");
  const blockType = searchParams.get("block_type") ?? undefined;

  try {
    const result = await withOrgContext(auth, async () => {
      const where: Record<string, unknown> = { importJobId: id };
      if (needsReview !== null && needsReview !== undefined) {
        where.needsReview = needsReview === "true";
      }
      if (blockType) where.blockType = blockType;

      const [items, total] = await Promise.all([
        prisma.importBlock.findMany({
          where,
          orderBy: { id: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            parseIssues: {
              select: {
                id: true,
                issueType: true,
                reason: true,
                resolvedAt: true,
              },
            },
          },
        }),
        prisma.importBlock.count({ where }),
      ]);

      return {
        items: items.map((b) => ({
          id: b.id,
          blockType: b.blockType,
          sheetName: b.sheetName,
          rowRange: b.rowRange,
          rawText: b.rawText,
          normalizedText: b.normalizedText,
          confidence: b.confidence,
          needsReview: b.needsReview,
          issues: b.parseIssues.map((pi) => ({
            id: pi.id,
            issueType: pi.issueType,
            reason: pi.reason,
            resolvedAt: pi.resolvedAt?.toISOString() ?? null,
          })),
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/import-jobs/[id]/blocks]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
