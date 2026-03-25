"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ApiKeysSettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setHasKey(d.hasKey);
        setMaskedKey(d.maskedKey ?? "");
        setBaseUrl(d.baseUrl ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey || undefined, baseUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "保存失败");
        return;
      }
      setSaved(true);
      setHasKey(true);
      setApiKey("");
      // Update masked key display
      if (apiKey) {
        const key = apiKey.trim();
        setMaskedKey(key.length > 8 ? `${key.slice(0, 4)}${"*".repeat(key.length - 8)}${key.slice(-4)}` : `${"*".repeat(key.length)}`);
      }
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">API Key 配置</h1>
        <p className="text-sm text-gray-500 mt-1">配置阿里云百炼大模型的 API Key</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">百炼 API Key</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {hasKey && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-green-800 text-sm">
                  已配置：<code className="font-mono text-xs">{maskedKey}</code>
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="apiKey">
                {hasKey ? "新的 API Key" : "API Key"}
              </Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasKey ? "留空则保留当前 Key" : "sk-xxxxxxxxxxxxxxxxxxxxxxxx"}
                autoComplete="off"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                获取地址：阿里云百炼控制台 → API-KEY 管理
              </p>
            </div>

            <div>
              <Label htmlFor="baseUrl">
                Base URL <span className="text-gray-400 font-normal">(可选)</span>
              </Label>
              <Input
                id="baseUrl"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="留空则使用默认地址 dashscope.aliyuncs.com"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                如使用代理或第三方兼容接口，填写完整 URL
              </p>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "保存中..." : "保存配置"}
              </Button>
              {saved && (
                <span className="flex items-center text-green-600 text-sm gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  配置已保存
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">说明</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">•</span>
              API Key 存储在 <code className="text-xs bg-gray-100 px-1 rounded">data/config.json</code> 中，不会提交到代码仓库
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">•</span>
              此配置为全局配置，所有团队共享
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">•</span>
              建议同时通过环境变量 <code className="text-xs bg-gray-100 px-1 rounded">DASHSCOPE_API_KEY</code> 配置作为备份
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
