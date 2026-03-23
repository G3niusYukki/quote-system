import { NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest) {
  try {
    const { question, history = [] }: { question: string; history?: ChatMessage[] } = await req.json();

    if (!question?.trim()) {
      return NextResponse.json({ error: "问题不能为空" }, { status: 400 });
    }

    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "未配置 DASHSCOPE_API_KEY" }, { status: 500 });
    }

    // 获取所有数据
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
      const answer = await chat({
        apiKey,
        prompt,
        signal: controller.signal,
      });
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
