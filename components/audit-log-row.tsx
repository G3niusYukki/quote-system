"use client";

import { useState } from "react";

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
}

interface AuditLogRowProps {
  log: AuditLogEntry;
}

// Format action labels in a human-readable way
function formatAction(action: string): string {
  const parts = action.split(".");
  if (parts.length === 2) {
    const [entity, verb] = parts;
    const entityMap: Record<string, string> = {
      auth: "认证",
      import_job: "导入任务",
      rule: "规则",
      quote_version: "报价版本",
      dictionary: "字典",
      member: "成员",
      organization: "组织",
    };
    const verbMap: Record<string, string> = {
      login: "登录",
      logout: "登出",
      register: "注册",
      create: "创建",
      update: "更新",
      delete: "删除",
      publish: "发布",
      rollback: "回滚",
      retry: "重试",
      invite: "邀请",
      add: "添加",
      remove: "移除",
    };
    return `${entityMap[entity] ?? entity} ${verbMap[verb] ?? verb}`;
  }
  return action;
}

// Format timestamp
function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

// Human-readable entity type label
function formatEntityType(type: string | null): string {
  if (!type) return "-";
  const map: Record<string, string> = {
    import_job: "导入任务",
    rule: "规则",
    quote_version: "报价版本",
    dictionary: "字典",
    member: "成员",
    organization: "组织",
    user: "用户",
  };
  return map[type] ?? type;
}

function JsonView({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <span className="text-gray-400 italic">null</span>;
  return (
    <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-3 overflow-auto max-h-64 font-mono text-gray-700">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function AuditLogRow({ log }: AuditLogRowProps) {
  const [expanded, setExpanded] = useState(false);

  // Determine if before/after are meaningfully different
  const hasDiff =
    log.before !== null ||
    log.after !== null;

  const handleClick = () => {
    if (hasDiff) setExpanded((v) => !v);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        className={`w-full px-5 py-4 text-left hover:bg-gray-50 transition-colors ${hasDiff ? "cursor-pointer" : "cursor-default"}`}
        onClick={handleClick}
        title={hasDiff ? "点击展开查看变更详情" : undefined}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Left: action + user + entity */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-gray-400 text-sm shrink-0">{formatTime(log.createdAt)}</span>
            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium shrink-0">
              {formatAction(log.action)}
            </span>
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded shrink-0">
              {formatEntityType(log.entityType)}
            </span>
            {log.entityId && (
              <span className="text-gray-400 text-xs font-mono truncate max-w-[120px]" title={log.entityId}>
                #{log.entityId.slice(0, 8)}
              </span>
            )}
            <span className="text-gray-500 text-sm truncate">
              {log.user?.name ?? log.user?.email ?? "系统"}
            </span>
            {log.ip && (
              <span className="text-gray-300 text-xs shrink-0">IP: {log.ip}</span>
            )}
          </div>

          {/* Right: expand indicator */}
          <div className="shrink-0">
            {hasDiff ? (
              <span className="text-gray-300 text-lg">{expanded ? "▲" : "▼"}</span>
            ) : (
              <span className="text-gray-200 text-xs">-</span>
            )}
          </div>
        </div>
      </button>

      {expanded && hasDiff && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                修改前 (before)
              </div>
              <JsonView data={log.before} />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                修改后 (after)
              </div>
              <JsonView data={log.after} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
