"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { key: "country", label: "国家", description: "美国、加拿大、澳大利亚等" },
  { key: "channel", label: "渠道", description: "专线、快递渠道名称" },
  { key: "transport_type", label: "运输类型", description: "海运、空运、铁运、卡航" },
  { key: "cargo_type", label: "货物类型", description: "普货、敏感、特货等" },
  { key: "unit", label: "计费单位", description: "kg、件、CBM 等" },
  { key: "currency", label: "货币", description: "USD、CNY 等" },
  { key: "zone", label: "分区", description: "区域划分" },
];

export default function DictionariesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSeed = async () => {
    setLoading("seed");
    try {
      const res = await fetch("/api/dictionaries/seed", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        alert("Seed 失败: " + data.error);
      } else {
        alert(`Seeded ${data.count} entries`);
        router.refresh();
      }
    } catch (e) {
      alert("Seed 失败: " + String(e));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">字典管理</h1>
            <p className="text-gray-500 text-sm">统一管理标准映射值和别名</p>
          </div>
          <div className="flex gap-3 text-sm items-center">
            <Link href="/upload" className="text-gray-500 hover:text-gray-700">上传</Link>
            <Link href="/query" className="text-gray-500 hover:text-gray-700">查询</Link>
            <button
              onClick={handleSeed}
              disabled={loading === "seed"}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {loading === "seed" ? "初始化中..." : "初始化预设数据"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <p className="text-gray-500 text-sm mb-6">
          点击分类卡片进入该类别的字典管理页面，可添加、编辑、删除映射规则。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.key}
              href={`/dictionaries/${cat.key}`}
              className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {cat.label}
                </span>
                <span className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-0.5 rounded">
                  {cat.key}
                </span>
              </div>
              <p className="text-sm text-gray-500">{cat.description}</p>
              <p className="text-xs text-blue-500 mt-3 group-hover:underline">管理 →</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
