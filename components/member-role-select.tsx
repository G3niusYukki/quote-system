"use client";

import type { Role } from "@/lib/rbac";

const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  {
    value: "admin",
    label: "管理员",
    description: "可管理成员、上传报价表、审核规则、发布版本",
  },
  {
    value: "member",
    label: "成员",
    description: "可上传报价表、审核规则、查询报价",
  },
  {
    value: "viewer",
    label: "查看者",
    description: "仅可查询报价",
  },
];

interface MemberRoleSelectProps {
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
  /** Hide the owner option (used when editing existing members) */
  excludeOwner?: boolean;
  id?: string;
}

export default function MemberRoleSelect({
  value,
  onChange,
  disabled = false,
  excludeOwner = false,
  id,
}: MemberRoleSelectProps) {
  const options = excludeOwner
    ? ROLE_OPTIONS
    : [
        { value: "owner" as Role, label: "所有者", description: "完全控制，不可转让" },
        ...ROLE_OPTIONS,
      ];

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as Role)}
      disabled={disabled}
      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export { ROLE_OPTIONS };
