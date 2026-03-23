import Link from "next/link";
import UploadForm from "@/components/UploadForm";

export default function UploadPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">上传报价表</h1>
            <p className="text-gray-500 text-sm">上传 Excel 文件，解析并写入数据库</p>
          </div>
          <div className="flex gap-3 text-sm items-center">
            <Link href="/settings" className="text-gray-500 hover:text-gray-700">⚙ 设置</Link>
            <Link href="/query" className="text-blue-600 hover:underline">去查询 →</Link>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">
        <UploadForm />
      </main>
    </div>
  );
}
