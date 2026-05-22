/**
 * Jira Cloud read helpers for the event-driven workflow UI.
 * Used when TICKET_PROVIDER=jira to fetch tickets directly from Jira
 * instead of DynamoDB. Uses plain fetch() — no AWS SDK needed.
 */

const JIRA_SITE_URL = process.env.JIRA_SITE_URL || "";
const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY || "TEAM";

function getAuthHeader(): string {
  return `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64")}`;
}

function getBaseUrl(): string {
  return `https://${JIRA_SITE_URL}`;
}

// ─── Status Mapping ─────────────────────────────────────────────────────────

const JIRA_TO_INTERNAL_STATUS: Record<string, string> = {
  "To Do": "todo",
  "Ready": "ready",
  "In Progress": "in_progress",
  "In Review": "in_review",
  "Blocked": "blocked",
  "Done": "done",
  "Backlog": "backlog",
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get all tickets for a workflow from Jira.
 * Tickets are labeled with `wf:<workflowId>` during creation.
 */
export async function getTicketsForWorkflowFromJira(workflowId: string) {
  const jql = `project = ${JIRA_PROJECT_KEY} AND labels = "wf:${workflowId}" ORDER BY created ASC`;
  const params = new URLSearchParams({
    jql,
    fields: "summary,status,issuetype,parent,labels,issuelinks,assignee,created,updated,description",
    maxResults: "100",
  });

  const response = await fetch(`${getBaseUrl()}/rest/api/3/search/jql?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: getAuthHeader(),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Jira search failed: ${response.status} ${response.statusText}: ${errorText}`);
  }

  const data = await response.json();
  const issues = (data.issues || []) as Array<Record<string, unknown>>;

  return issues.map(mapIssueToTicket);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapIssueToTicket(issue: Record<string, unknown>) {
  const fields = issue.fields as Record<string, unknown>;
  const status = fields?.status as Record<string, unknown> | undefined;
  const statusName = (status?.name as string) || "To Do";
  const issuetype = fields?.issuetype as Record<string, unknown> | undefined;
  const parent = fields?.parent as Record<string, unknown> | undefined;
  const issueLinks = (fields?.issuelinks as Array<Record<string, unknown>>) || [];
  const labels = (fields?.labels as string[]) || [];

  // Extract blockedBy from issue links
  const blockedBy: string[] = [];
  for (const link of issueLinks) {
    const linkType = link.type as Record<string, unknown> | undefined;
    if (linkType?.name === "Blocks" && link.inwardIssue) {
      const inward = link.inwardIssue as Record<string, unknown>;
      blockedBy.push(inward.key as string);
    }
  }

  // Extract assignee from labels (agent:<name>)
  const agentLabel = labels.find((l) => l.startsWith("agent:"));
  const assignee = agentLabel ? agentLabel.replace("agent:", "") : undefined;

  // Extract workflowId from labels
  const wfLabel = labels.find((l) => l.startsWith("wf:"));
  const workflowId = wfLabel ? wfLabel.replace("wf:", "") : undefined;

  const issueTypeName = (issuetype?.name as string)?.toLowerCase() || "task";

  return {
    ticketId: issue.key as string,
    title: (fields?.summary as string) || "",
    status: JIRA_TO_INTERNAL_STATUS[statusName] || "todo",
    assignee,
    parentId: parent?.key as string | undefined,
    blockedBy: blockedBy.length > 0 ? blockedBy.join(",") : "",
    workflowId,
    type: issueTypeName,
    createdAt: (fields?.created as string) || new Date().toISOString(),
    updatedAt: (fields?.updated as string) || new Date().toISOString(),
  };
}
