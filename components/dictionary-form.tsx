"use client";

import { useState, useEffect } from "react";

const VALID_CATEGORIES = [
  "country",
  "channel",
  "transport_type",
  "cargo_type",
  "unit",
  "currency",
  "zone",
] as const;

export interface DictionaryEntry {
  id?: string;
  category: string;
  normalizedValue: string;
  aliases: string[];
}

interface DictionaryFormProps {
  entry?: DictionaryEntry;
  defaultCategory?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function DictionaryForm({
  entry,
  defaultCategory,
  onSuccess,
  onCancel,
}: DictionaryFormProps) {
  const [category, setCategory] = useState(entry?.category ?? defaultCategory ?? "country");
  const [normalizedValue, setNormalizedValue] = useState(entry?.normalizedValue ?? "");
  const [aliasInput, setAliasInput] = useState("");
  const [aliases, setAliases] = useState<string[]>(entry?.aliases ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!entry?.id;

  const handleAddAlias = () => {
    const trimmed = aliasInput.trim();
    if (trimmed && !aliases.includes(trimmed)) {
      setAliases([...aliases, trimmed]);
      setAliasInput("");
    }
  };

  const handleRemoveAlias = (alias: string) => {
    setAliases(aliases.filter((a) => a !== alias));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddAlias();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!normalizedValue.trim()) {
      setError("标准值不能为空");
      return;
    }
    if (!category) {
      setError("请选择分类");
      return;
    }

    setSaving(true);
    try {
      const url = isEdit ? `/api/dictionaries/${entry.id}` : "/api/dictionaries";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, normalizedValue: normalizedValue.trim(), aliases }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        onSuccess();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? "编辑映射" : "新增映射"}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">分类</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isEdit}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              {VALID_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Normalized Value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">标准值</label>
            <input
              type="text"
              value={normalizedValue}
              onChange={(e) => setNormalizedValue(e.target.value)}
              placeholder="如：美国专线"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">归一化后的标准名称</p>
          </div>

          {/* Aliases */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">别名（每行一个）</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入别名后按回车添加"
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddAlias}
                className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                添加
              </button>
            </div>
            {aliases.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {aliases.map((alias) => (
                  <span
                    key={alias}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-sm"
                  >
                    {alias}
                    <button
                      type="button"
                      onClick={() => handleRemoveAlias(alias)}
                      className="text-blue-400 hover:text-blue-600 transition-colors"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {aliases.length === 0 && (
              <p className="text-xs text-gray-400">暂无别名，可留空</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
