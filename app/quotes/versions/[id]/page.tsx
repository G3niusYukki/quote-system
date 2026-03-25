"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface QuoteVersionDetail {
  id: string;
  upstream: string;
  version: number;
  status: string;
  ruleVersionId: string;
  ruleVersion: { id: string; version: number; upstream: string; status: string } | null;
  publishedBy: { id: string; name: string; email: string } | null;
  publishedAt: string | null;
  createdAt: string;
  quoteCount: number;
  surchargeCount: number;
  billingRuleCount: number;
  restrictionCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-yellow-100 text-yellow-700",
};

export default function QuoteVersionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [version, setVersion] = useState<QuoteVersionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  useEffect(() => {
    fetch(`/api/quote-versions/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
        } else {
          setVersion(d);
        }
        setLoading(false);
      })
      .catch(() => { setError("加载失败"); setLoading(false); });
  }, [id]);

  const handlePublish = async () => {
    if (!confirm("确认发布此报价版本？旧版本将自动归档。")) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/quote-versions/${id}/publish`, { method: "POST" });
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
    if (!confirm("确认回滚？将基于上一个归档报价版本创建新草稿。")) return;
    setRollingBack(true);
    try {
      const res = await fetch(`/api/quote-versions/${id}/rollback`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert(`回滚成功！已创建新草稿版本 v${data.version}。`);
        router.push(`/quotes/versions/${data.id}`);
      }
    } finally {
      setRollingBack(false);
    }
  };

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
              <Link href="/quotes/versions" className="text-gray-400 hover:text-gray-600 text-sm">报价版本</Link>
              <span className="text-gray-300">/</span>
              <h1 className="text-xl font-bold text-gray-900">
                {version.upstream} 报价 v{version.version}
              </h1>
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[version.status] ?? ""}`}>
                {version.status === "draft" ? "草稿" : version.status === "published" ? "已发布" : "已归档"}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-1">
              {version.quoteCount} 条渠道报价 · {version.surchargeCount} 附加费 · {version.billingRuleCount} 计费规则 · {version.restrictionCount} 限制
            </p>
          </div>
          <div className="flex gap-2">
            {version.ruleVersion && (
              <Link
                href={`/rules/versions/${version.ruleVersion.id}`}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                查看规则版本
              </Link>
            )}
            {version.status === "draft" && (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {publishing ? "发布中..." : "发布报价版本"}
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
          {version.ruleVersion && (
            <div>
              <div className="text-gray-400 text-xs">关联规则版本</div>
              <div className="text-gray-700 mt-0.5">
                {version.ruleVersion.upstream} v{version.ruleVersion.version}
              </div>
            </div>
          )}
        </div>

        {/* Counts summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "渠道报价", value: version.quoteCount, color: "bg-blue-50 border-blue-200 text-blue-700" },
            { label: "附加费", value: version.surchargeCount, color: "bg-orange-50 border-orange-200 text-orange-700" },
            { label: "计费规则", value: version.billingRuleCount, color: "bg-purple-50 border-purple-200 text-purple-700" },
            { label: "限制规则", value: version.restrictionCount, color: "bg-red-50 border-red-200 text-red-700" },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-lg border px-4 py-3 text-center ${stat.color}`}>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs mt-0.5 opacity-75">{stat.label}</div>
            </div>
          ))}
        </div>

        {version.status === "draft" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            此版本为草稿状态，报价数据正在编辑中。编辑完成后点击「发布报价版本」使其生效。
          </div>
        )}
      </main>
    </div>
  );
}
