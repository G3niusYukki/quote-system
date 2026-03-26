const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const MODEL = "qwen-plus";
const CONFIG_PATH = process.env.NODE_ENV === "production"
  ? "/app/data/config.json"
  : `${process.cwd()}/data/config.json`;

function getConfig(): { apiKey: string | null; baseUrl: string | null } {
  console.log("[dashscope] getConfig() CONFIG_PATH:", CONFIG_PATH);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");
    console.log("[dashscope] fs module loaded, exists:", fs.existsSync(CONFIG_PATH));
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      console.log("[dashscope] config loaded:", { apiKey: config.dashscopeApiKey?.slice(0, 8) + "..." });
      return {
        apiKey: (config.dashscopeApiKey as string | undefined) ?? null,
        baseUrl: (config.baseUrl as string | undefined) ?? null,
      };
    }
  } catch {}
  return { apiKey: null, baseUrl: null };
}

export interface ChatOptions {
  apiKey: string;
  prompt: string;
  baseUrl?: string;
  signal?: AbortSignal;
}

export async function chat(options: ChatOptions): Promise<string> {
  const { apiKey, prompt, baseUrl, signal } = options;
  const url = baseUrl || DEFAULT_BASE_URL;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2000,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`百炼API调用失败: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0]?.message?.content) {
    throw new Error("百炼API返回格式异常");
  }

  return data.choices[0].message.content;
}

// ─── AIProvider wrapper ─────────────────────────────────────────────────────────
import { buildPrompt } from "./prompts";
import type { AIProvider, AIResult } from "./provider";

export function createDashScopeProvider(): AIProvider {
  return {
    async extract(blockType: AIResult["type"], rawText: string): Promise<AIResult> {
      const envKey = process.env.DASHSCOPE_API_KEY;
      const { apiKey: configKey, baseUrl: configBaseUrl } = getConfig();
      const apiKey = configKey ?? envKey;
      console.log("[dashscope] extract: configKey=", configKey ? configKey.slice(0, 8) + "..." : "none",
        "envKey=", envKey ? envKey.slice(0, 8) + "..." : "none",
        "final apiKey=", apiKey ? apiKey.slice(0, 8) + "..." : "NONE!");
      if (!apiKey) throw new Error("No DASHSCOPE_API_KEY found (env or data/config.json)");

      const prompt = buildPrompt(blockType, rawText);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);
      let rawResponse: string;
      try {
        rawResponse = await chat({ apiKey, prompt, baseUrl: configBaseUrl ?? undefined, signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }

      // Strip markdown code fences if present
      let jsonStr = rawResponse.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        throw new Error(`AI returned invalid JSON: ${jsonStr.slice(0, 200)}`);
      }

      // Normalize output shape
      const data = Array.isArray(parsed) ? parsed : [parsed];

      // Extract a representative raw_text snippet (first 500 chars of normalized text)
      const raw_text = rawText.slice(0, 500);

      // Determine the primary type (if AI returns a different type, trust the block type)
      const type: AIResult["type"] =
        blockType === "notes" || blockType === "clause" ? blockType : blockType;

      return {
        type,
        data: Array.isArray(parsed)
          ? { items: parsed } as Record<string, unknown>
          : (parsed as Record<string, unknown>),
        confidence: 0.8,
        raw_text,
      };
    },
  };
}
