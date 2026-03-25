"use client";

import { useState } from "react";

interface RuleFields {
  category?: string;
  type?: string;
  itemType?: string | string[];
  chargeType?: string | null;
  chargeValue?: number | string | null;
  condition?: string;
  description?: string;
  content?: string;
  priority?: number;
  [key: string]: unknown;
}

interface RuleInlineEditorProps {
  initial?: RuleFields;
  onConfirm: (corrections: RuleFields) => void;
  onCancel: () => void;
  submitting?: boolean;
}

const CATEGORIES = [
  { value: "surcharge", label: "附加费" },
  { value: "restriction", label: "限制" },
  { value: "compensation", label: "赔偿" },
  { value: "billing", label: "计费" },
];

const CHARGE_TYPES = [
  { value: "per_kg", label: "元/KG" },
  { value: "per_item", label: "元/件" },
  { value: "fixed", label: "固定金额" },
];

export default function RuleInlineEditor({ initial = {}, onConfirm, onCancel, submitting }: RuleInlineEditorProps) {
  const [form, setForm] = useState<RuleFields>({
    category: initial.category ?? "surcharge",
    type: initial.type ?? "",
    itemType: initial.itemType ?? "",
    chargeType: initial.chargeType ?? "",
    chargeValue: initial.chargeValue ?? "",
    condition: initial.condition ?? "",
    description: initial.description ?? "",
    content: initial.content ?? "",
    priority: initial.priority ?? 0,
  });

  const set = (field: keyof RuleFields, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* 通用：category + type */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">类别</label>
          <select
            value={form.category ?? ""}
            onChange={(e) => set("category", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">类型/场景</label>
          <input
            value={form.type ?? ""}
            onChange={(e) => set("type", e.target.value)}
            placeholder="如：超尺寸"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* 附加费专用 */}
      {form.category === "surcharge" && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">品名</label>
              <input
                value={typeof form.itemType === "string" ? form.itemType : ""}
                onChange={(e) => set("itemType", e.target.value)}
                placeholder="如：内置电池"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">计费方式</label>
              <select
                value={form.chargeType ?? ""}
                onChange={(e) => set("chargeType", e.target.value || null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">不填</option>
                {CHARGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">金额</label>
              <input
                type="number"
                step="0.01"
                value={form.chargeValue ?? ""}
                onChange={(e) => set("chargeValue", e.target.value ? Number(e.target.value) : null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">触发条件</label>
            <input
              value={form.condition ?? ""}
              onChange={(e) => set("condition", e.target.value)}
              placeholder="如：最长边>119CM"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">规则名称</label>
            <input
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="如：超尺寸-最长边"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </>
      )}

      {/* 限制专用 */}
      {form.category === "restriction" && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">限制内容</label>
          <textarea
            value={form.content ?? ""}
            onChange={(e) => set("content", e.target.value)}
            rows={2}
            placeholder="限制内容"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      )}

      {/* 赔偿专用 */}
      {form.category === "compensation" && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">赔偿标准</label>
          <input
            value={form.content ?? ""}
            onChange={(e) => set("content", e.target.value)}
            placeholder="如：40元/KG+退运费"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      )}

      {/* 计费规则专用 */}
      {form.category === "billing" && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">规则值</label>
          <input
            value={form.content ?? ""}
            onChange={(e) => set("content", e.target.value)}
            placeholder="计费规则内容"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      )}

      {/* 优先级 */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">优先级</label>
        <input
          type="number"
          value={form.priority ?? 0}
          onChange={(e) => set("priority", parseInt(e.target.value, 10) || 0)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "提交中..." : "确认修正"}
        </button>
      </div>
    </form>
  );
}
