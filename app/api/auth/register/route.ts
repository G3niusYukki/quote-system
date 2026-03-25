import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { signToken, buildAuthCookie } from "@/lib/auth";

const registerSchema = z.object({
  organizationName: z.string().min(1, "Organization name is required").max(255),
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { organizationName, name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

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

    // Create Organization + Owner User in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: organizationName,
          plan: "free",
        },
      });

      const user = await tx.user.create({
        data: {
          organizationId: org.id,
          email: normalizedEmail,
          passwordHash,
          name,
          role: "owner",
        },
      });

      return { org, user };
    });

    const token = signToken({
      userId: result.user.id,
      organizationId: result.org.id,
      role: result.user.role,
      email: result.user.email,
    });

    const response = NextResponse.json(
      {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          organization: {
            id: result.org.id,
            name: result.org.name,
            plan: result.org.plan,
          },
        },
      },
      { status: 201 }
    );

    response.headers.set("Set-Cookie", buildAuthCookie(token));
    return response;
  } catch (err) {
    console.error("[POST /api/auth/register]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
