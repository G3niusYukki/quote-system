import { NextResponse } from "next/server";
import { getStatus } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const status = getStatus();
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json({ has_data: false, error: String(e) }, { status: 500 });
  }
}
