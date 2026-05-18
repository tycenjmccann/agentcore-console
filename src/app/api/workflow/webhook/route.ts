import { NextRequest, NextResponse } from "next/server";
import { handleAgentCompletion, handleJiraWebhook, handleQaFixRequest } from "@/lib/workflow/engine";
import { ensureRehydrated } from "@/lib/workflow/store";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "dev-secret";

/**
 * POST /api/workflow/webhook
 *
 * Event-driven completion handler. Receives signals from:
 * 1. workflow-output Lambda — agent called report_completion tool
 * 2. Jira Cloud webhook — ticket transitioned to "Done" externally
 *
 * This is the primary mechanism that drives workflow forward after agents finish.
 */
export async function POST(req: NextRequest) {
  // Validate webhook secret (skip in dev if not configured)
  const secret = req.headers.get("x-webhook-secret");
  if (WEBHOOK_SECRET !== "dev-secret" && secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await ensureRehydrated();

  const eventType = body.event_type as string;

  try {
    switch (eventType) {
      // ─── Agent Completion (from workflow-output Lambda) ──────────────────
      case "agent_completion": {
        const workflowId = body.workflow_id as string;
        const agentId = body.agent_id as string;

        if (!workflowId || !agentId) {
          return NextResponse.json(
            { error: "workflow_id and agent_id are required" },
            { status: 400 }
          );
        }

        const result = await handleAgentCompletion(workflowId, agentId, {
          output: body.output as string | undefined,
          summary: body.summary as string | undefined,
          branch: body.branch as string | undefined,
          commitSha: body.commit_sha as string | undefined,
          prUrl: body.pr_url as string | undefined,
          artifacts: body.artifacts as Array<{ name: string; type: string }> | undefined,
          source: "webhook",
        });

        if (!result.success) {
          console.warn(`[webhook] Agent completion failed: ${result.error}`);
          // Still return 200 to prevent retries for non-transient errors
          return NextResponse.json({ received: true, warning: result.error });
        }

        console.log(`[webhook] Agent ${agentId} completion processed for workflow ${workflowId}`);
        return NextResponse.json({ received: true, processed: true });
      }

      // ─── QA Fix Request (QA agent found issues) ───────────────────────
      case "request_fix": {
        const workflowId = body.workflow_id as string;
        const targetAgent = body.target_agent as string;
        const findings = body.findings as string;
        const severity = (body.severity as string) || "blocking";
        const qaTicketId = body.qa_ticket_id as string;

        if (!workflowId || !targetAgent || !findings || !qaTicketId) {
          return NextResponse.json(
            { error: "workflow_id, target_agent, findings, and qa_ticket_id are required" },
            { status: 400 }
          );
        }

        const result = await handleQaFixRequest(workflowId, {
          targetAgent,
          findings,
          severity: severity as "blocking" | "cosmetic",
          qaTicketId,
        });

        if (!result.success) {
          console.warn(`[webhook] QA fix request failed: ${result.error}`);
          return NextResponse.json({ received: true, warning: result.error });
        }

        console.log(`[webhook] QA fix request processed: ${targetAgent} for workflow ${workflowId}`);
        return NextResponse.json({ received: true, processed: true });
      }

      // ─── Jira Webhook (ticket status change) ────────────────────────────
      case "jira_transition": {
        const issueKey = body.issue_key as string || (body.issue as { key?: string })?.key as string;
        const status = body.status as string ||
          (body.changelog as { items?: Array<{ field: string; toString: string }> })
            ?.items?.find((i) => i.field === "status")?.toString?.toLowerCase();

        if (!issueKey) {
          return NextResponse.json({ error: "issue_key required" }, { status: 400 });
        }

        const result = await handleJiraWebhook(issueKey, status || "done");

        if (!result.success) {
          console.warn(`[webhook] Jira webhook failed: ${result.error}`);
        }

        return NextResponse.json({ received: true, processed: result.success });
      }

      // ─── Jira native webhook format (issue_updated) ─────────────────────
      case undefined: {
        // Jira sends webhooks without our event_type field
        // Detect by presence of Jira-specific fields
        if (body.webhookEvent === "jira:issue_updated" || body.issue) {
          const issueKey = (body.issue as { key?: string })?.key;
          const changelog = body.changelog as { items?: Array<{ field: string; toString: string }> };
          const statusChange = changelog?.items?.find((i) => i.field === "status");

          if (issueKey && statusChange) {
            const newStatus = statusChange.toString.toLowerCase();
            const result = await handleJiraWebhook(issueKey, newStatus);
            return NextResponse.json({ received: true, processed: result.success });
          }
        }

        return NextResponse.json({ received: true, ignored: true });
      }

      default:
        return NextResponse.json({ received: true, ignored: true, reason: `Unknown event_type: ${eventType}` });
    }
  } catch (err) {
    console.error("[webhook] Error processing webhook:", err);
    return NextResponse.json(
      { error: `Internal error: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
