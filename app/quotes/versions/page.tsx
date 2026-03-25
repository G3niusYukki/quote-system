"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface QuoteVersion {
  id: string;
  upstream: string;
  version: number;
  status: string;
  ruleVersionId: string;
  ruleVersion: { id: string; version: number; upstream: string } | null;
  publishedBy: { id: string; name: string; email: string } | null;
  publishedAt: string | null;
  createdAt: string;
  quoteCount: number;
  surchargeCount?: number;
  billingRuleCount?: number;
  restrictionCount?: number;
}

interface RuleVersionOption {
  id: string;
  upstream: string;
  version: number;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-yellow-100 text-yellow-700",
};

export default function QuoteVersionsPage() {
  const [versions, setVersions] = useState<QuoteVersion[]>([]);
  const [ruleVersions, setRuleVersions] = useState<RuleVersionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterUpstream, setFilterUpstream] = useState("");
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterUpstream) params.set("upstream", filterUpstream);
    params.set("pageSize", "100");
    Promise.all([
      fetch(`/api/quote-versions?${params}`).then((r) => r.json()),
      fetch(`/api/rule-versions?pageSize=200`).then((r) => r.json()),
    ]).then(([qvData, rvData]) => {
      setVersions(qvData.versions ?? []);
      setRuleVersions(rvData.versions ?? []);
      setLoading(false);
    }).catch(() => { setError("加载失败"); setLoading(false); });
  }, [filterStatus, filterUpstream]);

  const upstreams = [...new Set(versions.map((v) => v.upstream))];

  const handleCreate = async () => {
    const ruleVersionId = prompt(
      `请输入关联的规则版本 ID（可从以下列表选择）：\n${ruleVersions
        .filter((rv) => rv.status === "published")
        .map((rv) => `  ${rv.id} — ${rv.upstream} v${rv.version}`)
        .join("\n") || "无已发布规则版本"}`
    );
    if (!ruleVersionId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/quote-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule_version_id: ruleVersionId }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        router.push(`/quotes/versions/${data.id}`);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">报价版本管理</h1>
            <p className="text-gray-500 text-sm">创建、发布、回滚报价版本</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/quotes" className="text-blue-600 hover:underline">报价</Link>
            <Link href="/rules/versions" className="text-blue-600 hover:underline">规则版本</Link>
            <Link href="/query" className="text-blue-600 hover:underline">查询</Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        {/* Filters + Create */}
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? "创建中..." : "+ 新建报价版本"}
          </button>
          <select
            value={filterUpstream}
            onChange={(e) => setFilterUpstream(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">全部上游</option>
            {upstreams.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="archived">已归档</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">加载中...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-400">{error}</div>
        ) : versions.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
            暂无报价版本，点击「新建报价版本」开始
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">上游</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">版本</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">规则版本</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">报价数</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">创建时间</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{v.upstream}</td>
                    <td className="px-4 py-3 text-gray-600">v{v.version}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[v.status] ?? ""}`}>
                        {v.status === "draft" ? "草稿" : v.status === "published" ? "已发布" : "已归档"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {v.ruleVersion ? (
                        <span>
                          {v.ruleVersion.upstream} v{v.ruleVersion.version}
                        </span>
                      ) : v.ruleVersionId ? (
                        <span className="text-gray-400">{v.ruleVersionId.slice(0, 8)}...</span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{v.quoteCount}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(v.createdAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <Link href={`/quotes/versions/${v.id}`} className="text-blue-600 hover:underline text-xs">详情</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
