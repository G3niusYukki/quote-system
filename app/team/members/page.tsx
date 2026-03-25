"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import InviteMemberModal from "@/components/invite-member-modal";
import MemberRoleSelect from "@/components/member-role-select";
import PermissionGuard from "@/components/permission-guard";
import type { Role } from "@/lib/rbac";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "所有者",
  admin: "管理员",
  member: "成员",
  viewer: "查看者",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  member: "bg-green-100 text-green-700",
  viewer: "bg-gray-100 text-gray-600",
};

export default function TeamMembersPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<Role>("member");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    const meRes = await fetch("/api/me");
    const meData = await meRes.json();
    const user = meData.user;
    const oid = user?.organization?.id;
    setCurrentUser(user ? { id: user.id, role: user.role } : null);
    setOrgId(oid);

    if (!oid) {
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/organizations/${oid}/members`);
    const data = await res.json();
    setMembers(data.members || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleRoleUpdate = async (userId: string) => {
    if (!orgId) return;
    setSavingId(userId);
    try {
      const res = await fetch(`/api/organizations/${orgId}/members/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editingRole }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setMembers((prev) =>
          prev.map((m) => (m.id === userId ? { ...m, role: editingRole } : m))
        );
        setEditingId(null);
      }
    } catch {
      alert("更新角色失败");
    } finally {
      setSavingId(null);
    }
  };

  const handleRemove = async (userId: string, name: string) => {
    if (!orgId) return;
    if (!confirm(`确定要移除成员 "${name}" 吗？`)) return;
    try {
      const res = await fetch(`/api/organizations/${orgId}/members/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setMembers((prev) => prev.filter((m) => m.id !== userId));
      }
    } catch {
      alert("移除成员失败");
    }
  };

  const handleInvited = (newMember: { name: string; email: string; role: string }) => {
    setMembers((prev) => [
      ...prev,
      {
        id: "",
        name: newMember.name,
        email: newMember.email,
        role: newMember.role,
        createdAt: new Date().toISOString(),
      },
    ]);
    // Reload to get real ID
    loadMembers();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">团队成员</h1>
            <p className="text-gray-500 text-sm">
              {loading ? "加载中..." : `共 ${members.length} 位成员`}
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/upload" className="text-blue-600 hover:underline">上传</Link>
            <Link href="/query" className="text-blue-600 hover:underline">查询</Link>
            <Link href="/rules" className="text-blue-600 hover:underline">规则</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl border border-gray-200">
          {/* Toolbar */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">成员列表</h2>
            <PermissionGuard action="manage_members" fallback={null}>
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                + 添加成员
              </button>
            </PermissionGuard>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">加载中...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">暂无成员</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-sm flex-shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {member.name}
                        </span>
                        {currentUser?.id === member.id && (
                          <span className="text-xs text-gray-400">(你)</span>
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            ROLE_COLORS[member.role] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {ROLE_LABELS[member.role] ?? member.role}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <PermissionGuard action="manage_members" fallback={null}>
                      {editingId === member.id ? (
                        <div className="flex items-center gap-2">
                          <MemberRoleSelect
                            value={editingRole}
                            onChange={setEditingRole}
                            excludeOwner={member.role !== "owner"}
                          />
                          <button
                            onClick={() => handleRoleUpdate(member.id)}
                            disabled={savingId === member.id}
                            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            {savingId === member.id ? "保存中..." : "保存"}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingId(member.id);
                              setEditingRole(member.role as Role);
                            }}
                            className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
                          >
                            修改角色
                          </button>
                          {currentUser?.id !== member.id && (
                            <button
                              onClick={() => handleRemove(member.id, member.name)}
                              className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              移除
                            </button>
                          )}
                        </div>
                      )}
                    </PermissionGuard>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showInviteModal && (
        <InviteMemberModal
          onClose={() => setShowInviteModal(false)}
          onInvited={handleInvited}
          userRole={currentUser?.role}
        />
      )}
    </div>
  );
}
