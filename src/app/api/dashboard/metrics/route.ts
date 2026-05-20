/**
 * GET /api/dashboard/metrics
 *
 * Aggregates real-time metrics from three DynamoDB tables:
 * - agentis-tickets (JIRA_TABLE_NAME)
 * - agentis-workflows (WORKFLOWS_TABLE)
 * - agentis-events (EVENTS_TABLE)
 *
 * Returns a unified JSON payload with agent activity, ticket stats, and epic progress.
 * Implements a 30-second in-memory TTL cache to reduce DynamoDB reads.
 */

import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { DashboardMetricsResponse } from "./types";

export const dynamic = "force-dynamic";

// --- Configuration ---
const REGION = process.env.AWS_REGION || "us-east-1";
const TICKETS_TABLE = process.env.JIRA_TABLE_NAME || "agentis-tickets";
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || "agentis-workflows";
const EVENTS_TABLE = process.env.EVENTS_TABLE || "agentis-events";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

// --- In-memory cache (30s TTL) ---
let cachedResponse: DashboardMetricsResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

// --- Helpers ---

/**
 * Performs a full table scan, handling pagination automatically.
 */
async function fullScan(tableName: string, filterExpression?: string, expressionValues?: Record<string, unknown>, expressionNames?: Record<string, string>): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const params: Record<string, unknown> = {
      TableName: tableName,
      ExclusiveStartKey: lastKey,
    };
    if (filterExpression) {
      (params as Record<string, unknown>).FilterExpression = filterExpression;
    }
    if (expressionValues) {
      (params as Record<string, unknown>).ExpressionAttributeValues = expressionValues;
    }
    if (expressionNames) {
      (params as Record<string, unknown>).ExpressionAttributeNames = expressionNames;
    }

    const result = await ddb.send(new ScanCommand(params as never));
    if (result.Items) {
      items.push(...(result.Items as Record<string, unknown>[]));
    }
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return items;
}

/**
 * Build metrics from raw DynamoDB data.
 */
