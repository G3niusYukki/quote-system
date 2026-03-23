"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SurchargeDetail {
  name: string;
  type: string;
  value: number;
  amount: number;
}

interface MatchResult {
  upstream: string;
  channel: string;
  zone: string;
  volume_weight: number;
  chargeable_weight: number;
  base_price: number;
  surcharges: SurchargeDetail[];
  total: number;
  time_estimate: string;
  notes: string;
  is_lowest: boolean;
}

interface QueryRecord {
  id: number;
  country: string;
  transport_type: string;
  cargo_type: string;
  actual_weight: number;
  length: number | null;
  width: number | null;
  height: number | null;
  volume_weight: number | null;
  chargeable_weight: number;
  item_types: string;
  is_private_address: number;
  postcode: string;
  upstream: string;
  result_json: string;
  created_at: string;
}

export default function HistoryPage() {
  const [records, setRecords] = useState<QueryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => { setRecords(d.history || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">查询历史</h1>
            <p className="text-gray-500 text-sm">所有询价记录，含完整附加费明细</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/upload" className="text-blue-600 hover:underline">上传</Link>
            <Link href="/query" className="text-blue-600 hover:underline">查询</Link>
            <Link href="/rules" className="text-blue-600 hover:underline">规则</Link>
            <Link href="/settings" className="text-blue-600 hover:underline">设置</Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12 text-gray-400">加载中...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 text-gray-400">
            暂无查询记录，去 <Link href="/query" className="text-blue-600 hover:underline">查询页面</Link> 发起询价
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((r) => {
              const results: MatchResult[] = JSON.parse(r.result_json);
              const isOpen = expanded === r.id;
              return (
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    className="w-full px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-sm">{formatDate(r.created_at)}</span>
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                          {r.country} · {r.transport_type}
                        </span>
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">
                          {r.cargo_type}
                        </span>
                        <span className="text-gray-600 text-sm">
                          重量 {r.actual_weight}KG · 尺寸 {r.length ?? "?"}×{r.width ?? "?"}×{r.height ?? "?"}CM
                        </span>
                        {r.item_types && (
                          <span className="text-orange-600 text-xs">
                            含 {r.item_types.split(",").filter(Boolean).join("、")}
                          </span>
                        )}
                        {r.is_private_address === 1 && (
                          <span className="text-purple-600 text-xs">私人地址</span>
                        )}
                        {r.postcode && (
                          <span className="text-gray-400 text-xs">邮编 {r.postcode}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-semibold text-gray-900">
                            {results[0] ? `¥${results[0].total.toFixed(2)}` : "-"}
                            {results[0]?.is_lowest && (
                              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">最低</span>
                            )}
                          </div>
                          <div className="text-gray-400 text-xs">{r.upstream || "全部上游"}</div>
                        </div>
                        <span className="text-gray-300 text-lg">{isOpen ? "▲" : "▼"}</span>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                      <div className="space-y-2">
                        {results.map((ch, i) => (
                          <div key={i} className={`bg-white rounded-lg border p-4 ${ch.is_lowest ? "border-blue-300" : "border-gray-200"}`}>
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">{ch.channel}</span>
                                  {ch.is_lowest && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">最低价</span>
                                  )}
                                </div>
                                <div className="text-gray-400 text-xs mt-0.5">
                                  {ch.upstream} · {ch.zone} · {ch.time_estimate}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-bold text-blue-600">¥{ch.total.toFixed(2)}</div>
                                <div className="text-gray-400 text-xs">含附加费</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                              <div className="bg-gray-50 rounded p-2">
                                <div className="text-gray-400 text-xs">计费重量</div>
                                <div className="font-medium">{ch.chargeable_weight}KG</div>
                              </div>
                              <div className="bg-gray-50 rounded p-2">
                                <div className="text-gray-400 text-xs">体积重</div>
                                <div className="font-medium">{ch.volume_weight}KG</div>
                              </div>
                              <div className="bg-gray-50 rounded p-2">
                                <div className="text-gray-400 text-xs">基础运费</div>
                                <div className="font-medium">¥{ch.base_price.toFixed(2)}</div>
                              </div>
                            </div>
                            {ch.surcharges.length > 0 && (
                              <div>
                                <div className="text-gray-400 text-xs mb-1">附加费明细：</div>
                                {ch.surcharges.map((s, si) => (
                                  <div key={si} className="flex justify-between text-sm py-0.5">
                                    <span className="text-gray-600">{s.name}</span>
                                    <span className="text-orange-500 font-medium">+¥{s.amount.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {ch.notes && (
                              <p className="text-gray-400 text-xs mt-2">{ch.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
