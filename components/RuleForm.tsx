"use client";

import { useState } from "react";
import type { RuleRecord } from "@/types";

interface Props {
  rule: RuleRecord;
  isNew: boolean;
  onSave: (saved: RuleRecord) => void;
  onClose: () => void;
}

const CATEGORIES = ["surcharge", "restriction", "compensation", "billing"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  surcharge: "附加费", restriction: "限制", compensation: "赔偿", billing: "计费",
};
const CHARGE_TYPES = [
  { value: "per_kg", label: "元/KG" },
  { value: "per_item", label: "元/件" },
  { value: "fixed", label: "固定金额" },
];

export default function RuleForm({ rule: initial, isNew, onSave, onClose }: Props) {
  const [rule, setRule] = useState(initial);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const method = isNew ? "POST" : "PUT";
      const url = isNew ? "/api/rules" : `/api/rules/${initial.id}`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSave({ ...rule, id: isNew ? data.id : initial.id } as RuleRecord);
    } catch (err) {
      alert(String(err));
    } finally {
      setSaving(false);
    }
  };

  const set = (field: keyof RuleRecord, value: any) =>
    setRule((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">{isNew ? "新增规则" : "编辑规则"}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* 通用：category + type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">类别</label>
              <select
                value={rule.category}
                onChange={(e) => set("category", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">类型/场景</label>
              <input
                value={rule.type}
                onChange={(e) => set("type", e.target.value)}
                placeholder={rule.category === "surcharge" ? "如：超尺寸" : "如：未上网遗失"}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* 附加费专用 */}
          {rule.category === "surcharge" && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">品名（可选）</label>
                  <input value={rule.item_type ?? ""} onChange={(e) => set("item_type", e.target.value || null)} placeholder="如：内置电池" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">计费方式</label>
                  <select value={rule.charge_type ?? ""} onChange={(e) => set("charge_type", e.target.value || null)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">不填</option>
                    {CHARGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">金额</label>
                  <input type="number" step="0.01" value={rule.charge_value ?? ""} onChange={(e) => set("charge_value", e.target.value ? Number(e.target.value) : null)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">触发条件</label>
                <input value={rule.condition} onChange={(e) => set("condition", e.target.value)} placeholder="如：最长边>119CM" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">规则名称</label>
                <input value={rule.description} onChange={(e) => set("description", e.target.value)} placeholder="如：超尺寸-最长边" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </>
          )}

          {/* 限制专用 */}
          {rule.category === "restriction" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">限制内容</label>
              <textarea value={rule.content} onChange={(e) => set("content", e.target.value)} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          )}

          {/* 赔偿专用 */}
          {rule.category === "compensation" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">赔偿标准</label>
                  <input value={rule.content} onChange={(e) => set("content", e.target.value)} placeholder="如：40元/KG+退运费" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">rate_per_kg</label>
                  <input type="number" step="0.01" value={rule.rate_per_kg ?? ""} onChange={(e) => set("rate_per_kg", e.target.value ? Number(e.target.value) : null)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">最高赔偿</label>
                  <input type="number" step="0.01" value={rule.max_compensation ?? ""} onChange={(e) => set("max_compensation", e.target.value ? Number(e.target.value) : null)} placeholder="可为空" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                  <input value={rule.notes ?? ""} onChange={(e) => set("notes", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </>
          )}

          {/* 计费规则专用 */}
          {rule.category === "billing" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">规则类型</label>
                <input value={rule.rule_type ?? ""} onChange={(e) => set("rule_type", e.target.value)} placeholder="如：体积重" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">键名</label>
                <input value={rule.rule_key ?? ""} onChange={(e) => set("rule_key", e.target.value)} placeholder="如：计算公式" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">值</label>
                <input value={rule.rule_value ?? ""} onChange={(e) => set("rule_value", e.target.value)} placeholder="如：长×宽×高/6000" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          )}

          {/* 通用：原始文本 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">原始文本（可选）</label>
            <textarea value={rule.raw_text} onChange={(e) => set("raw_text", e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="记录原始条款，方便人工核对" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "保存中..." : "保存"}
            </button>
            <button type="button" onClick={onClose} className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
