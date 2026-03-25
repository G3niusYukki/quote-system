"use client";

import { useState } from "react";
import MemberRoleSelect from "./member-role-select";
import type { Role } from "@/lib/rbac";

interface InviteMemberModalProps {
  onClose: () => void;
  onInvited?: (member: { name: string; email: string; role: string }) => void;
  /** The current user's role for the heading context */
  userRole?: string;
}

type Tab = "invite_link" | "direct_add";

export default function InviteMemberModal({ onClose, onInvited, userRole }: InviteMemberModalProps) {
  const [tab, setTab] = useState<Tab>("invite_link");
  const [role, setRole] = useState<Role>("member");
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Direct add form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [directError, setDirectError] = useState("");
  const [directSuccess, setDirectSuccess] = useState(false);

  const canGenerateInvite = userRole === "owner" || userRole === "admin";
  const canDirectAdd = canGenerateInvite;

  const handleGenerateInvite = async () => {
    setLoading(true);
    setInviteUrl(null);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setInviteUrl(data.inviteUrl);
      }
    } catch {
      alert("生成邀请链接失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = inviteUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDirectAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setDirectError("");
    setDirectSuccess(false);
    setLoading(true);

    try {
      // Get orgId from /api/me
      const meRes = await fetch("/api/me");
      const meData = await meRes.json();
      const orgId = meData.user?.organization?.id;
      if (!orgId) throw new Error("Unauthorized");

      const res = await fetch(`/api/organizations/${orgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (data.error) {
        setDirectError(data.error);
      } else {
        setDirectSuccess(true);
        onInvited?.(data);
        setName("");
        setEmail("");
        setPassword("");
      }
    } catch {
      setDirectError("添加成员失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">添加团队成员</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        {canDirectAdd && (
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setTab("invite_link")}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === "invite_link"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              邀请链接
            </button>
            <button
              onClick={() => setTab("direct_add")}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === "direct_add"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              直接添加
            </button>
          </div>
        )}

        {/* Invite Link Tab */}
        {tab === "invite_link" && (
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-gray-600">
              生成邀请链接，发送给新成员。链接有效期为 10 分钟。
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                成员角色
              </label>
              <MemberRoleSelect value={role} onChange={setRole} excludeOwner />
            </div>

            {!inviteUrl ? (
              <button
                onClick={handleGenerateInvite}
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "生成中..." : "生成邀请链接"}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 break-all">
                  <p className="text-xs text-gray-500 mb-1">邀请链接（点击复制）</p>
                  <p className="text-sm text-gray-800 font-mono select-all">{inviteUrl}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCopy}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    {copied ? "已复制!" : "复制链接"}
                  </button>
                  <button
                    onClick={() => setInviteUrl(null)}
                    className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    重新生成
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Direct Add Tab */}
        {tab === "direct_add" && (
          <form onSubmit={handleDirectAdd} className="px-6 py-5 space-y-4">
            <p className="text-sm text-gray-600">
              直接填写成员信息，立即创建账号。
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">姓名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="成员姓名"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="member@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="至少 8 位"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">成员角色</label>
              <MemberRoleSelect value={role} onChange={setRole} excludeOwner />
            </div>

            {directError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {directError}
              </p>
            )}

            {directSuccess && (
              <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                成员已添加成功！
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "添加中..." : "添加成员"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
