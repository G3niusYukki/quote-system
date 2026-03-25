import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";

// GET /api/import-jobs/[id] — Get import job detail
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
      const job = await prisma.importJob.findUnique({
        where: { id },
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
          importBlocks: {
            select: {
              id: true,
              blockType: true,
              sheetName: true,
              rowRange: true,
              confidence: true,
              needsReview: true,
            },
            orderBy: { id: "asc" },
          },
          _count: {
            select: { importBlocks: true },
          },
        },
      });

      if (!job) return null;

      // Count blocks needing review and issue counts per type
      const [needsReviewCount, issueCounts] = await Promise.all([
        prisma.importBlock.count({ where: { importJobId: id, needsReview: true } }),
        prisma.parseIssue.groupBy({
          by: ["issueType"],
          where: { importBlock: { importJobId: id } },
          _count: { id: true },
        }),
      ]);

      return {
        id: job.id,
        filename: job.filename,
        status: job.status,
        upstream: job.upstream,
        checksum: job.checksum,
        uploadedBy: job.uploadedBy,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString() ?? null,
        blocks: job.importBlocks,
        blockCount: job._count.importBlocks,
        needsReviewCount,
        issueCounts: issueCounts.map((ic) => ({
          issueType: ic.issueType,
          count: ic._count.id,
        })),
      };
    });

    if (!result) {
      return NextResponse.json({ error: "Import job not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/import-jobs/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/import-jobs/[id] — Delete an import job and its blocks
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await withOrgContext(auth, async () => {
      // Get all block IDs first
      const blocks = await prisma.importBlock.findMany({
        where: { importJobId: id },
        select: { id: true },
      });
      const blockIds = blocks.map((b) => b.id);

      // Delete parse issues (cascade from ImportBlock handles this, but explicit is safe)
      if (blockIds.length > 0) {
        await prisma.parseIssue.deleteMany({ where: { importBlockId: { in: blockIds } } });
      }
      await prisma.importBlock.deleteMany({ where: { importJobId: id } });
      await prisma.importJob.delete({ where: { id } });
    });

    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Record to delete does not exist")) {
      return NextResponse.json({ error: "Import job not found" }, { status: 404 });
    }
    console.error("[DELETE /api/import-jobs/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
