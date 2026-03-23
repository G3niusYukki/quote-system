import Link from "next/link";
import ChatInterface from "@/components/ChatInterface";
import MatchForm from "@/components/MatchForm";

export default function QueryPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">查询报价</h1>
            <p className="text-gray-500 text-sm">智能问答 + 自动渠道匹配</p>
          </div>
          <div className="flex gap-3 text-sm items-center">
            <Link href="/history" className="text-gray-500 hover:text-gray-700">📋 历史</Link>
            <Link href="/settings" className="text-gray-500 hover:text-gray-700">⚙ 设置</Link>
            <Link href="/upload" className="text-blue-600 hover:underline">← 上传报价表</Link>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左侧：自动匹配 */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">自动匹配渠道</h2>
            <MatchForm />
          </div>
          {/* 右侧：AI 问答 */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">AI 智能问答</h2>
            <ChatInterface />
          </div>
        </div>
      </main>
    </div>
  );
}
