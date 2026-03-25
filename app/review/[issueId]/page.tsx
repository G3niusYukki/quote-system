"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReviewCard from "@/components/review-card";
import RuleInlineEditor from "@/components/rule-inline-editor";
import type { ReviewCardData } from "@/components/review-card";

export default function ReviewIssuePage() {
  const params = useParams();
  const router = useRouter();
  const issueId = params.issueId as string;

  const [issue, setIssue] = useState<ReviewCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [correctMode, setCorrectMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/review/issues?resolved=false&pageSize=100`)
      .then((r) => r.json())
      .then((d) => {
        const found = (d.items || []).find((item: ReviewCardData) => item.id === issueId);
        setIssue(found || null);
        if (!found) setError("Issue not found or already resolved");
      })
      .catch(() => setError("Failed to load issue"))
      .finally(() => setLoading(false));
  }, [issueId]);

  const handleAction = async (
    action: "accept" | "correct" | "unresolvable",
    corrections?: Record<string, unknown>
  ) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/review/issues/${issueId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, corrections }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resolve");

      // Redirect back to review queue
      router.push("/review");
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  };

  const handleCorrectConfirm = async (corrections: Record<string, unknown>) => {
    await handleAction("correct", corrections);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (error && !issue) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
            <Link href="/review" className="text-blue-600 hover:underline text-sm">← 审核队列</Link>
            <span className="text-gray-400">|</span>
            <span className="text-sm text-gray-500">问题详情</span>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">{error}</div>
        </div>
      </div>
    );
  }

  if (!issue) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/review" className="text-blue-600 hover:underline text-sm">← 审核队列</Link>
          <span className="text-gray-400">|</span>
          <span className="text-sm text-gray-500">问题详情</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <ReviewCard
          issue={issue}
          onAction={handleAction}
          onCorrect={() => setCorrectMode(true)}
        >
          {correctMode && (
            <RuleInlineEditor
              initial={issue.aiExtraction}
              onConfirm={handleCorrectConfirm}
              onCancel={() => setCorrectMode(false)}
              submitting={submitting}
            />
          )}
        </ReviewCard>
      </main>
    </div>
  );
}
