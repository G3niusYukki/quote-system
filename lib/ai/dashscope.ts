const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const MODEL = "qwen-plus";

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
