"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import VersionDiffViewer from "@/components/version-diff-viewer";

interface RuleVersion {
  id: string;
  upstream: string;
  version: number;
  status: string;
}

interface DiffResult {
  versionA: RuleVersion;
  versionB: RuleVersion;
  summary: { totalA: number; totalB: number; added: number; removed: number; changed: number; unchanged: number };
  added: unknown[];
  removed: unknown[];
  changed: unknown[];
  unchanged: unknown[];
}

export default function RuleVersionDiffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compareToId, setCompareToId] = useState("");
  const [versions, setVersions] = useState<RuleVersion[]>([]);

  // Load available versions for the same upstream
  useEffect(() => {
    fetch(`/api/rule-versions?pageSize=100`)
      .then((r) => r.json())
      .then((d) => {
        setVersions(d.versions ?? []);
      });
  }, []);

  // Load the current version and set default compare target
  useEffect(() => {
    Promise.all([
      fetch(`/api/rule-versions/${id}`).then((r) => r.json()),
    ]).then(([vData]) => {
      if (!vData.error) {
        // Set default compare-to to the most recent version different from current
        const sameUpstream = (vData.versions ?? []).filter(
          (v: RuleVersion) => v.upstream === vData.upstream && v.id !== id
        );
        // Actually we need to get all versions - let's just filter from the fetched list
      }
      // Load diff with the current id as base
      const currentVersion = vData;
      // Find an archived version to compare to
      const allVersions: RuleVersion[] = versions as RuleVersion[];
      const otherVersions = allVersions.filter((v) => v.id !== id);
      const archivedOrPublished = otherVersions.find(
        (v) => v.upstream === currentVersion.upstream && (v.status === "archived" || v.status === "published")
      );
      if (archivedOrPublished) {
        setCompareToId(archivedOrPublished.id);
      }
    });
  }, [id]);

  const loadDiff = (baseId: string, compareId: string) => {
    if (!compareId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/rule-versions/${baseId}/diff?compare_to=${compareId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
        } else {
          setDiff(d);
        }
        setLoading(false);
      })
      .catch(() => { setError("加载失败"); setLoading(false); });
  };

  // Initial load or when compareToId changes
  useEffect(() => {
    if (compareToId && id) {
      loadDiff(id, compareToId);
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareToId, id]);

  // Get current version info from versions list or diff
  const currentVersion = versions.find((v) => v.id === id);
  const sameUpstreamVersions = versions.filter((v) => v.upstream === currentVersion?.upstream && v.id !== id);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/rules/versions" className="text-gray-400 hover:text-gray-600 text-sm">规则版本</Link>
              <span className="text-gray-300">/</span>
              <Link href={`/rules/versions/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">
                {currentVersion ? `${currentVersion.upstream} v${currentVersion.version}` : id}
              </Link>
              <span className="text-gray-300">/</span>
              <h1 className="text-xl font-bold text-gray-900">版本对比</h1>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={compareToId}
              onChange={(e) => setCompareToId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">选择对比版本</option>
              {sameUpstreamVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version} ({v.status === "draft" ? "草稿" : v.status === "published" ? "已发布" : "已归档"})
                </option>
              ))}
            </select>
            {compareToId && (
              <button
                onClick={() => loadDiff(id, compareToId)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                对比
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-8 text-gray-400">加载中...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-400">{error}</div>
        ) : diff ? (
          <VersionDiffViewer
            baseVersion={diff.versionA}
            compareVersion={diff.versionB}
            summary={diff.summary}
            added={diff.added as Parameters<typeof VersionDiffViewer>[0]["added"]}
            removed={diff.removed as Parameters<typeof VersionDiffViewer>[0]["removed"]}
            changed={diff.changed as Parameters<typeof VersionDiffViewer>[0]["changed"]}
            unchanged={diff.unchanged as Parameters<typeof VersionDiffViewer>[0]["unchanged"]}
          />
        ) : (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
            请选择要对比的版本
          </div>
        )}
      </main>
    </div>
  );
}
