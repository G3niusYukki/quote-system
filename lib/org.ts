/**
 * lib/org.ts — Organization context helpers.
 *
 * The actual row-level isolation is enforced by prisma $extends in lib/db.ts.
 * This module provides ergonomic helpers for API route handlers.
 */

export { getOrgId, getOrgContext } from "./auth-context";
export { withOrgContext, requireAuth, getRequestAuth } from "./request-auth";
export type { RequestAuth } from "./request-auth";
