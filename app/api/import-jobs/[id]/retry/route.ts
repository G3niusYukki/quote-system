import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { getParseExcelQueue } from "@/lib/queue";

// POST /api/import-jobs/[id]/retry — Retry a failed import job
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
      const job = await prisma.importJob.findUnique({ where: { id } });
      if (!job) return { success: false, reason: "not_found" };
      if (job.status !== "failed") {
        return { success: false, reason: "not_failed" };
      }

      // Reset job status to pending and clear error
      const updated = await prisma.importJob.update({
        where: { id },
        data: { status: "pending", errorMessage: null },
      });

      // Re-enqueue in BullMQ
      const queue = getParseExcelQueue();
      await queue.add(
        "parse-excel",
        {
          jobId: updated.id,
          organizationId: updated.organizationId,
          upstream: updated.upstream,
        },
        {
          attempts: 3,
          backoff: { type: "exponential" as const, delay: 10_000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        }
      );

      return { success: true, jobId: updated.id };
    });

    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Import job not found" }, { status: 404 });
    }
    if (result.reason === "not_failed") {
      return NextResponse.json(
        { error: "Only failed jobs can be retried" },
        { status: 400 }
      );
    }

    return NextResponse.json({ job_id: result.jobId, status: "pending" });
  } catch (err) {
    console.error("[POST /api/import-jobs/[id]/retry]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