async function buildMetrics(): Promise<DashboardMetricsResponse> {
  // --- 1. Tickets ---
  const allTickets = await fullScan(TICKETS_TABLE);
  const tickets = allTickets.filter((t) => t.ticketId !== "__COUNTER__");

  const resolved = tickets.filter((t) => t.status === "done").length;
  const inProgress = tickets.filter((t) => t.status === "in_progress").length;

  // Stories = non-epic tickets
  const stories = tickets.filter((t) => t.type !== "epic");
  const storiesDone = stories.filter((t) => t.status === "done").length;
  const storiesActive = stories.filter((t) => t.status !== "done").length;

  // Average resolution time (done tickets with createdAt and updatedAt)
  const doneTickets = tickets.filter((t) => t.status === "done");
  let avgResolutionMinutes = 0;
  if (doneTickets.length > 0) {
    const totalMs = doneTickets.reduce((sum, t) => {
      const created = t.createdAt ? new Date(t.createdAt as string).getTime() : 0;
      const updated = t.updatedAt ? new Date(t.updatedAt as string).getTime() : 0;
      if (created && updated && updated > created) {
        return sum + (updated - created);
      }
      return sum;
    }, 0);
    avgResolutionMinutes = totalMs / doneTickets.length / 60_000;
  }

  // Throughput: tickets done in last 7 days / 7
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentDone = doneTickets.filter((t) => {
    const updated = t.updatedAt ? new Date(t.updatedAt as string).getTime() : 0;
    return updated > sevenDaysAgo;
  });
  const throughputPerDay = recentDone.length / 7;

  // Automation rate (hardcoded for now)
  const automationRate = 100;

  // --- 2. Workflows ---
  const allWorkflows = await fullScan(WORKFLOWS_TABLE);

  // Active epics: workflows NOT in "complete" or "error" phase
  const activeEpics = allWorkflows.filter(
    (w) => w.phase !== "complete" && w.phase !== "error"
  ).length;

  // Last 5 workflows that have tickets associated
  const workflowsWithTickets = allWorkflows
    .filter((w) => {
      // A workflow has tickets if there's at least one ticket referencing its workflowId
      return tickets.some((t) => t.workflowId === w.workflowId);
    })
    .sort((a, b) => {
      const aTime = a.startedAt ? new Date(a.startedAt as string).getTime() : 0;
      const bTime = b.startedAt ? new Date(b.startedAt as string).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  const epics = workflowsWithTickets.map((w) => {
    const wfId = w.workflowId as string;
    const input = w.input as Record<string, unknown> | undefined;
    const title = input?.title ? String(input.title) : wfId;

    const wfTickets = tickets.filter((t) => t.workflowId === wfId);
    const totalTickets = wfTickets.length;
    const epicDoneTickets = wfTickets.filter((t) => t.status === "done").length;
    const progress = totalTickets > 0 ? Math.round((epicDoneTickets / totalTickets) * 100) : 0;

    return {
      workflowId: wfId,
      title,
      totalTickets,
      doneTickets: epicDoneTickets,
      progress,
    };
  });

  // --- 3. Events ---
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let recentEvents: Record<string, unknown>[] = [];
  try {
    recentEvents = await fullScan(
      EVENTS_TABLE,
      "#ts > :cutoff",
      { ":cutoff": twentyFourHoursAgo },
      { "#ts": "timestamp" }
    );
  } catch {
    // If table doesn't exist or filter fails, continue with empty events
    recentEvents = [];
  }

  // Invocations: count events where type = "agent.started"
  const startedEvents = recentEvents.filter((e) => e.type === "agent.started");
  const invocations = startedEvents.length;

  // Sessions: count unique workflowId values
  const uniqueWorkflowIds = new Set(
    recentEvents.map((e) => e.workflowId as string).filter(Boolean)
  );
  const sessions = uniqueWorkflowIds.size;

  // Duration: match started/complete event pairs and calculate durations
  const completedEvents = recentEvents.filter((e) => e.type === "agent.completed");
  const durations: number[] = [];

  for (const started of startedEvents) {
    const matchingComplete = completedEvents.find(
      (c) =>
        c.workflowId === started.workflowId &&
        c.agentId === started.agentId &&
        c.taskId === started.taskId
    );
    if (matchingComplete) {
      const startTime = started.timestamp
        ? new Date(started.timestamp as string).getTime()
        : 0;
      const endTime = matchingComplete.timestamp
        ? new Date(matchingComplete.timestamp as string).getTime()
        : 0;
      if (startTime && endTime && endTime > startTime) {
        durations.push((endTime - startTime) / 1000); // seconds
      }
    }
  }

  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  const avgDuration = durations.length > 0 ? totalDuration / durations.length : 0;

  // Active agents: count unique assignees on in_progress tickets
  const activeAgentSet = new Set(
    tickets
      .filter((t) => t.status === "in_progress" && t.assignee)
      .map((t) => t.assignee as string)
  );
  const activeAgents = activeAgentSet.size;

  return {
    agentActivity: {
      invocations,
      sessions,
      avgDuration: Math.round(avgDuration * 100) / 100,
      totalDuration: Math.round(totalDuration * 100) / 100,
      activeAgents,
      tokens: null,
    },
    tickets: {
      resolved,
      inProgress,
      activeEpics,
      storiesDone,
      storiesActive,
      avgResolutionMinutes: Math.round(avgResolutionMinutes * 100) / 100,
      throughputPerDay: Math.round(throughputPerDay * 100) / 100,
      automationRate,
    },
    epics,
    timestamp: new Date().toISOString(),
  };
}

// --- Route Handler ---

export async function GET() {
  try {
    const now = Date.now();

    // Return cached response if within TTL
    if (cachedResponse && now - cacheTimestamp < CACHE_TTL_MS) {
      return NextResponse.json(cachedResponse, {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
        },
      });
    }

    // Build fresh metrics
    const metrics = await buildMetrics();

    // Update cache
    cachedResponse = metrics;
    cacheTimestamp = now;

    return NextResponse.json(metrics, {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[dashboard/metrics] Error:", message);
    return NextResponse.json(
      { error: "Failed to fetch dashboard metrics", details: message },
      { status: 500 }
    );
  }
}
