import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth } from "@/lib/request-auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";

const updateOrgSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

// GET /api/organizations/[id] — Get organization details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (id !== auth.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true } },
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: org.id,
      name: org.name,
      plan: org.plan,
      memberCount: org._count.users,
      createdAt: org.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("[GET /api/organizations/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/organizations/[id] — Update organization details (name, plan)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (id !== auth.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only owner can update org settings
  requirePermission(auth.role, "manage_members");

  try {
    const body = await req.json();
    const parsed = updateOrgSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      plan: updated.plan,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("[PUT /api/organizations/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
