import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { getParseExcelQueue } from "@/lib/queue";
import { requirePermission } from "@/lib/rbac";

// Ensure /data/uploads exists
const UPLOADS_DIR = "/data/uploads";

async function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) {
    await mkdir(UPLOADS_DIR, { recursive: true });
  }
}

// POST /api/import-jobs — Create a new import job
const createSchema = z.object({
  upstream: z.string().min(1, "upstream is required"),
});

// GET /api/import-jobs — List import jobs (paginated, filtered by org)
export async function GET(req: NextRequest) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
  const status = searchParams.get("status") ?? undefined;
  const upstream = searchParams.get("upstream") ?? undefined;

  try {
    const result = await withOrgContext(auth, async () => {
      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (upstream) where.upstream = upstream;

      const [items, total] = await Promise.all([
        prisma.importJob.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            uploadedBy: { select: { id: true, name: true, email: true } },
            _count: { select: { importBlocks: true } },
          },
        }),
        prisma.importJob.count({ where }),
      ]);

      return {
        items: items.map((j) => ({
          id: j.id,
          filename: j.filename,
          status: j.status,
          upstream: j.upstream,
          checksum: j.checksum,
          uploadedBy: j.uploadedBy,
          errorMessage: j.errorMessage,
          createdAt: j.createdAt.toISOString(),
          completedAt: j.completedAt?.toISOString() ?? null,
          blockCount: j._count.importBlocks,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/import-jobs]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse multipart form data
  requirePermission(auth.role, "upload_excel");

  let body: FormData;
  try {
    body = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const upstream = body.get("upstream");
  if (!upstream || typeof upstream !== "string") {
    return NextResponse.json({ error: "upstream is required" }, { status: 400 });
  }

  const file = body.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  // Validate file format
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!["xlsx", "xls"].includes(ext ?? "")) {
    return NextResponse.json(
      { error: "Only .xlsx and .xls files are supported" },
      { status: 400 }
    );
  }

  // Validate file size (max 50MB)
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "File size exceeds 50MB limit" }, { status: 400 });
  }

  try {
    // Read file bytes and compute MD5 upfront (needed for checksum before any DB access)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const checksum = createHash("md5").update(buffer).digest("hex");

    const result = await withOrgContext(auth, async () => {
      // DB insert + queue add must be atomic: if queue.add fails, roll back the job
      const queue = getParseExcelQueue();

      const job = await prisma.$transaction(async (tx) => {
        const created = await tx.importJob.create({
          data: {
            organizationId: auth.organizationId,
            filename: file.name,
            status: "pending",
            upstream,
            checksum,
            uploadedById: auth.userId,
          },
        });

        // Enqueue BullMQ job inside the same transaction scope
        // so the DB record is only committed if queue.add succeeds
        await queue.add(
          "parse-excel",
          {
            jobId: created.id,
            organizationId: auth.organizationId,
            upstream,
          },
          {
            attempts: 3,
            backoff: {
              type: "exponential" as const,
              delay: 10_000,
            },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 500 },
          }
        );

        return created;
      });

      // Write file to disk AFTER the DB tx commits (file write is not DB-rollbackable)
      await ensureUploadsDir();
      const filePath = path.join(UPLOADS_DIR, `${job.id}.xlsx`);
      await writeFile(filePath, buffer);

      return job;
    });

    return NextResponse.json({ job_id: result.id, status: "pending" }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/import-jobs]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
