"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-provider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DashboardStats {
  pendingReviews: number;
  todayQueries: number;
  activeVersions: number;
  totalImportJobs: number;
}

interface ImportJob {
  id: string;
  upstream: string;
  status: string;
  filename: string;
  createdAt: string;
  uploadedBy: { name: string };
  blockCount: number;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "completed": return "default";
    case "failed": return "destructive";
    case "processing": return "secondary";
    default: return "outline";
  }
}

function statusLabel(status: string) {
  return { pending: "等待中", processing: "处理中", completed: "已完成", failed: "失败" }[status] ?? status;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    pendingReviews: 0,
    todayQueries: 0,
    activeVersions: 0,
    totalImportJobs: 0,
  });
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch stats in parallel
    Promise.all([
      fetch("/api/review/issues?resolved=false&pageSize=1").then(r => r.json()).catch(() => ({ total: 0 })),
      fetch("/api/import-jobs?pageSize=5").then(r => r.json()).catch(() => ({ items: [], total: 0 })),
      fetch("/api/quote-versions?status=active").then(r => r.json()).catch(() => ({ items: [], total: 0 })),
      fetch("/api/history?today=true").then(r => r.json()).catch(() => ({ count: 0 })),
    ]).then(([reviewData, jobsData, versionsData, historyData]) => {
      setStats({
        pendingReviews: reviewData.total ?? 0,
        totalImportJobs: jobsData.total ?? 0,
        activeVersions: versionsData.total ?? 0,
        todayQueries: historyData.count ?? 0,
      });
      setJobs((jobsData.items ?? []).slice(0, 5));
      setLoading(false);
    });
  }, []);

  const statCards: Array<{ label: string; value: number; icon: React.ReactNode; color: string }> = [
    {
      label: "待审核",
      value: stats.pendingReviews,
      color: "text-orange-600 bg-orange-50",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      label: "今日询价",
      value: stats.todayQueries,
      color: "text-blue-600 bg-blue-50",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      label: "活跃版本",
      value: stats.activeVersions,
      color: "text-green-600 bg-green-50",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      label: "导入任务",
      value: stats.totalImportJobs,
      color: "text-purple-600 bg-purple-50",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {user ? `你好，${user.name}` : "控制台"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {user?.organization?.name ? `团队：${user.organization.name}` : "欢迎使用快递报价系统"}
          </p>
        </div>
        <Link href="/quotes/calculate">
          <Button>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            快速询价
          </Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {loading ? "—" : card.value}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                  {card.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent import jobs */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">最近导入任务</CardTitle>
          <Link href="/import-jobs" className="text-sm text-blue-600 hover:underline">
            查看全部
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              暂无导入任务
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/import-jobs/${job.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                        {job.filename || job.upstream}
                      </p>
                      <Badge variant={statusBadgeVariant(job.status)}>
                        {statusLabel(job.status)}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {job.uploadedBy?.name ?? "未知"} · {formatDate(job.createdAt)} · {job.blockCount} 个数据块
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
