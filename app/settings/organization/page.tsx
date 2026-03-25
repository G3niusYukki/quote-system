"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-provider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OrgData {
  id: string;
  name: string;
  plan: string;
  memberCount: number;
  createdAt: string;
}

export default function OrganizationSettingsPage() {
  const { user, refresh } = useAuth();
  const [org, setOrg] = useState<OrgData | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const isOwner = user?.role === "owner";
  const orgId = user?.organization?.id;

  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/organizations/${orgId}`)
      .then((r) => r.json())
      .then((d) => {
        setOrg(d);
        setName(d.name ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [orgId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setError("");
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "保存失败");
        return;
      }
      setOrg(data);
      await refresh();
      setSaved(true);
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">组织设置</h1>
        <p className="text-sm text-gray-500 mt-1">管理您的组织信息</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          {isOwner ? (
            <form onSubmit={handleSave} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
              <div>
                <Label htmlFor="orgName">组织名称</Label>
                <Input
                  id="orgName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="组织名称"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? "保存中..." : "保存修改"}
                </Button>
                {saved && <span className="text-green-600 text-sm">已保存</span>}
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700">组织名称</p>
                <p className="text-gray-900">{org?.name}</p>
              </div>
              <p className="text-sm text-gray-400">
                只有组织所有者可以修改组织设置
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">组织信息</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">组织 ID</dt>
              <dd className="font-mono text-gray-700 text-xs">{org?.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">套餐</dt>
              <dd className="font-medium text-gray-900">
                {org?.plan === "free" ? "免费版" : org?.plan}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">成员数量</dt>
              <dd className="font-medium text-gray-900">{org?.memberCount} 人</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">创建时间</dt>
              <dd className="text-gray-700">
                {org?.createdAt ? new Date(org.createdAt).toLocaleDateString("zh-CN") : "-"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
