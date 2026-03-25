import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth } from "@/lib/request-auth";
import { requirePermission } from "@/lib/rbac";
import { signToken } from "@/lib/auth";

const INVITE_EXPIRY_MINUTES = 10;

interface InvitePayload {
  organizationId: string;
  organizationName: string;
  type: "invite";
  iat: number;
  exp: number;
}

// POST /api/team/invite — Generate a team invite link (owner/admin only)
export async function POST(req: NextRequest) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  requirePermission(auth.role, "manage_members");

  const body = await req.json().catch(() => ({}));
  const role = (body.role as string) || "member";
  if (!["admin", "member", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const expiresIn = body.expiresInMinutes
    ? Math.min(Math.max(Number(body.expiresInMinutes), 1), 60)
    : INVITE_EXPIRY_MINUTES;

  const payload: InvitePayload = {
    organizationId: auth.organizationId,
    organizationName: body.organizationName || auth.email, // caller can pass org name
    type: "invite",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresIn * 60,
  };

  // Embed the desired role in the payload so the registration endpoint knows it
  const invitePayload = { ...payload, invitedRole: role };
  const token = signToken(invitePayload as unknown as Parameters<typeof signToken>[0]);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const inviteUrl = `${baseUrl}/team/invite?token=${token}`;

  return NextResponse.json({
    inviteUrl,
    expiresInMinutes: expiresIn,
    token,
  });
}
