import jwt from "jsonwebtoken";
import type { AuthPayload } from "./auth-context";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET environment variable is required in production");
    }
    return "fallback-dev-secret-change-me";
  }
  return secret;
}

const JWT_EXPIRES_IN = "7d";

/**
 * Sign a JWT token containing user identity.
 */
export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a JWT token.
 * Throws if invalid or expired.
 */
export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, getJwtSecret()) as unknown as AuthPayload;
}

/**
 * Extract JWT from an Authorization header or cookie string.
 * Returns null if not found.
 */
export function extractTokenFromHeader(authHeader?: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function extractTokenFromCookie(cookieHeader?: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Build Set-Cookie header value for the auth token.
 * HttpOnly, Secure in production, SameSite=Lax.
 */
export function buildAuthCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production";
  const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
  return [
    `auth_token=${token}`,
    `HttpOnly`,
    `Path=/`,
    `Max-Age=${maxAge}`,
    secure ? "Secure" : "",
    "SameSite=Lax",
  ]
    .filter(Boolean)
    .join("; ");
}

/**
 * Build Set-Cookie header value for clearing the auth token.
 */
export function buildClearAuthCookie(): string {
  const secure = process.env.NODE_ENV === "production";
  return [
    "auth_token=;",
    "HttpOnly",
    "Path=/",
    "Max-Age=0",
    secure ? "Secure" : "",
    "SameSite=Lax",
  ]
    .filter(Boolean)
    .join("; ");
}
