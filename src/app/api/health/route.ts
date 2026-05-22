import { NextResponse } from "next/server";

interface HealthResponse {
  status: "ok";
  timestamp: string;
  uptime: number;
}

/**
 * GET /api/health
 *
 * Returns system health status information.
 * No authentication required. No external dependencies.
 *
 * Response time target: < 10ms (no I/O)
 *
 * @returns {HealthResponse} { status: "ok", timestamp: ISO 8601, uptime: seconds }
 */
export function GET(): NextResponse<HealthResponse> {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
