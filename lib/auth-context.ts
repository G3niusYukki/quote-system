import { AsyncLocalStorage } from "async_hooks";

export interface AuthPayload {
  userId: string;
  organizationId: string;
  role: string;
  email: string;
}

export interface OrgContext {
  userId: string;
  organizationId: string;
  role: string;
  email: string;
}

// AsyncLocalStorage for request-scoped context
export const orgContextStorage = new AsyncLocalStorage<OrgContext>();

/**
 * Get the current organization context from AsyncLocalStorage.
 * Throws if called outside of a request context.
 */
export function getOrgContext(): OrgContext {
  const ctx = orgContextStorage.getStore();
  if (!ctx) {
    throw new Error("Organization context not set. Ensure this is called within a request handler.");
  }
  return ctx;
}

/**
 * Get just the organization ID, convenience helper.
 */
export function getOrgId(): string {
  return getOrgContext().organizationId;
}
