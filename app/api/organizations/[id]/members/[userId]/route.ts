import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth } from "@/lib/request-auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";

const updateMemberSchema = z.object({
  role: z.enum(["owner", "admin", "member", "viewer"]).optional(),
  name: z.string().min(1).max(255).optional(),
});

// PUT /api/organizations/[id]/members/[userId] — Update member role or name
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, userId } = await params;
  if (id !== auth.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  requirePermission(auth.role, "manage_members");

  try {
    const body = await req.json();
    const parsed = updateMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Only owner can assign the owner role
    if (parsed.data.role === "owner" && auth.role !== "owner") {
      return NextResponse.json(
        { error: "Only an owner can assign the owner role" },
        { status: 403 }
      );
    }

    const { role, name } = parsed.data;

    // Prevent demoting the last owner
    if (role !== undefined && role !== "owner") {
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (targetUser.role === "owner") {
        const ownerCount = await prisma.user.count({
          where: { organizationId: id, role: "owner" },
        });
        if (ownerCount <= 1) {
          return NextResponse.json(
            { error: "Cannot demote the last owner of the organization" },
            { status: 400 }
          );
        }
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { ...(role && { role }), ...(name && { name }) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("[PUT /api/organizations/[id]/members/[userId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/organizations/[id]/members/[userId] — Remove a member from the organization
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, userId } = await params;
  if (id !== auth.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  requirePermission(auth.role, "manage_members");

  // Prevent self-removal
  if (userId === auth.userId) {
    return NextResponse.json(
      { error: "You cannot remove yourself from the organization" },
      { status: 400 }
    );
  }

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent removing the last owner
    if (targetUser.role === "owner") {
      const ownerCount = await prisma.user.count({
        where: { organizationId: id, role: "owner" },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last owner of the organization" },
          { status: 400 }
        );
      }
    }

    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/organizations/[id]/members/[userId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
