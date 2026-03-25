import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

interface InvitePayload {
  organizationId: string;
  organizationName: string;
  type: string;
  invitedRole: string;
}

// GET /api/invite/validate?token=xxx — Validate an invite token
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  try {
    const payload = verifyToken(token) as unknown as InvitePayload;
    if (payload.type !== "invite") {
      return NextResponse.json({ error: "Invalid token type" }, { status: 400 });
    }

    return NextResponse.json({
      organizationId: payload.organizationId,
      organizationName: payload.organizationName,
      invitedRole: payload.invitedRole,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired invite token" },
      { status: 400 }
    );
  }
}
