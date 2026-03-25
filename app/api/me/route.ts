import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestAuth } from "@/lib/request-auth";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: { organization: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        plan: user.organization.plan,
      },
    },
  });
}

// PATCH /api/me — Update current user's name
const updateMeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = updateMeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data: parsed.data,
      include: { organization: true },
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        organization: {
          id: updated.organization.id,
          name: updated.organization.name,
          plan: updated.organization.plan,
        },
      },
    });
  } catch (err) {
    console.error("[PATCH /api/me]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
