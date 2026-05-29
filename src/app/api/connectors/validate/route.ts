import { NextResponse } from "next/server";

export async function POST() {
  await new Promise((resolve) => setTimeout(resolve, 1500));

  return NextResponse.json({
    results: [
      { id: "github", name: "GitHub", status: "connected", checks: { total: 5, passed: 5 } },
      { id: "jira", name: "Jira", status: "failed", checks: { total: 4, passed: 2 } },
      { id: "slack", name: "Slack", status: "connected", checks: { total: 4, passed: 4 } },
      { id: "s3", name: "AWS S3", status: "connected", checks: { total: 4, passed: 4 } },
    ],
    validatedAt: new Date().toISOString(),
  });
}
