import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth } from "@/lib/request-auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac";

const addMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  role: z.enum(["admin", "member", "viewer"]),
  password: z.string().min(8),
});

// GET /api/organizations/[id]/members — List all members of an organization
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
    const members = await prisma.user.findMany({
      where: { organizationId: id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      members: members.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[GET /api/organizations/[id]/members]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/organizations/[id]/members — Add a new member to the organization
export async function POST(
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

  // requirePermission checks that role is owner or admin
  requirePermission(auth.role, "manage_members");

  try {
    const body = await req.json();
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, name, role, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Check if email is already taken
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    const { hash } = await import("bcryptjs");
    const passwordHash = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        organizationId: id,
        email: normalizedEmail,
        passwordHash,
        name,
        role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        ...user,
        createdAt: user.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/organizations/[id]/members]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
