import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";

// GET /api/audit-logs — paginated audit log list
// Query params: user_id, action, entity_type, start_date, end_date, page, page_size
export async function GET(req: NextRequest) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // All roles can view audit logs
  requirePermission(auth.role, "view_audit_logs");

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id") ?? undefined;
  const action = searchParams.get("action") ?? undefined;
  const entityType = searchParams.get("entity_type") ?? undefined;
  const startDate = searchParams.get("start_date") ?? undefined;
  const endDate = searchParams.get("end_date") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("page_size") ?? "20", 10)));

  try {
    const result = await withOrgContext(auth, async () => {
      const where: Record<string, unknown> = {};

      if (userId) where.userId = userId;
      if (action) where.action = action;
      if (entityType) where.entityType = entityType;

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          (where.createdAt as Record<string, unknown>).lte = end;
        }
      }

      const [items, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);

      return {
        items: items.map((log) => ({
          id: log.id,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          before: log.before,
          after: log.after,
          ip: log.ip,
          createdAt: log.createdAt.toISOString(),
          user: log.user
            ? { id: log.user.id, name: log.user.name, email: log.user.email }
            : null,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/audit-logs]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
