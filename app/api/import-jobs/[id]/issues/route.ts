import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";

// GET /api/import-jobs/[id]/issues — Get parse issues for an import job (paginated + filtered)
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
  const issueType = searchParams.get("issue_type") ?? undefined;
  const resolved = searchParams.get("resolved");

  try {
    const result = await withOrgContext(auth, async () => {
      const where: Record<string, unknown> = {
        importBlock: { importJobId: id },
      };
      if (issueType) where.issueType = issueType;
      if (resolved !== null && resolved !== undefined) {
        where.resolvedAt = resolved === "true" ? { not: null } : null;
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
                confidence: true,
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
          block: pi.importBlock,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/import-jobs/[id]/issues]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
