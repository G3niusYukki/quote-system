import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getDb,
  clearAllData,
  insertQuote,
  insertSurcharge,
  insertRestriction,
  insertCompensation,
  insertBillingRule,
  recordUpload,
} from "@/lib/db";
import { parseExcel } from "@/lib/parser";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "未上传文件" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = crypto.createHash("md5").update(buffer).digest("hex");

    // 解析
    const parseResult = parseExcel(buffer);

    // 写入数据库（全量替换）
    const db = getDb();
    clearAllData();

    for (const q of parseResult.quotes) insertQuote(q);
    for (const s of parseResult.surcharges) insertSurcharge(s);
    for (const r of parseResult.restrictions) insertRestriction(r);
    for (const c of parseResult.compensationRules) insertCompensation(c);
    for (const b of parseResult.billingRules) insertBillingRule(b);

    // 记录上传历史
    recordUpload(file.name, parseResult.quotes.length, checksum);

    // 获取所有渠道名
    const channels = [...new Set(parseResult.quotes.map((q) => q.channel_name))];

    return NextResponse.json({
      success: true,
      preview: {
        sheets: channels,
        channels: parseResult.quotes.length,
        surcharges: parseResult.surcharges.length,
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
