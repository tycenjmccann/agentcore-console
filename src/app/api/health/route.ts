import { NextResponse } from "next/server";

/**
 * GET /api/health
 *
 * Health check endpoint returning service status information.
 * Used by load balancers, monitoring systems, and deployment pipelines
 * to verify the application is running and responsive.
 *
 * Response time target: < 10ms (no external dependencies)
 *
 * @returns {{ status: string; timestamp: string; uptime: number }}
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
