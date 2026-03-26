"use client";

export const dynamic = "force-dynamic";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ImportJobStatusBadge } from "@/components/import-job-status-badge";
import { ImportBlockList } from "@/components/import-block-list";

interface ImportJobDetail {
  id: string;
  filename: string;
  status: string;
  upstream: string;
  checksum: string;
  uploadedBy: { id: string; name: string | null; email: string } | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  blockCount: number;
  needsReviewCount: number;
  issueCounts: { issueType: string; count: number }[];
  blocks: {
    id: string;
    blockType: string;
    sheetName: string;
    rowRange: string | null;
    confidence: number;
    needsReview: boolean;
    createdAt: string;
  }[];
}

type Tab = "blocks" | "issues" | "preview";

async function fetchJob(id: string): Promise<ImportJobDetail> {
  const res = await fetch(`/api/import-jobs/${id}`);
  if (!res.ok) throw new Error("Failed to fetch job");
  return res.json();
}

export default function ImportJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<Tab>("blocks");
  const [issuePage, setIssuePage] = useState(1);
  const queryClient = useQueryClient();

  const { data: job, isLoading } = useQuery({
    queryKey: ["import-job", id],
    queryFn: () => fetchJob(id),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === "pending" || status === "processing" ? 2000 : false;
    },
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/import-jobs/${id}/retry`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Retry failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-job", id] });
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/import-jobs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      window.location.href = "/import-jobs";
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <span className="animate-pulse">加载中...</span>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        任务不存在或无权访问
      </div>
    );
  }

  const isRetryable = job.status === "failed";
  const isPending = job.status === "pending";
  const isProcessing = job.status === "processing";

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <Link href="/dashboard" className="hover:text-gray-600">🏠 首页</Link>
            <span>/</span>
            <Link href="/import-jobs" className="hover:text-blue-600">导入任务</Link>
            <span>/</span>
            <span className="text-gray-500">{job.filename}</span>
          </div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{job.filename}</h1>
            <ImportJobStatusBadge status={job.status as "pending" | "processing" | "completed" | "failed"} />
          </div>
          <div className="flex gap-4 text-sm text-gray-500">
            <span>上游: <strong className="text-gray-700">{job.upstream}</strong></span>
            <span>切片: <strong className="text-gray-700">{job.blockCount}</strong></span>
            {job.needsReviewCount > 0 && (
              <span className="text-amber-600">待审核: <strong>{job.needsReviewCount}</strong></span>
            )}
            <span>上传者: <strong className="text-gray-700">{job.uploadedBy?.name ?? job.uploadedBy?.email ?? "—"}</strong></span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {new Date(job.createdAt).toLocaleString("zh-CN")}
            {job.completedAt && ` → ${new Date(job.completedAt).toLocaleString("zh-CN")}`}
          </div>
        </div>

        <div className="flex gap-2">
          {isRetryable && (
            <button
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {retryMutation.isPending ? "重试中..." : "重试任务"}
            </button>
          )}
          <button
            onClick={() => {
              if (confirm("确定删除此导入任务？")) deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 bg-white text-red-600 text-sm font-medium border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {deleteMutation.isPending ? "删除中..." : "删除"}
          </button>
          <Link
            href="/import-jobs"
            className="px-4 py-2 bg-white text-gray-700 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            返回列表
          </Link>
        </div>
      </div>

      {/* Error message */}
      {job.errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-sm font-medium text-red-800">错误信息</div>
          <div className="text-sm text-red-700 mt-1 font-mono">{job.errorMessage}</div>
        </div>
      )}

      {/* Issue summary chips */}
      {job.issueCounts.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {job.issueCounts.map((ic) => (
            <span
              key={ic.issueType}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700"
            >
              {ic.issueType}
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-300 text-amber-900 text-[10px] font-bold">
                {ic.count}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {(["blocks", "issues", "preview"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "blocks" ? `切片 (${job.blockCount})` :
               t === "issues" ? `问题 (${job.issueCounts.reduce((s, ic) => s + ic.count, 0)})` :
               "预览"}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {tab === "blocks" && (
          <div className="space-y-4">
            {isPending || isProcessing ? (
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                </span>
                {isPending ? "任务等待中，即将开始处理..." : "正在解析中，请稍候..."}
              </div>
            ) : null}
            <ImportBlockList jobId={id} />
          </div>
        )}

        {tab === "issues" && (
          <IssuesPanel jobId={id} issuePage={issuePage} onPageChange={setIssuePage} />
        )}

        {tab === "preview" && (
          <PreviewPanel jobId={id} />
        )}
      </div>
    </div>
  );
}

// ─── Issues Panel ─────────────────────────────────────────────────────────────
function IssuesPanel({
  jobId,
  issuePage,
  onPageChange,
}: {
  jobId: string;
  issuePage: number;
  onPageChange: (p: number) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["import-job-issues", jobId, issuePage],
    queryFn: async () => {
      const res = await fetch(
        `/api/import-jobs/${jobId}/issues?page=${issuePage}&pageSize=20`
      );
      if (!res.ok) throw new Error("Failed to fetch issues");
      return res.json();
    },
  });

  const ISSUE_LABELS: Record<string, string> = {
    unclear_header: "表头不清晰",
    missing_field: "缺少字段",
    conflict: "版本冲突",
    cross_sheet: "跨Sheet关联",
    ambiguous_condition: "条件不明确",
  };

  if (isLoading) return <div className="text-sm text-gray-500">加载中...</div>;

  if (!data?.items?.length) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-3xl mb-2">✅</div>
        <p>暂无置信度问题</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.items.map((issue: {
        id: string;
        issueType: string;
        reason: string | null;
        suggestedFix: string | null;
        rawSegment: string;
        resolvedAt: string | null;
        block: { sheetName: string; blockType: string; rowRange: string | null };
      }) => (
        <div key={issue.id} className="border rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {ISSUE_LABELS[issue.issueType] ?? issue.issueType}
            </span>
            <span className="text-xs text-gray-500">
              {issue.block.sheetName} {issue.block.rowRange ? `· ${issue.block.rowRange}` : ""}
            </span>
            {issue.resolvedAt && (
              <span className="ml-auto text-xs text-green-600">已处理</span>
            )}
          </div>
          {issue.reason && (
            <p className="text-sm text-gray-700">{issue.reason}</p>
          )}
          {issue.suggestedFix && (
            <p className="text-xs text-blue-600">建议: {issue.suggestedFix}</p>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-400 hover:text-gray-600">
              查看原文片段
            </summary>
            <pre className="mt-1 p-2 bg-gray-50 rounded border text-gray-600 whitespace-pre-wrap break-all">
              {issue.rawSegment.slice(0, 500)}
            </pre>
          </details>
        </div>
      ))}

      {data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={issuePage <= 1}
            onClick={() => onPageChange(issuePage - 1)}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >
            上一页
          </button>
          <span className="px-3 py-1 text-sm text-gray-500">
            第 {issuePage} / {data.totalPages} 页
          </span>
          <button
            disabled={issuePage >= data.totalPages}
            onClick={() => onPageChange(issuePage + 1)}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Preview Panel ─────────────────────────────────────────────────────────────
function PreviewPanel({ jobId }: { jobId: string }) {
  const { data: job, isLoading } = useQuery({
    queryKey: ["import-job", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/import-jobs/${jobId}`);
      if (!res.ok) throw new Error("Failed to fetch job");
      return res.json();
    },
  });

  if (isLoading) return <div className="text-sm text-gray-500">加载中...</div>;
  if (!job) return null;

  const pricingBlocks = (job.blocks ?? []).filter((b: { blockType: string }) => b.blockType === "pricing");
  const surchargeBlocks = (job.blocks ?? []).filter((b: { blockType: string }) => b.blockType === "surcharge");
  const restrictionBlocks = (job.blocks ?? []).filter((b: { blockType: string }) => b.blockType === "restriction");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          切片概览 <span className="font-normal text-gray-400">({job.blockCount} 个)</span>
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "报价切片", count: pricingBlocks.length, color: "bg-blue-50 border-blue-200 text-blue-700" },
            { label: "附加费切片", count: surchargeBlocks.length, color: "bg-amber-50 border-amber-200 text-amber-700" },
            { label: "限制切片", count: restrictionBlocks.length, color: "bg-red-50 border-red-200 text-red-700" },
          ].map(({ label, count, color }) => (
            <div key={label} className={`rounded-xl border p-4 text-center ${color}`}>
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs mt-1 opacity-80">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {job.status !== "completed" && (
        <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-500 text-center">
          预览将在任务完成后显示
        </div>
      )}
    </div>
  );
}
