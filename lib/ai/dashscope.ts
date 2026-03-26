const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const MODEL = "qwen-plus";
const CONFIG_PATH = process.env.NODE_ENV === "production"
  ? "/app/data/config.json"
  : `${process.cwd()}/data/config.json`;

function getConfig(): { apiKey: string | null; baseUrl: string | null } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
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
      max_tokens: 4000,
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

      // Try standard JSON parse first
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // Fallback: try to extract JSON array/object from potentially truncated response
        const jsonStart = jsonStr.indexOf("[") !== -1 ? jsonStr.indexOf("[") : jsonStr.indexOf("{");
        if (jsonStart !== -1) {
          const candidate = jsonStr.slice(jsonStart);
          // Try to find the matching closing bracket by counting nesting level
          let end = candidate.length;
          let depth = 0;
          let inString = false;
          for (let i = 0; i < candidate.length; i++) {
            const ch = candidate[i];
            if (ch === '"' && candidate[i - 1] !== "\\") inString = !inString;
            if (!inString) {
              if (ch === "[") depth++;
              else if (ch === "]") {
                depth--;
                if (depth === 0) { end = i + 1; break; }
              }
            }
          }
          const truncated = candidate.slice(0, end);
          try {
            parsed = JSON.parse(truncated);
          } catch {
            throw new Error(`AI returned invalid JSON: ${candidate.slice(0, 300)}`);
          }
        } else {
          throw new Error(`AI returned invalid JSON: ${jsonStr.slice(0, 200)}`);
        }
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
