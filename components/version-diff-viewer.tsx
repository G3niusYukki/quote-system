"use client";

interface DiffRule {
  id: string;
  category: string;
  type: string | null;
  itemType: object | null;
  chargeType: string | null;
  chargeValue: string | null;
  condition: string | null;
  description: string | null;
  content: string | null;
  priority: number;
  confidence: string;
  source: string;
  rawEvidence: string | null;
}

interface DiffEntry {
  before: DiffRule;
  after: DiffRule;
}

interface VersionDiffViewerProps {
  baseVersion: { id: string; upstream: string; version: number; status: string };
  compareVersion: { id: string; upstream: string; version: number; status: string };
  summary: { totalA: number; totalB: number; added: number; removed: number; changed: number; unchanged: number };
  added: DiffRule[];
  removed: DiffRule[];
  changed: DiffEntry[];
  unchanged: DiffRule[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-yellow-100 text-yellow-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  surcharge: "附加费",
  restriction: "限制",
  compensation: "赔偿",
  billing: "计费",
};

function RuleCard({ rule, variant = "default" }: { rule: DiffRule; variant?: "default" | "added" | "removed" | "changed-before" | "changed-after" }) {
  const borderColors: Record<string, string> = {
    default: "border-gray-200",
    added: "border-green-300 bg-green-50",
    removed: "border-red-300 bg-red-50",
    "changed-before": "border-red-300 bg-red-50",
    "changed-after": "border-blue-300 bg-blue-50",
  };
  const border = borderColors[variant];
  const labelPrefix: Record<string, string> = {
    "changed-before": "旧",
    "changed-after": "新",
  };

  return (
    <div className={`rounded-lg border p-3 ${border} text-sm`}>
      {labelPrefix[variant] && (
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded mb-2 inline-block ${variant === "changed-before" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
          {labelPrefix[variant]}
        </span>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-medium text-gray-900">
            {CATEGORY_LABELS[rule.category] ?? rule.category}
          </span>
          {rule.type && <span className="text-gray-500 ml-1">/ {rule.type}</span>}
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${rule.source === "ai" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>
          {rule.source === "ai" ? "AI" : "手动"}
        </span>
      </div>
      {rule.description && <p className="text-gray-600 mt-1">{rule.description}</p>}
      {rule.chargeType && rule.chargeValue && (
        <p className="text-gray-500 mt-1 text-xs">
          计费方式: {rule.chargeType} / 金额: {rule.chargeValue}
        </p>
      )}
      {rule.condition && (
        <p className="text-gray-400 mt-1 text-xs truncate" title={rule.condition}>
          条件: {rule.condition}
        </p>
      )}
    </div>
  );
}

export default function VersionDiffViewer({ baseVersion, compareVersion, summary, added, removed, changed, unchanged }: VersionDiffViewerProps) {
  return (
    <div className="space-y-6">
      {/* Version headers */}
      <div className="flex gap-4 items-center">
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
          <div className="text-xs text-gray-500">版本 A（基准）</div>
          <div className="font-medium text-gray-900">
            {baseVersion.upstream} v{baseVersion.version}
          </div>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLORS[baseVersion.status] ?? ""}`}>
            {baseVersion.status}
          </span>
        </div>
        <div className="text-gray-400">↔</div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
          <div className="text-xs text-gray-500">版本 B（对比）</div>
          <div className="font-medium text-gray-900">
            {compareVersion.upstream} v{compareVersion.version}
          </div>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLORS[compareVersion.status] ?? ""}`}>
            {compareVersion.status}
          </span>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: "版本A规则", value: summary.totalA },
          { label: "版本B规则", value: summary.totalB },
          { label: "新增", value: summary.added, color: "text-green-600 bg-green-50 border-green-200" },
          { label: "删除", value: summary.removed, color: "text-red-600 bg-red-50 border-red-200" },
          { label: "变更", value: summary.changed, color: "text-blue-600 bg-blue-50 border-blue-200" },
          { label: "未变", value: summary.unchanged, color: "text-gray-600 bg-gray-50 border-gray-200" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-lg border px-3 py-2 text-center ${stat.color ?? "bg-gray-50 border-gray-200"}`}>
            <div className="text-lg font-bold">{stat.value}</div>
            <div className="text-xs text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Changed rules (show first to highlight important changes) */}
      {changed.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
            <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-xs">{changed.length}</span>
            已变更
          </h3>
          <div className="space-y-3">
            {changed.map(({ before, after }) => (
              <div key={before.id} className="border border-blue-200 rounded-lg overflow-hidden">
                <div className="p-3 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 font-medium">
                  {CATEGORY_LABELS[before.category] ?? before.category} / {before.type ?? "-"} / {before.condition ?? "-"}
                </div>
                <div className="grid grid-cols-2 gap-0">
                  <div className="p-3 bg-red-50">
                    <div className="text-xs font-semibold text-red-600 mb-1">旧</div>
                    <RuleCard rule={before} variant="changed-before" />
                  </div>
                  <div className="p-3 bg-blue-50">
                    <div className="text-xs font-semibold text-blue-600 mb-1">新</div>
                    <RuleCard rule={after} variant="changed-after" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Added rules */}
      {added.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
            <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-xs">{added.length}</span>
            新增规则
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {added.map((rule) => (
              <RuleCard key={rule.id} rule={rule} variant="added" />
            ))}
          </div>
        </div>
      )}

      {/* Removed rules */}
      {removed.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
            <span className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center text-xs">{removed.length}</span>
            删除规则
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {removed.map((rule) => (
              <RuleCard key={rule.id} rule={rule} variant="removed" />
            ))}
          </div>
        </div>
      )}

      {/* Unchanged */}
      {unchanged.length > 0 && (
        <details className="group">
          <summary className="text-sm font-semibold text-gray-500 cursor-pointer list-none flex items-center gap-2">
            <span className="text-gray-400 group-open:rotate-90 transition-transform">▶</span>
            未变更规则 ({unchanged.length})
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            {unchanged.map((rule) => (
              <RuleCard key={rule.id} rule={rule} />
            ))}
          </div>
        </details>
      )}

      {changed.length === 0 && added.length === 0 && removed.length === 0 && (
        <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-200">
          两条版本完全相同
        </div>
      )}
    </div>
  );
}
