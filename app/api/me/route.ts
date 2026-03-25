import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestAuth } from "@/lib/request-auth";

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
