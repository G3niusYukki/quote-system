"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AuditLogRow, { type AuditLogEntry } from "@/components/audit-log-row";

// All possible action prefixes for filter dropdown
const ACTION_GROUPS = [
  { label: "全部操作", value: "" },
  { label: "认证 (auth)", value: "auth" },
  { label: "导入任务 (import_job)", value: "import_job" },
  { label: "规则 (rule)", value: "rule" },
  { label: "报价版本 (quote_version)", value: "quote_version" },
  { label: "字典 (dictionary)", value: "dictionary" },
  { label: "成员 (member)", value: "member" },
  { label: "组织 (organization)", value: "organization" },
];

const ENTITY_TYPES = [
  { label: "全部实体", value: "" },
  { label: "导入任务", value: "import_job" },
  { label: "规则", value: "rule" },
  { label: "报价版本", value: "quote_version" },
  { label: "字典", value: "dictionary" },
  { label: "成员", value: "member" },
  { label: "组织", value: "organization" },
  { label: "用户", value: "user" },
];

interface AuditLogResponse {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(20);

  const fetchLogs = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("page_size", String(pageSize));
      if (actionFilter) params.set("action", actionFilter);
      if (entityTypeFilter) params.set("entity_type", entityTypeFilter);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);

      try {
        const res = await fetch(`/api/audit-logs?${params.toString()}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const data: AuditLogResponse = await res.json();
        setLogs(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setPage(data.page);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    },
    [actionFilter, entityTypeFilter, startDate, endDate, pageSize]
  );

  useEffect(() => {
    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, entityTypeFilter, startDate, endDate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const handleReset = () => {
    setActionFilter("");
    setEntityTypeFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    // Trigger re-fetch via useEffect
  };

  // Navigate to a specific page
  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    fetchLogs(p);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">审计日志</h1>
            <p className="text-gray-500 text-sm">记录所有关键操作变更历史</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/settings" className="text-blue-600 hover:underline">设置</Link>
            <Link href="/upload" className="text-blue-600 hover:underline">上传</Link>
            <Link href="/query" className="text-blue-600 hover:underline">查询</Link>
            <Link href="/rules" className="text-blue-600 hover:underline">规则</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Filters */}
        <form
          onSubmit={handleSearch}
          className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-3 items-end"
        >
          {/* Action filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 font-medium">操作类型</label>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ACTION_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          {/* Entity type filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 font-medium">实体类型</label>
            <select
              value={entityTypeFilter}
              onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 font-medium">开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 font-medium">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 self-end">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              搜索
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors"
            >
              重置
            </button>
          </div>
        </form>

        {/* Results summary */}
        {!loading && !error && (
          <div className="text-sm text-gray-400 mb-4">
            共 {total} 条记录
            {actionFilter && ` · 筛选: ${actionFilter}`}
            {entityTypeFilter && ` · 实体: ${entityTypeFilter}`}
            {startDate && ` · 从 ${startDate}`}
            {endDate && ` 至 ${endDate}`}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">
            加载失败: {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
        )}

        {/* Empty state */}
        {!loading && !error && logs.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200 text-gray-400">
            暂无审计日志记录
          </div>
        )}

        {/* Log list */}
        {!loading && !error && logs.length > 0 && (
          <div className="space-y-3">
            {logs.map((log) => (
              <AuditLogRow key={log.id} log={log} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              上一页
            </button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${
                    pageNum === page
                      ? "bg-blue-600 text-white"
                      : "border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              下一页
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
