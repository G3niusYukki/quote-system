/**
 * lib/audit.ts — Audit log write helper
 *
 * Use this helper whenever an auditable action occurs to record
 * before/after snapshots and the client's IP address.
 */

import { prisma } from "@/lib/db";
import { getOrgContext } from "@/lib/auth-context";
import { orgContextStorage } from "@/lib/auth-context";

/**
 * Extract the client IP from a Request's headers.
 * Checks x-forwarded-for (may contain multiple IPs), x-real-ip, and forwarded.
 */
export function getClientIp(req?: Request): string | undefined {
  if (!req) return undefined;

  const h = req.headers;

  // x-forwarded-for: "client, proxy1, proxy2"
  const xff = h.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0].trim();
  }

  const xrip = h.get("x-real-ip");
  if (xrip) return xrip.trim();

  const fwd = h.get("forwarded");
  if (fwd) {
    // forwarded: "by=...; for=...; host=..."
    const match = fwd.match(/for="?([^";,]+)/);
    if (match) return match[1].trim();
  }

  return undefined;
}

export interface WriteAuditParams {
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  req?: Request;
}

/**
 * Write a single audit log entry for the current org context.
 *
 * This function reads userId from the current AsyncLocalStorage context
 * (set by withOrgContext in the calling API route), so it must be called
 * *within* a withOrgContext callback.
 *
 * @example
 * await withOrgContext(auth, async () => {
 *   await writeAudit({ action: "rule.create", entityType: "rule", entityId: rule.id, before: undefined, after: rule });
 * });
 */
export async function writeAudit(params: WriteAuditParams): Promise<void> {
  const ctx = orgContextStorage.getStore();
  const userId = ctx?.userId ?? null;
  const ip = getClientIp(params.req);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.auditLog.create({
    data: {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      before: params.before ?? undefined,
      after: params.after ?? undefined,
      ip: ip ?? null,
      userId,
    } as any,
  });
}
