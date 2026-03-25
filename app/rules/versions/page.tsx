"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface RuleVersion {
  id: string;
  upstream: string;
  version: number;
  status: string;
  publishedBy: { id: string; name: string; email: string } | null;
  publishedAt: string | null;
  createdAt: string;
  ruleCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-yellow-100 text-yellow-700",
};

export default function RuleVersionsPage() {
  const [versions, setVersions] = useState<RuleVersion[]>([]);
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
    setLoading(true);
    fetch(`/api/rule-versions?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setVersions(d.versions ?? []);
        setLoading(false);
      })
      .catch(() => { setError("加载失败"); setLoading(false); });
  }, [filterStatus, filterUpstream]);

  const upstreams = [...new Set(versions.map((v) => v.upstream))];

  const handleCreate = async () => {
    const upstream = prompt("请输入上游名称（如：美国 FedEx / 澳大利亚 DHL）:");
    if (!upstream) return;
    setCreating(true);
    try {
      const res = await fetch("/api/rule-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upstream }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        router.push(`/rules/versions/${data.id}`);
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
            <h1 className="text-xl font-bold text-gray-900">规则版本管理</h1>
            <p className="text-gray-500 text-sm">创建、发布、回滚规则版本</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/rules" className="text-blue-600 hover:underline">规则</Link>
            <Link href="/upload" className="text-blue-600 hover:underline">上传</Link>
            <Link href="/settings" className="text-blue-600 hover:underline">设置</Link>
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
            {creating ? "创建中..." : "+ 新建版本"}
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
            暂无规则版本，点击「新建版本」开始
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">上游</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">版本</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">规则数</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">创建时间</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">发布人</th>
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
                    <td className="px-4 py-3 text-gray-600">{v.ruleCount}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(v.createdAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {v.publishedBy?.name ?? "-"}
                      {v.publishedAt && <span className="block text-gray-300">{new Date(v.publishedAt).toLocaleString("zh-CN")}</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <Link href={`/rules/versions/${v.id}`} className="text-blue-600 hover:underline text-xs">详情</Link>
                        {v.status === "published" && (
                          <Link href={`/rules/versions/${v.id}/diff`} className="text-gray-600 hover:underline text-xs">对比</Link>
                        )}
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
