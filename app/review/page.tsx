"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { ReviewCardData } from "@/components/review-card";

const ISSUE_TYPE_LABELS: Record<string, string> = {
  unclear_header: "表头不清",
  cross_sheet: "跨Sheet数据",
  conflict: "数据冲突",
  missing_field: "字段缺失",
  ambiguous_condition: "条件歧义",
};

interface IssueCount {
  issueType: string;
  count: number;
}

interface GroupStats {
  issueType: string;
  label: string;
  count: number;
}

export default function ReviewPage() {
  const [stats, setStats] = useState<GroupStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUnresolved, setTotalUnresolved] = useState(0);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [issues, setIssues] = useState<ReviewCardData[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingIssues, setLoadingIssues] = useState(false);

  useEffect(() => {
    fetch("/api/review/issues?resolved=false&pageSize=1")
      .then((r) => r.json())
      .then((d) => {
        const grouped: Record<string, number> = {};
        let total = 0;
        // Count by issueType from all unresolved items (fetch first page with high pageSize)
        return fetch(`/api/review/issues?resolved=false&pageSize=200`)
          .then((r) => r.json())
          .then((all) => {
            (all.items || []).forEach((item: ReviewCardData) => {
              grouped[item.issueType] = (grouped[item.issueType] || 0) + 1;
              total++;
            });
            setTotalUnresolved(total);
            const statList: GroupStats[] = Object.entries(grouped).map(([issueType, count]) => ({
              issueType,
              label: ISSUE_TYPE_LABELS[issueType] ?? issueType,
              count,
            }));
            setStats(statList.sort((a, b) => b.count - a.count));
          });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadIssues = (type: string | null, pageNum: number) => {
    setLoadingIssues(true);
    const url = `/api/review/issues?resolved=false&page=${pageNum}${type ? `&issue_type=${type}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setIssues(d.items || []);
        setTotalPages(d.totalPages || 1);
        setPage(pageNum);
      })
      .catch(() => setIssues([]))
      .finally(() => setLoadingIssues(false));
  };

  useEffect(() => {
    loadIssues(selectedType, 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType]);

  const handleRefresh = () => {
    loadIssues(selectedType, page);
    // Also refresh stats
    fetch("/api/review/issues?resolved=false&pageSize=200")
      .then((r) => r.json())
      .then((all) => {
        const grouped: Record<string, number> = {};
        (all.items || []).forEach((item: ReviewCardData) => {
          grouped[item.issueType] = (grouped[item.issueType] || 0) + 1;
        });
        const statList: GroupStats[] = Object.entries(grouped).map(([issueType, count]) => ({
          issueType,
          label: ISSUE_TYPE_LABELS[issueType] ?? issueType,
          count,
        }));
        setStats(statList.sort((a, b) => b.count - a.count));
        setTotalUnresolved((all.items || []).length);
      });
  };

  const handleAction = async (action: "accept" | "correct" | "unresolvable", corrections?: Record<string, unknown>) => {
    // Refresh after action
    handleRefresh();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">审核队列</h1>
            <p className="text-gray-500 text-sm">审阅低置信度 AI 提取结果</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/rules" className="text-blue-600 hover:underline">规则</Link>
            <Link href="/upload" className="text-blue-600 hover:underline">上传</Link>
            <Link href="/query" className="text-blue-600 hover:underline">查询</Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Stats by issue type */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            问题类型统计
            <span className="ml-2 text-gray-400 font-normal">
              {loading ? "加载中..." : `共 ${totalUnresolved} 条待审`}
            </span>
          </h2>
          {loading ? (
            <div className="text-gray-400 text-sm">加载中...</div>
          ) : stats.length === 0 ? (
            <div className="text-gray-400 text-sm">暂无待审问题</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button
                onClick={() => setSelectedType(null)}
                className={`text-left p-3 rounded-lg border ${
                  selectedType === null
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="text-xs text-gray-500">全部</div>
                <div className="text-2xl font-bold text-gray-900">{totalUnresolved}</div>
              </button>
              {stats.map((s) => (
                <button
                  key={s.issueType}
                  onClick={() => setSelectedType(s.issueType)}
                  className={`text-left p-3 rounded-lg border ${
                    selectedType === s.issueType
                      ? "border-blue-300 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="text-xs text-gray-500">{s.label}</div>
                  <div className="text-2xl font-bold text-gray-900">{s.count}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Issue list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              {selectedType
                ? ISSUE_TYPE_LABELS[selectedType] ?? selectedType
                : "全部待审"}
              <span className="ml-2 text-gray-400 font-normal">
                {loadingIssues ? "加载中..." : `${issues.length} 条`}
              </span>
            </h2>
            <button
              onClick={handleRefresh}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              刷新
            </button>
          </div>

          {loadingIssues ? (
            <div className="text-center py-8 text-gray-400">加载中...</div>
          ) : issues.length === 0 ? (
            <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-200">
              暂无待审问题
            </div>
          ) : (
            <div className="space-y-4">
              {issues.map((issue) => (
                <Link key={issue.id} href={`/review/${issue.id}`} className="block">
                  <IssueListItem issue={issue} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => loadIssues(selectedType, p)}
                className={`px-3 py-1.5 text-sm rounded-lg border ${
                  page === p
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function IssueListItem({ issue }: { issue: ReviewCardData }) {
  const [ai] = useState(issue.aiExtraction);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              {ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}
            </span>
            <span className="text-xs text-gray-400">
              {issue.block.sheetName}
              {issue.block.rowRange && ` · 行${issue.block.rowRange}`}
            </span>
            {issue.block.importJob && (
              <span className="text-xs text-gray-400">{issue.block.importJob.upstream}</span>
            )}
          </div>
          <p className="text-sm text-gray-700 truncate font-mono">{issue.rawSegment || issue.block.rawText}</p>
          <div className="mt-1.5 text-xs text-gray-500">
            <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
              AI: {ai?.category ?? "-"} / {ai?.type ?? "-"}
            </span>
            {ai?.chargeValue != null && (
              <span className="ml-2 text-gray-400">
                {ai.chargeValue}{ai.chargeType === "per_kg" ? "元/KG" : ai.chargeType === "per_item" ? "元/件" : "元"}
              </span>
            )}
          </div>
        </div>
        <div className="text-blue-500 text-sm">查看 →</div>
      </div>
    </div>
  );
}
