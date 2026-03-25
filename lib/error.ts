/**
 * lib/error.ts — Unified error class hierarchy and API error handler wrapper.
 */

import { NextResponse } from "next/server";

/**
 * Base application error with HTTP status code and machine-readable code.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = "APP_ERROR"
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── 4xx Errors ────────────────────────────────────────────────────────────────

export class NotFoundError extends AppError {
  statusCode = 404;
  code = "NOT_FOUND";
}

export class UnauthorizedError extends AppError {
  statusCode = 401;
  code = "UNAUTHORIZED";
}

export class ForbiddenError extends AppError {
  statusCode = 403;
  code = "FORBIDDEN";
}

export class BadRequestError extends AppError {
  statusCode = 400;
  code = "BAD_REQUEST";
}

export class ConflictError extends AppError {
  statusCode = 409;
  code = "CONFLICT";
}

export class UnprocessableEntityError extends AppError {
  statusCode = 422;
  code = "UNPROCESSABLE_ENTITY";
}

// ── 5xx Errors ────────────────────────────────────────────────────────────────

export class InternalServerError extends AppError {
  statusCode = 500;
  code = "INTERNAL_SERVER_ERROR";
}

/**
 * Wrapper that converts thrown AppError / Error / Response into a NextResponse.
 * Use like: export const GET = withErrorHandler(async (req) => { ... });
 *
 * Note: requirePermission in lib/rbac throws a Response(..., { status: 403 }),
 * so this wrapper also catches plain Response objects.
 *
 * Runtime: always async, always returns Promise<Response>.
 * We cast the result through `unknown` to satisfy TypeScript's route handler inference.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withErrorHandler(fn: (...args: any[]) => Promise<Response>): (...args: any[]) => Promise<Response> {
  return async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof Response) return e;

      if (e instanceof AppError) {
        return NextResponse.json(
          { error: e.message, code: e.code },
          { status: e.statusCode }
        );
      }
      if (e instanceof Error) {
        console.error("[Unhandled Error]", e);
        return NextResponse.json(
          { error: e.message || "Internal server error" },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
