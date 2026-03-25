/**
 * lib/rbac.ts — Role-Based Access Control
 *
 * Permission matrix:
 * | Action                  | owner | admin | member | viewer |
 * |-------------------------|-------|-------|--------|--------|
 * | manage_members          |  ✅   |  ✅   |   ❌   |   ❌   |
 * | upload_excel            |  ✅   |  ✅   |   ✅   |   ❌   |
 * | review_rules            |  ✅   |  ✅   |   ✅   |   ❌   |
 * | publish_versions        |  ✅   |  ✅   |   ❌   |   ❌   |
 * | query_quotes            |  ✅   |  ✅   |   ✅   |   ✅   |
 * | view_audit_logs         |  ✅   |  ✅   |   ✅   |   ✅   |
 */

export type Role = "owner" | "admin" | "member" | "viewer";

export type Action =
  | "manage_members"
  | "upload_excel"
  | "review_rules"
  | "publish_versions"
  | "query_quotes"
  | "view_audit_logs";

const PERMISSIONS: Record<Action, Role[]> = {
  manage_members: ["owner", "admin"],
  upload_excel: ["owner", "admin", "member"],
  review_rules: ["owner", "admin", "member"],
  publish_versions: ["owner", "admin"],
  query_quotes: ["owner", "admin", "member", "viewer"],
  view_audit_logs: ["owner", "admin", "member", "viewer"],
};

export function hasPermission(role: string, action: Action): boolean {
  return PERMISSIONS[action]?.includes(role as Role) ?? false;
}

/**
 * Check permission and throw a 403 Response if denied.
 */
export function requirePermission(role: string, action: Action): void {
  if (!hasPermission(role, action)) {
    throw new Response("Forbidden: insufficient permissions", { status: 403 });
  }
}

/**
 * Returns true if the given role can manage team members.
 */
export function canManageMembers(role: string): boolean {
  return hasPermission(role, "manage_members");
}

/**
 * Returns true if the given role can upload Excel files.
 */
export function canUploadExcel(role: string): boolean {
  return hasPermission(role, "upload_excel");
}

/**
 * Returns true if the given role can publish versions.
 */
export function canPublish(role: string): boolean {
  return hasPermission(role, "publish_versions");
}
