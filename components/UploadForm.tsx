"use client";

import { useState, useRef, useEffect } from "react";

interface ParseResult {
  success: boolean;
  preview?: {
    sheets: string[];
    channels: number;
    surcharges: number;
    unparsed_warnings: string[];
  };
  error?: string;
}

export default function UploadForm() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [status, setStatus] = useState<{
    has_data: boolean;
    last_upload?: string;
    last_filename?: string;
    channels: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ has_data: false, channels: 0 });
    }
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      setResult(data);
      if (data.success) checkStatus();
    } catch (e) {
      setResult({ success: false, error: String(e) });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      handleFile(file);
    } else {
      setResult({ success: false, error: "请上传 .xlsx 或 .xls 文件" });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 加载中 */}
      {!status && (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full" />
        </div>
      )}

      {/* 当前状态 */}
      {status && status.has_data && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-medium">
            已加载数据：{status.channels} 条定价记录
          </p>
          {status.last_filename && (
            <p className="text-green-600 text-sm mt-1">
              当前文件：{status.last_filename}
            </p>
          )}
        </div>
      )}

      {/* 上传区域 */}
      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
          dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {uploading ? (
          <div className="text-blue-600">
            <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-3" />
            <p>正在解析报价表...</p>
          </div>
        ) : (
          <>
            <div className="text-4xl mb-3">📤</div>
            <p className="text-gray-700 font-medium">拖拽 Excel 文件到此处，或点击选择</p>
            <p className="text-gray-400 text-sm mt-1">支持 .xlsx / .xls 文件</p>
          </>
        )}
      </div>

      {/* 结果 */}
      {result && (
        <div>
          {result.success && result.preview ? (
            <div className="bg-white border border-green-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-green-500">✓</span> 解析成功
              </h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{result.preview.channels}</div>
                  <div className="text-gray-500 text-sm">定价记录</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{result.preview.surcharges}</div>
                  <div className="text-gray-500 text-sm">附加费规则</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{result.preview.sheets.length}</div>
                  <div className="text-gray-500 text-sm">渠道</div>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-gray-600 text-sm font-medium">已识别渠道：</p>
                {result.preview.sheets.map((s) => (
                  <div key={s} className="text-gray-700 text-sm pl-2">• {s}</div>
                ))}
              </div>
              {result.preview.unparsed_warnings.length > 0 && (
                <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-yellow-700 text-sm font-medium">⚠ 部分条款未能自动解析：</p>
                  {result.preview.unparsed_warnings.map((w, i) => (
                    <p key={i} className="text-yellow-600 text-sm">• {w}</p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-red-800 mb-2">解析失败</h2>
              <p className="text-red-600">{result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
