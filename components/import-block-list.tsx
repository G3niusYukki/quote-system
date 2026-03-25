"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ImportJobStatusBadge } from "./import-job-status-badge";

interface ImportJob {
  id: string;
  filename: string;
  status: string;
  upstream: string;
  uploadedBy: { id: string; name: string | null; email: string } | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  blockCount: number;
}

interface ImportJobListResponse {
  items: ImportJob[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

async function fetchImportJobs(page = 1, pageSize = 20): Promise<ImportJobListResponse> {
  const res = await fetch(`/api/import-jobs?page=${page}&pageSize=${pageSize}`);
  if (!res.ok) throw new Error("Failed to fetch import jobs");
  return res.json();
}

export function ImportBlockList({ jobId }: { jobId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["import-blocks", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/import-jobs/${jobId}/blocks?pageSize=100`);
      if (!res.ok) throw new Error("Failed to fetch blocks");
      return res.json();
    },
    refetchInterval: (q) => {
      // Poll while job is still processing
      const data = q.state.data?.data;
      return data ? false : 2000;
    },
  });

  if (isLoading) return <div className="text-sm text-gray-500">加载中...</div>;
  if (!data?.items?.length) return <div className="text-sm text-gray-500">暂无切片数据</div>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="pb-2 pr-4 font-medium">Sheet</th>
            <th className="pb-2 pr-4 font-medium">类型</th>
            <th className="pb-2 pr-4 font-medium">行范围</th>
            <th className="pb-2 pr-4 font-medium">置信度</th>
            <th className="pb-2 font-medium">需审核</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.items.map((block: {
            id: string;
            sheetName: string;
            blockType: string;
            rowRange: string | null;
            confidence: number;
            needsReview: boolean;
          }) => (
            <tr key={block.id} className="hover:bg-gray-50">
              <td className="py-2 pr-4 font-mono text-xs">{block.sheetName}</td>
              <td className="py-2 pr-4">
                <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs">
                  {block.blockType}
                </span>
              </td>
              <td className="py-2 pr-4 text-gray-500">{block.rowRange ?? "—"}</td>
              <td className="py-2 pr-4">
                <ConfidenceBar score={block.confidence} />
              </td>
              <td className="py-2">
                {block.needsReview ? (
                  <span className="text-amber-600 text-xs font-medium">是</span>
                ) : (
                  <span className="text-green-600 text-xs">否</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfidenceBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-green-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-gray-600">{score}</span>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}
