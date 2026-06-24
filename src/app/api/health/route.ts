import { NextResponse } from "next/server";

export interface HealthResponse {
  status: "ok";
  timestamp: string;
  uptime: number;
}

/**
 * GET /api/health
 *
 * Returns system health status. No authentication required.
 * Used by load balancers, monitoring, and uptime checks.
 *
 * @returns {HealthResponse} { status: "ok", timestamp: ISO 8601 string, uptime: seconds }
 */
export async function GET(): Promise<NextResponse<HealthResponse>> {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
