import { NextResponse } from "next/server";

interface HealthResponse {
  status: "ok";
  timestamp: string;
  uptime: number;
}

/**
 * GET /api/health
 *
 * Returns system health status including server uptime.
 * No authentication required — used by load balancers and monitoring.
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
