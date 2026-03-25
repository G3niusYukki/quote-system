"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface RuleVersionDetail {
  id: string;
  upstream: string;
  version: number;
  status: string;
  publishedBy: { id: string; name: string; email: string } | null;
  publishedAt: string | null;
  createdAt: string;
  ruleCount: number;
  quoteVersionCount: number;
}

interface Rule {
  id: string;
  category: string;
  type: string | null;
  chargeType: string | null;
  chargeValue: number | null;
  condition: string | null;
  description: string | null;
  source: string;
  confidence: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-yellow-100 text-yellow-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  surcharge: "附加费",
  restriction: "限制",
  compensation: "赔偿",
  billing: "计费",
};

export default function RuleVersionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [version, setVersion] = useState<RuleVersionDetail | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [tab, setTab] = useState<"surcharge" | "restriction" | "compensation" | "billing">("surcharge");

  useEffect(() => {
    Promise.all([
      fetch(`/api/rule-versions/${id}`).then((r) => r.json()),
      fetch(`/api/rules?version_id=${id}&pageSize=500`).then((r) => r.json()),
    ]).then(([vData, rData]) => {
      if (vData.error) {
        setError(vData.error);
      } else {
        setVersion(vData);
        setRules(rData.rules ?? []);
      }
      setLoading(false);
    }).catch(() => { setError("加载失败"); setLoading(false); });
  }, [id]);

  const handlePublish = async () => {
    if (!confirm("确认发布此版本？发布后旧版本将自动归档。")) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/rule-versions/${id}/publish`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setVersion((v) => v ? { ...v, ...data, publishedBy: data.publishedBy } : v);
        alert("发布成功！");
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleRollback = async () => {
    if (!confirm("确认回滚？将基于上一个归档版本创建新的草稿版本。")) return;
    setRollingBack(true);
    try {
      const res = await fetch(`/api/rule-versions/${id}/rollback`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert(`回滚成功！已创建新草稿版本 v${data.version}，包含 ${data.ruleCount} 条规则。`);
        router.push(`/rules/versions/${data.id}`);
      }
    } finally {
      setRollingBack(false);
    }
  };

  const filteredRules = rules.filter((r) => r.category === tab);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (error || !version) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-400">{error ?? "版本不存在"}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/rules/versions" className="text-gray-400 hover:text-gray-600 text-sm">规则版本</Link>
              <span className="text-gray-300">/</span>
              <h1 className="text-xl font-bold text-gray-900">
                {version.upstream} v{version.version}
              </h1>
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[version.status] ?? ""}`}>
                {version.status === "draft" ? "草稿" : version.status === "published" ? "已发布" : "已归档"}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-1">
              {version.ruleCount} 条规则 · {version.quoteVersionCount} 个关联报价版本
            </p>
          </div>
          <div className="flex gap-2">
            {version.status === "published" && (
              <Link
                href={`/rules/versions/${id}/diff`}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                版本对比
              </Link>
            )}
            {version.status === "draft" && (
              <button
                onClick={handlePublish}
                disabled={publishing || version.ruleCount === 0}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                title={version.ruleCount === 0 ? "草稿版本不能为空" : ""}
              >
                {publishing ? "发布中..." : "发布版本"}
              </button>
            )}
            {(version.status === "published" || version.status === "archived") && (
              <button
                onClick={handleRollback}
                disabled={rollingBack}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {rollingBack ? "回滚中..." : "回滚"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        {/* Version info card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-400 text-xs">创建时间</div>
            <div className="text-gray-700 mt-0.5">{new Date(version.createdAt).toLocaleString("zh-CN")}</div>
          </div>
          {version.publishedAt && (
            <>
              <div>
                <div className="text-gray-400 text-xs">发布时间</div>
                <div className="text-gray-700 mt-0.5">{new Date(version.publishedAt).toLocaleString("zh-CN")}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">发布人</div>
                <div className="text-gray-700 mt-0.5">{version.publishedBy?.name ?? "-"}</div>
              </div>
            </>
          )}
          <div>
            <div className="text-gray-400 text-xs">上游</div>
            <div className="text-gray-700 mt-0.5">{version.upstream}</div>
          </div>
        </div>

        {/* Rule tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {(["surcharge", "restriction", "compensation", "billing"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                tab === t ? "bg-white shadow text-blue-600 font-medium" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {CATEGORY_LABELS[t]} ({rules.filter((r) => r.category === t).length})
            </button>
          ))}
        </div>

        {/* Rule list */}
        {filteredRules.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-200">
            暂无{CATEGORY_LABELS[tab]}规则
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">类型</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">名称/描述</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">条件</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">金额</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">来源</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((rule) => (
                  <tr key={rule.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-600">{rule.type ?? "-"}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{rule.description ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{rule.condition ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {rule.chargeValue != null ? `${rule.chargeValue}元/${rule.chargeType === "per_kg" ? "KG" : rule.chargeType === "per_item" ? "件" : "票"}` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${rule.source === "ai" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>
                        {rule.source === "ai" ? "AI" : "手动"}
                      </span>
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
