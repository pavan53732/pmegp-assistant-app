// ─── API Error Handler ──────────────────────────────────────────────────────
// Consistent error and success response helpers for all API routes.
// Produces a uniform JSON structure:
//   Error:   { "success": false, "error": { "message": "...", "code": "..." } }
//   Success: { "success": true, "data": { ... } }
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";

/** Map HTTP status codes to semantic error codes. */
function statusCodeToCode(status: number): string {
  const map: Record<number, string> = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "UNPROCESSABLE_ENTITY",
    429: "RATE_LIMITED",
    500: "INTERNAL_ERROR",
    502: "BAD_GATEWAY",
    503: "SERVICE_UNAVAILABLE",
  };
  return map[status] ?? "UNKNOWN_ERROR";
}

/**
 * Return a consistent error response.
 *
 * @param message  - Human-readable error description.
 * @param status   - HTTP status code (default 500).
 */
export function apiError(message: string, status: number = 500): Response {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code: statusCodeToCode(status),
      },
    },
    { status }
  );
}

/**
 * Return a consistent success response.
 *
 * @param data   - The response payload.
 * @param status - HTTP status code (default 200).
 */
export function apiSuccess(data: unknown, status: number = 200): Response {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}