import { NextResponse } from "next/server";

/**
 * GET /api/health
 *
 * Returns server health status information.
 * No authentication required — public endpoint for monitoring and load balancers.
 *
 * Response:
 *   - status: "ok" (server is running)
 *   - timestamp: ISO 8601 date string (current server time)
 *   - uptime: number of seconds since process start
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
