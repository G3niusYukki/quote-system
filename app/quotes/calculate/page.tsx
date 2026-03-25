"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import QuoteResultCard from "@/components/quote-result-card";

const ITEM_TYPES = [
  "内置电池", "化妆品", "护肤品", "食品", "药品",
  "保健品", "医疗器械", "眼镜", "木制品", "服装", "膏体",
];

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

interface CalculateResult {
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

export default function QuotesCalculatePage() {
  const [country, setCountry] = useState("美国");
  const [transportType, setTransportType] = useState<"海运" | "空运">("海运");
  const [cargoType, setCargoType] = useState("纯普货");
  const [actualWeight, setActualWeight] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [postcode, setPostcode] = useState("");
  const [upstream, setUpstream] = useState("");
  const [upstreams, setUpstreams] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CalculateResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Load available upstreams from config/status
    fetch("/api/config")
      .then((r) => r.json())
      .then(() => {
        // Also try to load from quote versions
        return fetch("/api/quotes/versions", { credentials: "include" });
      })
      .catch(() => {/* ignore */});
  }, []);

  const toggleItem = (item: string) => {
    setSelectedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    const L = parseFloat(length) || 0;
    const W = parseFloat(width) || 0;
    const H = parseFloat(height) || 0;
    const volumeWeight = (L * W * H) / 6000;

    try {
      const res = await fetch("/api/quotes/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country,
          transport_type: transportType,
          cargo_type: cargoType,
          actual_weight: parseFloat(actualWeight) || 0,
          volume_weight: volumeWeight,
          dimensions: { L, W, H },
          item_types: selectedItems,
          is_private_address: isPrivate,
          postcode: postcode || undefined,
          upstream: upstream || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "请求失败");
        return;
      }
      setResult(data as CalculateResult);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setResult(null);
    setError("");
    setActualWeight("");
    setLength("");
    setWidth("");
    setHeight("");
    setSelectedItems([]);
    setIsPrivate(false);
    setPostcode("");
    setUpstream("");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">报价计算</h1>
            <p className="text-gray-500 text-sm">可解释的报价计算引擎</p>
          </div>
          <div className="flex gap-3 text-sm items-center">
            <Link href="/history" className="text-gray-500 hover:text-gray-700">历史记录</Link>
            <Link href="/query" className="text-gray-500 hover:text-gray-700">询价</Link>
            <Link href="/settings" className="text-gray-500 hover:text-gray-700">设置</Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 sticky top-6"
            >
              <h2 className="font-semibold text-gray-900">输入参数</h2>

              {/* Country + Upstream */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    目的国家
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="美国">美国</option>
                    <option value="加拿大">加拿大</option>
                    <option value="澳大利亚">澳大利亚</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    上游（可选）
                  </label>
                  <select
                    value={upstream}
                    onChange={(e) => setUpstream(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">全部</option>
                    {upstreams.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Transport type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  运输类型
                </label>
                <select
                  value={transportType}
                  onChange={(e) => setTransportType(e.target.value as "海运" | "空运")}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="海运">海运</option>
                  <option value="空运">空运</option>
                </select>
              </div>

              {/* Cargo type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  货物类型
                </label>
                <select
                  value={cargoType}
                  onChange={(e) => setCargoType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="纯普货">纯普货</option>
                  <option value="普货">普货</option>
                  <option value="敏感">敏感</option>
                  <option value="普敏">普敏</option>
                  <option value="特货">特货</option>
                </select>
              </div>

              {/* Weight + Dimensions */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    实重(KG)
                  </label>
                  <input
                    type="number"
                    value={actualWeight}
                    onChange={(e) => setActualWeight(e.target.value)}
                    placeholder="30"
                    min="0"
                    step="0.1"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    长(CM)
                  </label>
                  <input
                    type="number"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    placeholder="60"
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    宽(CM)
                  </label>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    placeholder="40"
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    高(CM)
                  </label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="30"
                    min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Volume weight hint */}
              {length && width && height && (
                <div className="text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-1.5">
                  体积重: ({length} × {width} × {height}) / 6000 ={" "}
                  <strong>
                    {((parseFloat(length) || 0) * (parseFloat(width) || 0) * (parseFloat(height) || 0) / 6000).toFixed(2)}KG
                  </strong>
                </div>
              )}

              {/* Item types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  物品类型（可多选）
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ITEM_TYPES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleItem(item)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        selectedItems.includes(item)
                          ? "bg-blue-100 border-blue-400 text-blue-700"
                          : "bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {/* Postcode + Private */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    收件邮编
                  </label>
                  <input
                    type="text"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    placeholder="90210"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700">私人地址</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "计算中..." : "开始计算"}
              </button>

              {result && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  重新计算
                </button>
              )}
            </form>
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-4">
                {error}
              </div>
            )}

            {!result && !loading && (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">填写参数后点击计算查看报价</p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                <p className="text-sm">计算中...</p>
              </div>
            )}

            {result && (
              <QuoteResultCard
                quote={result.quote}
                surcharges={result.surcharges}
                unmatched_surcharges={result.unmatched_surcharges}
                billing_rules_applied={result.billing_rules_applied}
                total={result.total}
                quote_version_id={result.quote_version_id}
                rule_version_id={result.rule_version_id}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
