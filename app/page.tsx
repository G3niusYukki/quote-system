import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="text-center max-w-xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">国际快递报价系统</h1>
        <p className="text-gray-600 text-lg mb-10">
          上传报价表，智能匹配最优渠道，AI 问答快速查询条款
        </p>
        <div className="flex gap-4 justify-center mb-6">
          <Link
            href="/upload"
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            上传报价表
          </Link>
          <Link
            href="/query"
            className="px-8 py-3 bg-white text-blue-600 border border-blue-300 rounded-lg font-medium hover:bg-blue-50 transition-colors"
          >
            查询报价
          </Link>
        </div>
        <Link href="/settings" className="text-gray-400 hover:text-gray-600 text-sm">⚙ 系统设置</Link>
      </div>
    </div>
  );
}
