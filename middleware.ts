import { NextRequest, NextResponse } from "next/server";
import { verifyTokenEdge, extractTokenFromHeader } from "@/lib/auth";

// Paths that do NOT require authentication
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
];

// Match patterns — Next.js middleware uses route matchers
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // Extract token: try cookie first, then Authorization header
  const authToken = req.cookies.get("auth_token")?.value;
  const bearerToken = extractTokenFromHeader(req.headers.get("Authorization"));
  const token = authToken ?? bearerToken;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  let payload;
  try {
    payload = await verifyTokenEdge(token);
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }
    const redirectUrl = new URL("/login", req.url);
    redirectUrl.searchParams.set("reason", "expired");
    return NextResponse.redirect(redirectUrl);
  }

  // Attach user info to headers so API routes can read it without re-decoding
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id", payload.userId);
  requestHeaders.set("x-org-id", payload.organizationId);
  requestHeaders.set("x-user-role", payload.role);
  requestHeaders.set("x-user-email", payload.email);

  return NextResponse.next({ request: { headers: requestHeaders } });
}
