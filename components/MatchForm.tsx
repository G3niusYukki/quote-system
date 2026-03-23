"use client";

import { useState, useEffect } from "react";
import type { MatchResult } from "@/types";

const ITEM_TYPES = [
  "内置电池", "化妆品", "护肤品", "食品", "药品",
  "保健品", "医疗器械", "眼镜", "木制品", "服装", "膏体"
];

export default function MatchForm() {
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
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => setUpstreams(d.upstreams || []));
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
    setResults(null);

    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country,
          transport_type: transportType,
          cargo_type: cargoType,
          actual_weight: parseFloat(actualWeight) || 0,
          dimensions: {
            length: parseFloat(length) || 0,
            width: parseFloat(width) || 0,
            height: parseFloat(height) || 0,
          },
          item_types: selectedItems,
          is_private_address: isPrivate,
          postcode: postcode || undefined,
          upstream: upstream || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else if (data.matches) {
        setResults(data.matches);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">目的国家</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">上游</label>
            <select
              value={upstream}
              onChange={(e) => setUpstream(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部（比价）</option>
              {upstreams.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">运输类型</label>
          <select
            value={transportType}
            onChange={(e) => setTransportType(e.target.value as "海运" | "空运")}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="海运">海运</option>
            <option value="空运">空运</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">货物类型</label>
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

        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">实重(KG)</label>
            <input
              type="number"
              value={actualWeight}
              onChange={(e) => setActualWeight(e.target.value)}
              placeholder="30"
              min="0"
              step="0.1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">长(CM)</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">宽(CM)</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">高(CM)</label>
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">物品类型（可多选）</label>
          <div className="flex flex-wrap gap-2">
            {ITEM_TYPES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => toggleItem(item)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">收件邮编（可选）</label>
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
          {loading ? "计算中..." : "查询最优渠道"}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      {results && results.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700 text-sm">
          没有找到符合条件的渠道，请尝试调整筛选条件
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-3">
          {results.map((r, i) => (
            <div key={i} className={`bg-white rounded-xl border p-5 ${r.is_lowest ? "border-blue-400 ring-1 ring-blue-100" : "border-gray-200"}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{r.channel}</h3>
                    {r.is_lowest && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">最低价</span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm">{r.upstream} · {r.zone} · {r.time_estimate}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">¥{r.total.toFixed(2)}</div>
                  <div className="text-gray-400 text-xs">含附加费</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-gray-500 text-xs">实重</div>
                  <div className="font-medium">{r.chargeable_weight}KG</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-gray-500 text-xs">体积重</div>
                  <div className="font-medium">{r.volume_weight}KG</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-gray-500 text-xs">基础运费</div>
                  <div className="font-medium">¥{r.base_price.toFixed(2)}</div>
                </div>
              </div>

              {r.surcharges.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-gray-500 text-xs mb-1">附加费明细：</p>
                  {r.surcharges.map((s, si) => (
                    <div key={si} className="flex justify-between text-sm text-gray-600">
                      <span>{s.name}</span>
                      <span className="text-orange-500">+¥{s.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {r.notes && (
                <p className="text-gray-400 text-xs mt-2">{r.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
