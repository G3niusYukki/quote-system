"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ImportJobStatusBadge } from "@/components/import-job-status-badge";
import type { ImportJobStatus } from "@/components/import-job-status-badge";

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

async function fetchImportJobs(page = 1, pageSize = 20): Promise<{
  items: ImportJob[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const res = await fetch(`/api/import-jobs?page=${page}&pageSize=${pageSize}`);
  if (!res.ok) throw new Error("Failed to fetch import jobs");
  return res.json();
}

export default function ImportJobsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["import-jobs"],
    queryFn: () => fetchImportJobs(1, 20),
    refetchInterval: (q) => {
      // Keep polling if any job is processing
      const jobs = q.state.data?.items ?? [];
      const hasProcessing = jobs.some((j: ImportJob) => j.status === "processing" || j.status === "pending");
      return hasProcessing ? 2000 : false;
    },
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">导入任务</h1>
          <p className="text-sm text-gray-500 mt-1">管理报价表导入任务，查看解析状态和切片详情</p>
        </div>
        <Link
          href="/import-jobs/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          新建导入任务
        </Link>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-gray-500">
          <span className="animate-pulse">加载中...</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          加载失败: {(error as Error).message}
        </div>
      )}

      {data?.items && (
        <>
          <div className="text-sm text-gray-500">
            共 {data.total} 个任务
          </div>

          {data.items.length === 0 ? (
            <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-lg font-medium">暂无导入任务</p>
              <p className="mt-1 text-sm">点击上方按钮上传第一个报价表</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">文件名</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">上游</th>
                    <th className="px-4 py-3 font-medium">上传者</th>
                    <th className="px-4 py-3 font-medium">切片数</th>
                    <th className="px-4 py-3 font-medium">创建时间</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.items.map((job: ImportJob) => (
                    <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs max-w-[200px] truncate" title={job.filename}>
                        {job.filename}
                      </td>
                      <td className="px-4 py-3">
                        <ImportJobStatusBadge status={job.status as ImportJobStatus} />
                      </td>
                      <td className="px-4 py-3 text-gray-700">{job.upstream}</td>
                      <td className="px-4 py-3 text-gray-500">{job.uploadedBy?.name ?? job.uploadedBy?.email ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{job.blockCount}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(job.createdAt).toLocaleString("zh-CN")}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/import-jobs/${job.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          查看详情
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.totalPages > 1 && (
            <div className="flex justify-center gap-2 text-sm">
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
                <span key={p} className="px-3 py-1 rounded border text-gray-600 bg-white">
                  {p}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

