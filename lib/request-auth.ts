import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractTokenFromHeader, extractTokenFromCookie } from "./auth";
import { orgContextStorage } from "./auth-context";

export interface RequestAuth {
  userId: string;
  organizationId: string;
  role: string;
  email: string;
}

/**
 * Get auth info for an API route:
 * 1. Try reading from middleware-passed headers (x-user-id etc.)
 * 2. Fall back to re-verifying token from cookie/Authorization header
 *
 * Returns null if unauthenticated.
 */
export function getRequestAuth(req: NextRequest): RequestAuth | null {
  // Fast path: middleware already decoded and passed via headers
  const userId = req.headers.get("x-user-id");
  const orgId = req.headers.get("x-org-id");
  const role = req.headers.get("x-user-role");
  const email = req.headers.get("x-user-email");

  if (userId && orgId && role && email) {
    return { userId, organizationId: orgId, role, email };
  }

  // Fallback: re-verify from cookie or Authorization header
  const cookieHeader = req.headers.get("cookie");
  const authHeader = req.headers.get("Authorization");
  const token =
    extractTokenFromCookie(cookieHeader) ?? extractTokenFromHeader(authHeader);

  if (!token) return null;

  try {
    const payload = verifyToken(token);
    return {
      userId: payload.userId,
      organizationId: payload.organizationId,
      role: payload.role,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

/**
 * Run a callback within an org context (AsyncLocalStorage).
 * Use this in API routes to make prisma queries aware of the current org.
 */
export async function withOrgContext<T>(
  auth: RequestAuth,
  fn: () => Promise<T>
): Promise<T> {
  return orgContextStorage.run(
    {
      userId: auth.userId,
      organizationId: auth.organizationId,
      role: auth.role,
      email: auth.email,
    },
    fn
  );
}

/**
 * Require authentication — throws a NextResponse if not authenticated.
 * Convenience wrapper for API routes.
 */
export function requireAuth(req: NextRequest): RequestAuth {
  const auth = getRequestAuth(req);
  if (!auth) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return auth;
}
