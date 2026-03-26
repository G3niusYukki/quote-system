"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import DictionaryForm, { type DictionaryEntry } from "@/components/dictionary-form";

const CATEGORY_LABELS: Record<string, string> = {
  country: "国家",
  channel: "渠道",
  transport_type: "运输类型",
  cargo_type: "货物类型",
  unit: "计费单位",
  currency: "货币",
  zone: "分区",
};

const VALID_CATEGORIES = Object.keys(CATEGORY_LABELS);

interface DictionaryItem {
  id: string;
  organizationId: string;
  category: string;
  normalizedValue: string;
  aliases: string[];
  createdAt: string;
}

export default function CategoryDictionariesPage() {
  const params = useParams();
  const router = useRouter();
  const category = params.category as string;

  const [dictionaries, setDictionaries] = useState<DictionaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DictionaryEntry | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDictionaries = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dictionaries?category=${category}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setDictionaries(data.data ?? []);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    if (!VALID_CATEGORIES.includes(category)) {
      router.replace("/dictionaries");
      return;
    }
    fetchDictionaries();
  }, [category, fetchDictionaries, router]);

  const handleAdd = () => {
    setEditingEntry(undefined);
    setShowForm(true);
  };

  const handleEdit = (item: DictionaryItem) => {
    setEditingEntry({
      id: item.id,
      category: item.category,
      normalizedValue: item.normalizedValue,
      aliases: item.aliases,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除这条映射吗？")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/dictionaries/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) {
        alert("删除失败: " + data.error);
      } else {
        setDictionaries((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (e) {
      alert("删除失败: " + String(e));
    } finally {
      setDeletingId(null);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingEntry(undefined);
    fetchDictionaries();
  };

  const label = CATEGORY_LABELS[category] ?? category;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-0.5">
              <Link href="/dashboard" className="hover:text-gray-600 transition-colors">🏠 首页</Link>
              <span>/</span>
              <Link href="/dictionaries" className="hover:text-blue-600 transition-colors">字典管理</Link>
              <span>/</span>
              <span>{label}</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{label}</h1>
          </div>
          <div className="flex gap-3 text-sm items-center">
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              + 新增映射
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-20 text-gray-400">加载中...</div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">{error}</div>
        ) : dictionaries.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 mb-4">暂无映射数据</p>
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              + 新增第一条映射
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left text-sm font-medium text-gray-500 px-6 py-3">
                    标准值
                  </th>
                  <th className="text-left text-sm font-medium text-gray-500 px-6 py-3">
                    别名
                  </th>
                  <th className="text-right text-sm font-medium text-gray-500 px-6 py-3 w-32">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dictionaries.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">
                        {item.normalizedValue}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {item.aliases.length > 0 ? (
                          item.aliases.map((alias) => (
                            <span
                              key={alias}
                              className="inline-block px-2.5 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 text-xs rounded-full"
                            >
                              {alias}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-300 text-xs italic">无别名</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                        >
                          {deletingId === item.id ? "删除中..." : "删除"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showForm && (
        <DictionaryForm
          entry={editingEntry}
          defaultCategory={category}
          onSuccess={handleFormSuccess}
          onCancel={() => {
            setShowForm(false);
            setEditingEntry(undefined);
          }}
        />
      )}
    </div>
  );
}
