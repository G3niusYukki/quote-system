"use client";

import { useState } from "react";

interface AiExtraction {
  category?: string;
  type?: string;
  chargeType?: string;
  chargeValue?: number | string;
  condition?: string;
  description?: string;
  content?: string;
  itemType?: string | string[];
  [key: string]: unknown;
}

export interface ReviewCardData {
  id: string;
  issueType: string;
  rawSegment: string;
  aiExtraction: AiExtraction;
  reason: string | null;
  suggestedFix: string | null;
  resolvedAt: string | null;
  resolvedBy?: { id: string; name: string; email: string } | null;
  block: {
    id: string;
    blockType: string;
    sheetName: string;
    rowRange: string | null;
    rawText: string;
    confidence: number;
    needsReview: boolean;
    importJob?: { id: string; upstream: string; filename: string };
  };
}

interface ReviewCardProps {
  issue: ReviewCardData;
  onAction: (action: "accept" | "correct" | "unresolvable", corrections?: Record<string, unknown>) => Promise<void>;
  onCorrect?: () => void;
  children?: React.ReactNode; // rule-inline-editor for correct mode
}

const ISSUE_TYPE_LABELS: Record<string, string> = {
  unclear_header: "表头不清",
  cross_sheet: "跨Sheet数据",
  conflict: "数据冲突",
  missing_field: "字段缺失",
  ambiguous_condition: "条件歧义",
};

const CATEGORY_LABELS: Record<string, string> = {
  surcharge: "附加费",
  restriction: "限制",
  compensation: "赔偿",
  billing: "计费",
};

function JsonView({ data }: { data: unknown }) {
  return (
    <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function ReviewCard({ issue, onAction, onCorrect, children }: ReviewCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: "accept" | "correct" | "unresolvable") => {
    if (action === "correct") {
      onCorrect?.();
      return;
    }
    setLoading(action);
    setError(null);
    try {
      await onAction(action);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(null);
    }
  };

  const isResolved = !!issue.resolvedAt;

  return (
    <div className={`bg-white rounded-xl border ${isResolved ? "border-gray-200 opacity-75" : "border-gray-200"}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            isResolved
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}>
            {isResolved ? "已审阅" : ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}
          </span>
          <span className="text-xs text-gray-400">
            {issue.block.sheetName}
            {issue.block.rowRange && ` · 行${issue.block.rowRange}`}
            {issue.block.importJob && ` · ${issue.block.importJob.upstream}`}
          </span>
        </div>
        {issue.resolvedBy && (
          <span className="text-xs text-gray-400">
            审阅人：{issue.resolvedBy.name}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* 四要素 */}
        {/* 1. 原文片段 */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1.5">原文片段</h4>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap font-mono">
            {issue.rawSegment || issue.block.rawText || "-"}
          </div>
        </div>

        {/* 2. AI 提取结果 */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1.5">AI 提取结果</h4>
          <JsonView data={issue.aiExtraction} />
        </div>

        {/* 3. 判低置信度原因 */}
        {issue.reason && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1.5">判低置信度原因</h4>
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700">
              {issue.reason}
            </div>
          </div>
        )}

        {/* 4. 建议修正项 */}
        {issue.suggestedFix && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1.5">建议修正项</h4>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
              {issue.suggestedFix}
            </div>
          </div>
        )}

        {/* Inline editor slot for correct mode */}
        {children && (
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
            <h4 className="text-xs font-semibold text-blue-600 uppercase mb-3">修正字段值</h4>
            {children}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      {/* Actions */}
      {!isResolved && (
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 justify-end">
          <button
            onClick={() => handleAction("unresolvable")}
            disabled={!!loading}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading === "unresolvable" ? "处理中..." : "无法解析"}
          </button>
          <button
            onClick={() => handleAction("correct")}
            disabled={!!loading}
            className="px-4 py-2 text-sm border border-blue-300 rounded-lg text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            {loading === "correct" ? "处理中..." : "修正"}
          </button>
          <button
            onClick={() => handleAction("accept")}
            disabled={!!loading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading === "accept" ? "处理中..." : "采纳 AI"}
          </button>
        </div>
      )}
    </div>
  );
}
