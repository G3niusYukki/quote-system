import { NextRequest, NextResponse } from "next/server";
import { getQueryHistory } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const history = getQueryHistory(Math.min(limit, 200));
  return NextResponse.json({ history });
}
