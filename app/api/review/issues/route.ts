import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";

// GET /api/review/issues — list low-confidence parse issues
// Query params: issue_type, resolved (boolean), page, pageSize
export async function GET(req: NextRequest) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const issueType = searchParams.get("issue_type");
  const resolved = searchParams.get("resolved");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

  try {
    const result = await withOrgContext(auth, async () => {
      // Build where: unresolved issues by default
      const where: Record<string, unknown> = {};
      if (issueType) where.issueType = issueType;
      if (resolved !== null && resolved !== undefined) {
        where.resolvedAt = resolved === "true" ? { not: null } : null;
      } else {
        // Default: show unresolved only
        where.resolvedAt = null;
      }

      const [items, total] = await Promise.all([
        prisma.parseIssue.findMany({
          where,
          orderBy: { id: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            importBlock: {
              select: {
                id: true,
                blockType: true,
                sheetName: true,
                rowRange: true,
                rawText: true,
                confidence: true,
                needsReview: true,
                importJob: {
                  select: { id: true, upstream: true, filename: true },
                },
              },
            },
            resolvedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
        prisma.parseIssue.count({ where }),
      ]);

      return {
        items: items.map((pi) => ({
          id: pi.id,
          issueType: pi.issueType,
          rawSegment: pi.rawSegment,
          aiExtraction: pi.aiExtraction,
          reason: pi.reason,
          suggestedFix: pi.suggestedFix,
          resolvedAt: pi.resolvedAt?.toISOString() ?? null,
          resolvedBy: pi.resolvedBy,
          block: {
            id: pi.importBlock.id,
            blockType: pi.importBlock.blockType,
            sheetName: pi.importBlock.sheetName,
            rowRange: pi.importBlock.rowRange,
            rawText: pi.importBlock.rawText,
            confidence: pi.importBlock.confidence,
            needsReview: pi.importBlock.needsReview,
            importJob: pi.importBlock.importJob,
          },
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/review/issues]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
