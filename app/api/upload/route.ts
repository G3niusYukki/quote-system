import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getDb,
  clearUpstreamData,
  insertQuote,
  insertRule,
  recordUpload,
} from "@/lib/db";
import { parseExcel } from "@/lib/parser";
import { extractRulesFromExcel } from "@/lib/rule-extractor";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "未上传文件" }, { status: 400 });
    }

    const upstream = (formData.get("upstream") as string | null)?.trim() || "默认上游";
    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = crypto.createHash("md5").update(buffer).digest("hex");

    // 解析
    const parseResult = parseExcel(buffer, upstream);

    // 写入数据库（该上游旧数据全量替换）
    const db = getDb();
    clearUpstreamData(upstream);

    for (const q of parseResult.quotes) insertQuote(q);

    // AI extract rules
    const aiResult = await extractRulesFromExcel(buffer, upstream);
    for (const r of aiResult.rules) {
      try { insertRule(r); } catch { /* skip bad rule */ }
    }

    recordUpload(file.name, parseResult.quotes.length, checksum, upstream, buffer.toString("base64"));

    // 获取所有渠道名
    const channels = [...new Set(parseResult.quotes.map((q) => q.channel_name))];

    return NextResponse.json({
      success: true,
      preview: {
        sheets: channels,
        channels: parseResult.quotes.length,
        surcharges: parseResult.surcharges.length,
        rules_ai_count: aiResult.rules.length,
        ai_warning: aiResult.aiWarning,
        unparsed_warnings: parseResult.unparsedWarnings,
      },
    });
  } catch (e) {
    console.error("Upload error:", e);
    return NextResponse.json(
      { success: false, error: `解析失败: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}
