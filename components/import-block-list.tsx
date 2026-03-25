"use client";

import { useQuery } from "@tanstack/react-query";

interface ImportJobDetailResponse {
  id: string;
  status: string;
  blocks: Array<{
    id: string;
    blockType: string;
    sheetName: string;
    rowRange: string | null;
    confidence: number;
    needsReview: boolean;
  }>;
  blockCount: number;
}

async function fetchImportJobDetail(jobId: string): Promise<ImportJobDetailResponse> {
  const res = await fetch(`/api/import-jobs/${jobId}`);
  if (!res.ok) throw new Error("Failed to fetch job detail");
  return res.json();
}

export function ImportBlockList({ jobId }: { jobId: string }) {
  const { data, isLoading } = useQuery({
    // Fetch from job detail endpoint so we have both status (for polling) and blocks
    queryKey: ["import-job-detail", jobId],
    queryFn: () => fetchImportJobDetail(jobId),
    refetchInterval: (q) => {
      // Poll while the job is still processing/pending, stop when completed/failed
      const status = q.state.data?.status;
      return (status === "processing" || status === "pending") ? 2000 : false;
    },
  });

  if (isLoading) return <div className="text-sm text-gray-500">加载中...</div>;
  if (!data?.blocks?.length) return <div className="text-sm text-gray-500">暂无切片数据</div>;

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
          {data.blocks.map((block) => (
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
