"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { RuleRecord } from "@/types";
import RuleForm from "@/components/RuleForm";

type Tab = "surcharge" | "restriction" | "compensation" | "billing";
const TAB_LABELS: Record<Tab, string> = {
  surcharge: "附加费",
  restriction: "限制",
  compensation: "赔偿",
  billing: "计费",
};

export default function RulesPage() {
  const [upstreams, setUpstreams] = useState<string[]>([]);
  const [selectedUpstream, setSelectedUpstream] = useState("");
  const [tab, setTab] = useState<Tab>("surcharge");
  const [rules, setRules] = useState<RuleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [editRule, setEditRule] = useState<RuleRecord | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => {
        setUpstreams(d.upstreams || []);
        if (d.upstreams?.length > 0 && !selectedUpstream) {
          setSelectedUpstream(d.upstreams[0]);
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedUpstream) return;
    setLoading(true);
    fetch(`/api/rules?upstream=${encodeURIComponent(selectedUpstream)}&category=${tab}`)
      .then((r) => r.json())
      .then((d) => { setRules(d.rules || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedUpstream, tab]);

  const handleDelete = async (id: number) => {
    if (!confirm("确认删除这条规则？")) return;
    await fetch(`/api/rules/${id}`, { method: "DELETE" });
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleConvertToManual = async (rule: RuleRecord) => {
    if (!rule.id) return;
    await fetch(`/api/rules/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "manual" }),
    });
    setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, source: "manual" } : r));
  };

  const handleSave = (saved: RuleRecord) => {
    if (isNew) {
      setRules((prev) => [...prev, saved]);
    } else {
      setRules((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    }
    setEditRule(null);
  };

  const handleReextract = async () => {
    if (!selectedUpstream) return;
    setExtracting(true);
    try {
      const res = await fetch(`/api/rules/extract?upstream=${encodeURIComponent(selectedUpstream)}`);
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert(`AI 重提完成，新增 ${data.count} 条规则`);
        const r = await fetch(`/api/rules?upstream=${encodeURIComponent(selectedUpstream)}&category=${tab}`);
        const d = await r.json();
        setRules(d.rules || []);
      }
    } finally {
      setExtracting(false);
    }
  };

  const openNewForm = () => {
    setEditRule({
      upstream: selectedUpstream,
      category: tab,
      source: "manual",
      type: "",
      item_type: null,
      charge_type: null,
      charge_value: null,
      condition: "",
      description: "",
      content: "",
      standard: null,
      rate_per_kg: null,
      max_compensation: null,
      notes: null,
      rule_type: null,
      rule_key: null,
      rule_value: null,
      raw_text: "",
    });
    setIsNew(true);
  };

  const amountLabel = (chargeType: string | null, chargeValue: number | null) => {
    if (chargeValue == null) return "-";
    const unit = chargeType === "per_kg" ? "KG" : chargeType === "per_item" ? "件" : "票";
    return `${chargeValue}元/${unit}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">规则管理</h1>
            <p className="text-gray-500 text-sm">管理各上游的附加费、限制、赔偿规则</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/upload" className="text-blue-600 hover:underline">上传</Link>
            <Link href="/query" className="text-blue-600 hover:underline">查询</Link>
            <Link href="/settings" className="text-blue-600 hover:underline">设置</Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        <div className="flex items-center gap-4">
          <select
            value={selectedUpstream}
            onChange={(e) => setSelectedUpstream(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">选择上游</option>
            {upstreams.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <button
            onClick={handleReextract}
            disabled={!selectedUpstream || extracting}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {extracting ? "AI 重提中..." : "AI 重新提取"}
          </button>
          {selectedUpstream && (
            <button onClick={openNewForm} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              + 新增规则
            </button>
          )}
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                tab === t ? "bg-white shadow text-blue-600 font-medium" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">加载中...</div>
        ) : !selectedUpstream ? (
          <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-200">
            请选择上游
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-200">
            暂无规则，点击"新增规则"手动添加
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">来源</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">名称</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">条件/内容</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">金额</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">原始文本</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        rule.source === "ai" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"
                      }`}>
                        {rule.source === "ai" ? "AI" : "手动"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{rule.description || rule.type || "-"}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate">{rule.condition || rule.content || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{amountLabel(rule.charge_type, rule.charge_value)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{rule.raw_text}</td>
                    <td className="px-4 py-3 text-right">
                      {rule.source === "manual" ? (
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => { setEditRule(rule); setIsNew(false); }} className="text-blue-600 hover:underline text-xs">编辑</button>
                          <button onClick={() => handleDelete(rule.id!)} className="text-red-600 hover:underline text-xs">删除</button>
                        </div>
                      ) : (
                        <button onClick={() => handleConvertToManual(rule)} className="text-purple-600 hover:underline text-xs">转为手动</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {editRule && (
        <RuleForm
          rule={editRule}
          isNew={isNew}
          onSave={handleSave}
          onClose={() => setEditRule(null)}
        />
      )}
    </div>
  );
}
