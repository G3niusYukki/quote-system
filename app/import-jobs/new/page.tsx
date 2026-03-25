"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function NewImportJobPage() {
  const router = useRouter();
  const [upstream, setUpstream] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSetFile(dropped);
  }, []);

  const validateAndSetFile = (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls"].includes(ext ?? "")) {
      setError("仅支持 .xlsx 和 .xls 格式");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError("文件大小不能超过 50MB");
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) validateAndSetFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError("请选择文件"); return; }
    if (!upstream.trim()) { setError("请输入上游名称"); return; }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upstream", upstream.trim());

      const res = await fetch("/api/import-jobs", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "上传失败");
        return;
      }

      router.push(`/import-jobs/${data.job_id}`);
    } catch (err) {
      setError((err as Error).message ?? "网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">新建导入任务</h1>
        <p className="text-sm text-gray-500 mt-1">上传报价表 Excel 文件，系统将自动解析并生成规则切片</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Upstream */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            上游名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={upstream}
            onChange={(e) => setUpstream(e.target.value)}
            placeholder="例如：顺丰优选、DHL渠道"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* File Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-xl cursor-pointer transition-colors
            ${dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"}
            ${file ? "border-green-400 bg-green-50" : ""}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />

          {file ? (
            <>
              <div className="text-3xl mb-2">✅</div>
              <div className="text-sm font-medium text-green-700">{file.name}</div>
              <div className="text-xs text-green-600 mt-1">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="mt-3 text-xs text-gray-500 hover:text-red-600 underline"
              >
                移除文件
              </button>
            </>
          ) : (
            <>
              <div className="text-4xl mb-3">📁</div>
              <div className="text-sm font-medium text-gray-600">
                拖拽文件到此处，或点击选择文件
              </div>
              <div className="text-xs text-gray-400 mt-1">支持 .xlsx / .xls，最大 50MB</div>
            </>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "上传中..." : "开始导入"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 bg-white text-gray-700 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
