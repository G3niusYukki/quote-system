import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { signToken, buildAuthCookie, verifyToken } from "@/lib/auth";

interface InvitePayload {
  organizationId: string;
  organizationName: string;
  type: string;
  invitedRole: string;
}

const registerByInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(255),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// POST /api/auth/register-by-invite — Register a new user via invite link
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerByInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { token, name, password } = parsed.data;

    // Validate invite token
    let invitePayload: InvitePayload;
    try {
      invitePayload = verifyToken(token) as unknown as InvitePayload;
      if (invitePayload.type !== "invite") {
        return NextResponse.json({ error: "Invalid token type" }, { status: 400 });
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired invite token" },
        { status: 400 }
      );
    }

    const { organizationId, invitedRole } = invitePayload;
    const normalizedEmail = (body.email as string)?.toLowerCase();

    if (!normalizedEmail || !z.string().email().safeParse(normalizedEmail).success) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    // Check if email is already taken
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        organizationId,
        email: normalizedEmail,
        passwordHash,
        name,
        role: invitedRole || "member",
      },
    });

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    const jwtToken = signToken({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email,
    });

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization: org
            ? { id: org.id, name: org.name, plan: org.plan }
            : null,
        },
      },
      { status: 201 }
    );

    response.headers.set("Set-Cookie", buildAuthCookie(jwtToken));
    return response;
  } catch (err) {
    console.error("[POST /api/auth/register-by-invite]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
