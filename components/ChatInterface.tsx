"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/types";

// Strip common Markdown symbols for cleaner display
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")       // **bold** → text
    .replace(/\*(.+?)\*/g, "$1")           // *italic* → text
    .replace(/__(.+?)__/g, "$1")           // __bold__ → text
    .replace(/_(.+?)_/g, "$1")             // _italic_ → text
    .replace(/`(.+?)`/g, "$1")            // `code` → text
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, "")) // code blocks → plain
    .replace(/^#{1,6}\s+/gm, "")          // # headers → plain text
    .replace(/^\s*[-*+]\s+/gm, "• ")      // - lists → bullet points
    .replace(/^\s*\d+\.\s+/gm, (m) => m.replace(/\d+\./, (n) => n.replace(".", ""))) // 1. → 1
    .replace(/^\s*>\s+/gm, "")            // > quotes → plain
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")   // [text](url) → text
    .replace(/---+/g, "")                 // dividers → nothing
    .trim();
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg: ChatMessage = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: messages,
        }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${data.error}` }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ 网络错误，请重试" }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestedQuestions = [
    "发30kg到美国西部，走哪个渠道便宜？",
    "内置电池能发空运到加拿大吗？",
    "超尺寸附加费怎么计算？",
    "货物遗失怎么赔偿？",
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col" style={{ height: "600px" }}>
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <div className="text-3xl mb-3">💬</div>
            <p className="text-sm mb-4">问我任何关于报价和条款的问题</p>
            <div className="space-y-2">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(q); }}
                  className="block w-full text-left px-3 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {msg.role === "assistant" ? stripMarkdown(msg.content) : msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-500">
              <span className="animate-pulse">AI 思考中...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 输入框 */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="输入问题，按 Enter 发送..."
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            ↑
          </button>
        </div>
        <p className="text-gray-400 text-xs mt-2 text-center">AI 回答仅供参考，以实际报价为准</p>
      </div>
    </div>
  );
}
