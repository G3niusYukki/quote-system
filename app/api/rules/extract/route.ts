import { NextRequest, NextResponse } from "next/server";
import { getLatestRawExcelText, clearAIRulesForUpstream, insertRule } from "@/lib/db";
import { extractRulesFromExcel } from "@/lib/rule-extractor";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const upstream = searchParams.get("upstream");
  if (!upstream) return NextResponse.json({ error: "缺少 upstream 参数" }, { status: 400 });

  const rawText = getLatestRawExcelText(upstream);
  if (!rawText) {
    return NextResponse.json({ error: "未找到该上游的历史上传记录，无法重提" }, { status: 404 });
  }

  // raw_excel_text stores base64-encoded original Excel binary
  const buffer = Buffer.from(rawText, "base64");

  // Clear old AI rules for this upstream before re-extracting
  clearAIRulesForUpstream(upstream);

  const result = await extractRulesFromExcel(buffer, upstream);
  for (const r of result.rules) {
    try { insertRule(r); } catch { /* skip bad rule */ }
  }

  return NextResponse.json({
    success: true,
    count: result.rules.length,
    warning: result.aiWarning,
  });
}
