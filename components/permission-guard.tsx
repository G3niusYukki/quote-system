"use client";

import { useEffect, useState } from "react";
import { hasPermission, type Action } from "@/lib/rbac";

interface PermissionGuardProps {
  action: Action;
  /** If true, renders null when denied. If false (default), renders children regardless. */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Frontend permission guard.
 * Fetches the current user's role from /api/me and shows/hides children
 * based on the RBAC matrix.
 *
 * Note: This is a UX convenience guard only — all permission checks are
 * also enforced server-side in the API routes.
 */
export default function PermissionGuard({
  action,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        const role = d.user?.role;
        setAllowed(hasPermission(role, action));
      })
      .catch(() => setAllowed(false));
  }, [action]);

  if (allowed === null) return null;
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
