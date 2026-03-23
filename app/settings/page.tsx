"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasKey, setHasKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; answer?: string; error?: string } | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setHasKey(d.hasKey);
        setBaseUrl(d.baseUrl || "");
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setTestResult(null);
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: apiKey || undefined, baseUrl }),
    });
    const data = await res.json();
    if (data.success) {
      setSaved(true);
      setHasKey(true);
      if (apiKey) setApiKey("");
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await fetch("/api/config/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: apiKey || undefined, baseUrl }),
    });
    const data = await res.json();
    setTestResult(data);
    setTesting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">系统设置</h1>
            <p className="text-gray-500 text-sm">配置 AI 接口</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/upload" className="text-blue-600 hover:underline">上传</Link>
            <Link href="/query" className="text-blue-600 hover:underline">查询</Link>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">百炼 API</h2>
          <p className="text-gray-500 text-sm mb-6">
            配置阿里云百炼大模型的接口信息，用于 AI 智能问答。
          </p>

          {loading ? (
            <div className="text-gray-400 text-sm">加载中...</div>
          ) : hasKey ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800 font-medium flex items-center gap-2">
                <span>✓</span> 已配置 API Key
              </p>
            </div>
          ) : null}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">百炼 API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-gray-400 text-xs mt-1.5">
                获取地址：阿里云百炼控制台 → API-KEY 管理
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base URL <span className="text-gray-400 font-normal">(可选)</span>
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="留空则使用默认地址"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-gray-400 text-xs mt-1.5">
                如使用代理或第三方兼容接口，填写完整 URL，默认：dashscope.aliyuncs.com
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                保存配置
              </button>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || (!apiKey && !hasKey)}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                {testing ? "测试中..." : "测试连接"}
              </button>
            </div>

            {saved && (
              <p className="text-green-600 text-sm text-center">✓ 配置已保存</p>
            )}
          </form>

          {testResult && (
            <div className={`mt-4 rounded-lg p-4 ${testResult.ok ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <p className={`font-medium ${testResult.ok ? "text-green-800" : "text-red-800"}`}>
                {testResult.ok ? "✓ 连接成功" : "✗ 连接失败"}
              </p>
              <p className={`text-sm mt-1 ${testResult.ok ? "text-green-700" : "text-red-700"}`}>
                {testResult.ok ? testResult.answer : testResult.error}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
