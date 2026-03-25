"use client";

interface SurchargeResult {
  type: string;
  name: string;
  amount: number;
  calculation: string;
  rule_id: string;
  raw_evidence: string | null;
  hit_reason: string;
}

interface UnmatchedSurcharge {
  type: string;
  rule_id: string;
  reason: string;
}

interface SurchargeBreakdownProps {
  matched: SurchargeResult[];
  unmatched: UnmatchedSurcharge[];
}

const CATEGORY_COLORS: Record<string, string> = {
  remote: "text-purple-600 bg-purple-50 border-purple-100",
  oversize: "text-orange-600 bg-orange-50 border-orange-100",
  overweight: "text-red-600 bg-red-50 border-red-100",
  item_type: "text-blue-600 bg-blue-50 border-blue-100",
  private_address: "text-green-600 bg-green-50 border-green-100",
  other: "text-gray-600 bg-gray-50 border-gray-100",
};

const CATEGORY_ICONS: Record<string, string> = {
  remote: "🏔️",
  oversize: "📦",
  overweight: "⚖️",
  item_type: "🏷️",
  private_address: "🏠",
  other: "➕",
};

export default function SurchargeBreakdown({ matched, unmatched }: SurchargeBreakdownProps) {
  const totalSurcharge = matched.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-4">
      {/* Matched surcharges */}
      {matched.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-700">附加费明细</h4>
            <span className="text-sm font-bold text-orange-500">
              +¥{totalSurcharge.toFixed(2)}
            </span>
          </div>
          <div className="space-y-2">
            {matched.map((s) => {
              const colorClass = CATEGORY_COLORS[s.type] ?? CATEGORY_COLORS.other;
              const icon = CATEGORY_ICONS[s.type] ?? "➕";
              return (
                <div
                  key={s.rule_id}
                  className={`rounded-lg border p-3 ${colorClass}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <span className="text-base mt-0.5">{icon}</span>
                      <div>
                        <div className="font-medium text-sm">{s.name}</div>
                        <div className="text-xs opacity-75 mt-0.5">
                          {s.hit_reason}
                        </div>
                        <div className="text-xs opacity-60 mt-0.5">
                          计算: {s.calculation}
                        </div>
                        {s.raw_evidence && (
                          <div
                            className="text-xs opacity-50 mt-1 italic max-w-xs truncate"
                            title={s.raw_evidence}
                          >
                            原文: {s.raw_evidence}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="font-bold text-sm whitespace-nowrap">
                      +¥{s.amount.toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unmatched surcharges (debug / explainable mode) */}
      {unmatched.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-400 mb-2">
            未命中规则（不收费）
          </h4>
          <div className="space-y-1.5">
            {unmatched.map((u) => {
              const colorClass = CATEGORY_COLORS[u.type] ?? CATEGORY_COLORS.other;
              const icon = CATEGORY_ICONS[u.type] ?? "➕";
              return (
                <div
                  key={u.rule_id}
                  className={`flex items-center gap-2 rounded-md border border-dashed p-2 ${colorClass} opacity-60`}
                >
                  <span className="text-sm">{icon}</span>
                  <span className="text-xs font-medium">
                    {CATEGORY_COLORS[u.type] ?? u.type} 规则
                  </span>
                  <span className="text-xs ml-auto opacity-75">{u.reason}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {matched.length === 0 && unmatched.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-2">无附加费规则</p>
      )}
    </div>
  );
}
