"use client";

import SurchargeBreakdown from "./surcharge-breakdown";

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

interface BillingRuleApplied {
  rule_key: string;
  rule_value: string;
  raw_evidence: string | null;
}

interface MatchedChannel {
  upstream: string;
  channel_name: string;
  zone: string;
  unit_price: number;
  weight_min: number;
  weight_max: number | null;
  postcode_min: string | null;
  postcode_max: string | null;
  time_estimate: string | null;
}

interface QuoteResultCardProps {
  quote: {
    base_price: number;
    chargeable_weight: number;
    matched_channel: MatchedChannel | null;
  };
  surcharges: SurchargeResult[];
  unmatched_surcharges: UnmatchedSurcharge[];
  billing_rules_applied: BillingRuleApplied[];
  total: number;
  quote_version_id: string;
  rule_version_id: string | null;
}

export default function QuoteResultCard({
  quote,
  surcharges,
  unmatched_surcharges,
  billing_rules_applied,
  total,
  quote_version_id,
  rule_version_id,
}: QuoteResultCardProps) {
  const channel = quote.matched_channel;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">
              {channel ? channel.channel_name : "未匹配到渠道"}
            </h3>
            {channel && (
              <p className="text-blue-100 text-sm mt-0.5">
                {channel.upstream}
                {channel.zone ? ` · ${channel.zone}` : ""}
                {channel.time_estimate ? ` · ${channel.time_estimate}` : ""}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">¥{total.toFixed(2)}</div>
            <div className="text-blue-100 text-xs">总价</div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Channel detail */}
        {channel && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">渠道信息</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-500 text-xs mb-1">单价</div>
                <div className="font-semibold text-gray-900">
                  ¥{channel.unit_price.toFixed(4)}/KG
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-500 text-xs mb-1">计费重</div>
                <div className="font-semibold text-gray-900">
                  {quote.chargeable_weight}KG
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-500 text-xs mb-1">重量范围</div>
                <div className="font-semibold text-gray-900 text-sm">
                  {channel.weight_min}KG
                  {channel.weight_max ? ` ~ ${channel.weight_max}KG` : "+"}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-gray-500 text-xs mb-1">邮编范围</div>
                <div className="font-semibold text-gray-900 text-sm">
                  {channel.postcode_min ?? "无"} - {channel.postcode_max ?? "无"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Price breakdown */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">价格构成</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">基础运费</span>
              <span className="font-medium text-gray-900">
                ¥{quote.base_price.toFixed(2)}
              </span>
            </div>
            {surcharges.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">附加费合计</span>
                <span className="font-medium text-orange-500">
                  +¥{surcharges.reduce((sum, s) => sum + s.amount, 0).toFixed(2)}
                </span>
              </div>
            )}
            {billing_rules_applied.length > 0 && (
              <div className="border-t border-gray-100 pt-2 mt-2">
                <div className="text-xs text-gray-400 mb-1">已应用计费规则：</div>
                {billing_rules_applied.map((br, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {br.rule_key}: <span className="font-medium">{br.rule_value}</span>
                    </span>
                    {br.raw_evidence && (
                      <span className="text-gray-300 truncate max-w-xs" title={br.raw_evidence}>
                        原文: {br.raw_evidence}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between font-bold text-base pt-2 border-t border-gray-200">
              <span className="text-gray-900">合计</span>
              <span className="text-blue-600">¥{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Surcharge breakdown */}
        <div className="border-t border-gray-100 pt-4">
          <SurchargeBreakdown matched={surcharges} unmatched={unmatched_surcharges} />
        </div>

        {/* Version info */}
        <div className="border-t border-gray-100 pt-3 flex items-center justify-between text-xs text-gray-400">
          <span>QuoteVersion: {quote_version_id.slice(0, 8)}...</span>
          {rule_version_id && (
            <span>RuleVersion: {rule_version_id.slice(0, 8)}...</span>
          )}
        </div>
      </div>
    </div>
  );
}
