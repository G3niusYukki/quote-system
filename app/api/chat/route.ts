import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import {
  getAllQuotesForChat,
  getAllSurcharges,
  getAllRestrictions,
  getAllCompensationRules,
} from "@/lib/db";
import { chat } from "@/lib/dashscope";
import { buildChatPrompt } from "@/lib/prompt";
import type { ChatMessage } from "@/types";

export const runtime = "nodejs";

const CONFIG_PATH = path.join(process.cwd(), "data", "config.json");

function getApiKey(): string | null {
  // 优先读环境变量
  const envKey = process.env.DASHSCOPE_API_KEY;
  if (envKey) return envKey;
  // 其次读配置文件
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      return config.dashscopeApiKey || null;
    }
  } catch {}
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { question, history = [] }: { question: string; history?: ChatMessage[] } = await req.json();

    if (!question?.trim()) {
      return NextResponse.json({ error: "问题不能为空" }, { status: 400 });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: "请先在设置页配置百炼 API Key" }, { status: 500 });
    }

    const quotes = getAllQuotesForChat();
    const surcharges = getAllSurcharges();
    const restrictions = getAllRestrictions();
    const compensationRules = getAllCompensationRules();

    if (quotes.length === 0) {
      return NextResponse.json({
        answer: "系统暂无报价数据，请先上传报价表。",
      });
    }

    const prompt = buildChatPrompt(quotes, surcharges, restrictions, compensationRules, question, history);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const answer = await chat({ apiKey, prompt, signal: controller.signal });
      clearTimeout(timeout);
      return NextResponse.json({ answer });
    } catch (e) {
      clearTimeout(timeout);
      if (e instanceof Error && e.name === "AbortError") {
        return NextResponse.json({ error: "AI响应超时，请稍后重试" }, { status: 504 });
      }
      throw e;
    }
  } catch (e) {
    console.error("Chat error:", e);
    return NextResponse.json({ error: `AI调用失败: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
}
