import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";

// GET /api/history — list query history (paginated)
export async function GET(req: NextRequest) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const today = searchParams.get("today") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

  try {
    return await withOrgContext(auth, async () => {
      // If today=true, return today's query count only
      if (today) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const count = await prisma.queryHistory.count({
          where: {
            organizationId: auth.organizationId,
            createdAt: { gte: startOfDay },
          },
        });
        return NextResponse.json({ count });
      }

      const [items, total] = await Promise.all([
        prisma.queryHistory.findMany({
          where: { organizationId: auth.organizationId },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        }),
        prisma.queryHistory.count({ where: { organizationId: auth.organizationId } }),
      ]);

      return NextResponse.json({
        items: items.map((h) => ({
          id: h.id,
          question: h.question,
          answer: h.answer,
          tokensUsed: h.tokensUsed,
          createdAt: h.createdAt.toISOString(),
          user: h.user,
        })),
        total,
        page,
        pageSize,
      });
    });
  } catch (err) {
    console.error("[GET /api/history]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
