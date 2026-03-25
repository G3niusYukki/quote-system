"use client";

import { cn } from "@/lib/utils";

export type ImportJobStatus = "pending" | "processing" | "completed" | "failed";

interface ImportJobStatusBadgeProps {
  status: ImportJobStatus;
  className?: string;
}

const CONFIG: Record<ImportJobStatus, { label: string; className: string }> = {
  pending: {
    label: "等待中",
    className: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  processing: {
    label: "处理中",
    className: "bg-blue-100 text-blue-800 border-blue-300",
  },
  completed: {
    label: "已完成",
    className: "bg-green-100 text-green-800 border-green-300",
  },
  failed: {
    label: "失败",
    className: "bg-red-100 text-red-800 border-red-300",
  },
};

export function ImportJobStatusBadge({ status, className }: ImportJobStatusBadgeProps) {
  const { label, className: cfgClassName } = CONFIG[status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-800 border-gray-300",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        cfgClassName,
        className
      )}
    >
      {status === "processing" && (
        <span className="mr-1.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
      )}
      {label}
    </span>
  );
}
