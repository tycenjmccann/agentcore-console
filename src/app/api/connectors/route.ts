import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    connectors: [
      {
        id: "github",
        name: "GitHub",
        status: "connected",
        description: "tycenjmccann/agentcore-console",
        lastValidated: "2 min ago",
        checks: {
          total: 5,
          passed: 5,
          items: [
            { name: "Authentication token valid", status: "pass" },
            { name: "Repository access confirmed", status: "pass" },
            { name: "Webhook endpoint reachable", status: "pass" },
            { name: "Rate limit within threshold", status: "pass" },
            { name: "Event subscription active", status: "pass" },
          ],
        },
      },
      {
        id: "jira",
        name: "Jira",
        status: "failed",
        description: "TEAM project · agentcore.atlassian.net",
        lastValidated: "15 min ago",
        checks: {
          total: 4,
          passed: 2,
          items: [
            { name: "API endpoint reachable", status: "pass" },
            { name: "Authentication valid", status: "pass" },
            {
              name: "Project permissions insufficient",
              status: "fail",
              detail: "Service account lacks 'Browse Projects' for TEAM",
            },
            {
              name: "Webhook delivery failing",
              status: "fail",
              detail: "Last 3 deliveries returned HTTP 403",
            },
          ],
        },
      },
      {
        id: "slack",
        name: "Slack",
        status: "validating",
        description: "#agentcore-alerts · agentcore-workspace",
        lastValidated: null,
        checks: {
          total: 4,
          passed: 2,
          items: [
            { name: "OAuth token valid", status: "pass" },
            { name: "Channel access verified", status: "pass" },
            { name: "Checking message posting permissions", status: "in_progress" },
            { name: "Webhook delivery test", status: "pending" },
          ],
        },
        progress: 60,
      },
      {
        id: "s3",
        name: "AWS S3",
        status: "connected",
        description: "agentcore-knowledge-prod · us-east-1",
        lastValidated: "1 hour ago",
        checks: {
          total: 4,
          passed: 4,
          items: [
            { name: "IAM role assumption successful", status: "pass" },
            { name: "Bucket read/write access verified", status: "pass" },
            { name: "KMS encryption key accessible", status: "pass" },
            { name: "Event notification configured", status: "pass" },
          ],
        },
      },
    ],
  });
}
