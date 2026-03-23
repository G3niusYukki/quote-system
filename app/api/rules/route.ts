import { NextRequest, NextResponse } from "next/server";
import { getRules, insertRule } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const upstream = searchParams.get("upstream") || "默认上游";
  const category = searchParams.get("category") || undefined;
  const rules = getRules(upstream, category || undefined);
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.upstream || !body.category) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
    }
    insertRule({ ...body, source: "manual" });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
