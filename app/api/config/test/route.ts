import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

const CONFIG_PATH = path.join(process.cwd(), "data", "config.json");

function getConfig(): { apiKey: string | null; baseUrl: string | null } {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      return {
        apiKey: config.dashscopeApiKey || null,
        baseUrl: config.baseUrl || null,
      };
    }
  } catch {}
  return { apiKey: null, baseUrl: null };
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey, baseUrl } = await req.json();

    if (apiKey !== undefined) {
      if (typeof apiKey !== "string" || !apiKey.trim()) {
        return NextResponse.json({ error: "API Key 不能为空" }, { status: 400 });
      }
    }

    const config = getConfig();
    if (apiKey !== undefined) config.apiKey = apiKey.trim();
    if (baseUrl !== undefined) config.baseUrl = typeof baseUrl === "string" ? baseUrl.trim() : "";

    if (!config.apiKey) {
      return NextResponse.json({ error: "请先填写 API Key" }, { status: 400 });
    }

    // 保存配置
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({
      dashscopeApiKey: config.apiKey,
      baseUrl: config.baseUrl || "",
    }, null, 2));

    // 测试调用
    const url = config.baseUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
    const model = config.baseUrl ? "qwen-plus" : "qwen-plus";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "请回复 ok，若收到此消息表示连接成功" }],
        max_tokens: 50,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        error: data?.error?.message || `HTTP ${response.status}`,
      });
    }

    return NextResponse.json({
      ok: true,
      answer: data.choices?.[0]?.message?.content || "连接成功（无回复内容）",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
