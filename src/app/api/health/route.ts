import { NextResponse } from "next/server";

export interface HealthResponse {
  status: "ok";
  timestamp: string;
  uptime: number;
}

/**
 * GET /api/health
 *
 * Returns server health status information.
 * No auth, no middleware, no external dependencies.
 *
 * @returns {HealthResponse} { status, timestamp, uptime }
 */
export async function GET(): Promise<NextResponse<HealthResponse>> {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
