/**
 * agentis-jira — Ticket tools Lambda for Jira Cloud.
 *
 * Deploy this when TICKET_PROVIDER=jira.
 * Agents call this Lambda to create/update/transition tickets in Jira.
 *
 * Env vars:
 *   JIRA_SITE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY
 *   AWS_REGION, TICKETS_TABLE (optional DynamoDB mirror)
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

// ─── Jira Config ─────────────────────────────────────────────────────────────

const SITE = process.env.JIRA_SITE_URL;
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || "TEAM";

const BASE_URL = `https://${SITE}`;
const AUTH = `Basic ${Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64")}`;

// ─── DynamoDB Config ─────────────────────────────────────────────────────────

const REGION = process.env.AWS_REGION || "us-east-1";
const TABLE_NAME = process.env.TICKETS_TABLE || "agentis-tickets";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

// ─── Valid Agent Roster (must match orchestrator's AGENT_ROSTER) ─────────────

const VALID_ASSIGNEES = new Set([
  "team-requirements-analyst",
  "team-frontend-designer",
  "team-ios-designer",
  "team-backend-designer",
  "team-android-designer",
  "team-security-reviewer",
  "team-legal-compliance",
  "team-localization",
  "team-analytics-designer",
  "team-backend-dev",
  "team-api-dev",
  "team-frontend-dev",
  "team-qa-verifier",
  "team-ci-agent",
]);

// ─── Status Mapping ──────────────────────────────────────────────────────────

const INTERNAL_TO_JIRA = {
  todo: "To Do",
  ready: "Ready",
  in_progress: "In Progress",
  in_review: "In Review",
  blocked: "Blocked",
  done: "Done",
};

const JIRA_TO_INTERNAL = Object.fromEntries(
  Object.entries(INTERNAL_TO_JIRA).map(([k, v]) => [v.toLowerCase(), k])
);

function mapStatusToInternal(jiraStatus) {
  return JIRA_TO_INTERNAL[jiraStatus.toLowerCase()] || jiraStatus.toLowerCase().replace(/\s+/g, "_");
}

// ─── HTTP Helpers ────────────────────────────────────────────────────────────

async function jiraFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const resp = await fetch(url, {
    ...options,
    headers: {
      Authorization: AUTH,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  if (resp.status === 204) return null;

  const text = await resp.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }

  if (!resp.ok) {
    const msg = body?.errorMessages?.join("; ") || body?.errors
      ? JSON.stringify(body.errors)
      : typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`Jira API ${resp.status}: ${msg}`);
  }
  return body;
}

async function jiraSearch(jql, fields = ["summary", "status", "labels", "assignee", "issuetype", "parent"], maxResults = 50) {
  const params = new URLSearchParams({ jql, fields: fields.join(","), maxResults: String(maxResults) });
  return jiraFetch(`/rest/api/3/search/jql?${params.toString()}`);
}

// ─── Tool Implementations ────────────────────────────────────────────────────

async function createTicket(params) {
  const { summary, description, parent_key, assignee, issue_type, blocked_by, workflow_id } = params;

  // Validate assignee against known roster — reject hallucinated agent names
  if (assignee && !VALID_ASSIGNEES.has(assignee)) {
    const valid = [...VALID_ASSIGNEES].join(", ");
    throw new Error(`Invalid assignee "${assignee}". Valid agents: ${valid}`);
  }

  const labels = [];
  if (assignee) labels.push(`agent:${assignee}`);
  if (workflow_id) labels.push(`wf:${workflow_id}`);

  const fields = {
    project: { key: PROJECT_KEY },
    summary,
    issuetype: { name: issue_type || "Task" },
    labels,
  };

  if (description) {
    fields.description = {
      type: "doc",
      version: 1,
      content: [{ type: "paragraph", content: [{ type: "text", text: description }] }],
    };
  }

  if (parent_key) {
    fields.parent = { key: parent_key };
  }

  // 1. Create in Jira → get the authoritative key
  const created = await jiraFetch("/rest/api/3/issue", {
    method: "POST",
    body: JSON.stringify({ fields }),
  });

  const ticketId = created.key;

  // 2. Create blocking links in Jira
  const blockers = Array.isArray(blocked_by) ? blocked_by : blocked_by ? [blocked_by] : [];
  for (const blockerKey of blockers) {
    try {
      await jiraFetch("/rest/api/3/issueLink", {
        method: "POST",
        body: JSON.stringify({
          type: { name: "Blocks" },
          inwardIssue: { key: blockerKey },
          outwardIssue: { key: ticketId },
        }),
      });
    } catch (err) {
      console.log(`Warning: could not link blocker ${blockerKey} -> ${ticketId}: ${err.message}`);
    }
  }

  // 3. Transition in Jira to the correct initial status.
  //    - If blockers exist: transition to "Blocked" (prevents premature "Ready" webhooks)
  //    - If no blockers + has assignee: transition to "Ready" (tells orchestrator to invoke)
  //    Note: orchestrator also checks blockedBy via issue links as a safety net.
  const ddbStatus = blockers.length > 0 ? "blocked" : "todo";
  if (blockers.length > 0) {
    try {
      const transitions = await jiraFetch(`/rest/api/3/issue/${ticketId}/transitions`);
      const blockedTransition = transitions.transitions.find(
        (t) => t.name.toLowerCase() === "blocked" || t.to.name.toLowerCase() === "blocked"
      );
      if (blockedTransition) {
        await jiraFetch(`/rest/api/3/issue/${ticketId}/transitions`, {
          method: "POST",
          body: JSON.stringify({ transition: { id: blockedTransition.id } }),
        });
      } else {
        console.warn(`[jira-tools] No "Blocked" transition available for ${ticketId} — ticket stays in To Do. Orchestrator blockedBy guard will prevent premature invocation.`);
      }
    } catch (err) {
      console.warn(`[jira-tools] Could not transition ${ticketId} to Blocked: ${err.message}`);
    }
  } else if (assignee) {
    try {
      const transitions = await jiraFetch(`/rest/api/3/issue/${ticketId}/transitions`);
      const readyTransition = transitions.transitions.find(
        (t) => t.name.toLowerCase() === "ready" || t.to.name.toLowerCase() === "ready"
      );
      if (readyTransition) {
        await jiraFetch(`/rest/api/3/issue/${ticketId}/transitions`, {
          method: "POST",
          body: JSON.stringify({ transition: { id: readyTransition.id } }),
        });
      }
    } catch (err) {
      console.log(`[jira-tools] Could not transition ${ticketId} to Ready: ${err.message}`);
    }
  }

  // 4. Write to DynamoDB with the SAME key
  const now = new Date().toISOString();

  await ddb.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      ticketId,
      type: (issue_type || "Task").toLowerCase(),
      title: summary,
      description: description || "",
      status: ddbStatus,
      assignee: assignee || undefined,  // GSI key — omit if empty
      parentId: parent_key || undefined,
      workflowId: workflow_id || undefined,
      comments: [],
      artifacts: [],
      blockedBy: blockers,
      createdAt: now,
      updatedAt: now,
    },
  }));

  console.log(`[jira-tools] Created ${ticketId} in Jira + DDB. Status: ${ddbStatus}`);

  return { ticketId, status: ddbStatus, message: `Created ${ticketId}: ${summary}` };
}

async function transitionTicket(params) {
  const { ticket_id, transition_id, reason } = params;

  const targetStatus = transition_id;
  const jiraStatusName = INTERNAL_TO_JIRA[targetStatus] || targetStatus;

  // Handle "skip" as transition to Done
  const isSkip = targetStatus === "skip";
  const effectiveStatus = isSkip ? "Done" : jiraStatusName;

  // 1. Transition in Jira
  const data = await jiraFetch(`/rest/api/3/issue/${ticket_id}/transitions`);
  const match = data.transitions.find(
    (t) => t.name.toLowerCase() === effectiveStatus.toLowerCase() ||
           t.to.name.toLowerCase() === effectiveStatus.toLowerCase()
  );

  if (!match) {
    const available = data.transitions.map((t) => `${t.name} (-> ${t.to.name})`).join(", ");
    throw new Error(`No transition to "${effectiveStatus}" found. Available: ${available}`);
  }

  await jiraFetch(`/rest/api/3/issue/${ticket_id}/transitions`, {
    method: "POST",
    body: JSON.stringify({ transition: { id: match.id } }),
  });

  // Add skip reason as comment in Jira
  if (isSkip && reason) {
    await addComment({ ticket_id, comment: `Skipped: ${reason}` });
  } else if (reason) {
    await addComment({ ticket_id, comment: reason });
  }

  const finalStatus = isSkip ? "done" : mapStatusToInternal(match.to.name);

  // 2. Update DynamoDB with same status
  const now = new Date().toISOString();
  const updateExpr = reason
    ? "SET #s = :s, #u = :u, #sr = :sr"
    : "SET #s = :s, #u = :u";
  const exprNames = { "#s": "status", "#u": "updatedAt", ...(reason ? { "#sr": "skipReason" } : {}) };
  const exprValues = { ":s": finalStatus, ":u": now, ...(reason ? { ":sr": reason } : {}) };

  try {
    await ddb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { ticketId: ticket_id },
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues,
    }));
  } catch (err) {
    console.warn(`[jira-tools] DDB update failed for ${ticket_id}: ${err.message}`);
  }

  console.log(`[jira-tools] Transitioned ${ticket_id} to ${finalStatus} in Jira + DDB`);

  return { ticketId: ticket_id, status: finalStatus, message: `Transitioned to ${finalStatus}` };
}

async function updateTicket(params) {
  const { ticket_id, description, title } = params;

  // 1. Update in Jira
  const fields = {};
  if (title) fields.summary = title;
  if (description) {
    fields.description = {
      type: "doc",
      version: 1,
      content: [{ type: "paragraph", content: [{ type: "text", text: description }] }],
    };
  }

  await jiraFetch(`/rest/api/3/issue/${ticket_id}`, {
    method: "PUT",
    body: JSON.stringify({ fields }),
  });

  // 2. Update in DynamoDB
  const updates = [];
  const names = {};
  const values = {};

  if (title) { updates.push("#t = :t"); names["#t"] = "title"; values[":t"] = title; }
  if (description) { updates.push("#d = :d"); names["#d"] = "description"; values[":d"] = description; }
  updates.push("#u = :u"); names["#u"] = "updatedAt"; values[":u"] = new Date().toISOString();

  try {
    await ddb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { ticketId: ticket_id },
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }));
  } catch (err) {
    console.warn(`[jira-tools] DDB update failed for ${ticket_id}: ${err.message}`);
  }

  return { ticketId: ticket_id, message: "Updated" };
}

async function listTickets(params) {
  const { parent_id } = params;
  const jql = `parent = ${parent_id} ORDER BY created ASC`;

  const data = await jiraSearch(jql, ["summary", "status", "labels", "assignee", "issuetype"], 100);
  const tickets = (data.issues || []).map(mapIssue);
  return { tickets };
}

async function addComment(params) {
  const { ticket_id, comment } = params;

  // 1. Add to Jira
  await jiraFetch(`/rest/api/3/issue/${ticket_id}/comment`, {
    method: "POST",
    body: JSON.stringify({
      body: {
        type: "doc",
        version: 1,
        content: [{ type: "paragraph", content: [{ type: "text", text: comment }] }],
      },
    }),
  });

  // 2. Add to DynamoDB
  const commentObj = {
    id: `comment-${Date.now()}`,
    author: "agent",
    content: comment,
    timestamp: new Date().toISOString(),
  };

  try {
    await ddb.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { ticketId: ticket_id },
      UpdateExpression: "SET #c = list_append(if_not_exists(#c, :empty), :comment), #u = :now",
      ExpressionAttributeNames: { "#c": "comments", "#u": "updatedAt" },
      ExpressionAttributeValues: {
        ":comment": [commentObj],
        ":empty": [],
        ":now": new Date().toISOString(),
      },
    }));
  } catch (err) {
    console.warn(`[jira-tools] DDB comment failed for ${ticket_id}: ${err.message}`);
  }

  return { ticketId: ticket_id, message: "Comment added" };
}

async function searchIssues(params) {
  const { query, max_results } = params;
  const data = await jiraSearch(query, ["summary", "status", "labels", "assignee", "issuetype", "parent"], max_results || 50);
  const tickets = (data.issues || []).map(mapIssue);
  return { tickets };
}

async function getIssue(params) {
  const { issue_key } = params;
  const issue = await jiraFetch(`/rest/api/3/issue/${issue_key}`);
  return mapIssue(issue);
}

async function getTransitions(params) {
  const { issue_key } = params;
  const data = await jiraFetch(`/rest/api/3/issue/${issue_key}/transitions`);
  const transitions = data.transitions.map((t) => ({
    id: t.id,
    name: t.name,
    to: t.to.name,
    toInternal: mapStatusToInternal(t.to.name),
  }));
  return { issue_key, transitions };
}

async function listProjects() {
  const data = await jiraFetch("/rest/api/3/project/search?maxResults=50");
  const projects = (data.values || []).map((p) => ({
    key: p.key,
    name: p.name,
    id: p.id,
  }));
  return { projects };
}

async function getProjectIssueTypes() {
  return {
    issueTypes: [
      { name: "Epic", description: "A large body of work" },
      { name: "Story", description: "User-facing feature" },
      { name: "Task", description: "A unit of work" },
      { name: "Bug", description: "A defect to fix" },
    ],
  };
}

async function lookupUser(params) {
  const { query } = params;
  const jql = `project = ${PROJECT_KEY} AND labels in ("agent:${query}") ORDER BY created DESC`;

  try {
    const data = await jiraSearch(jql, ["labels"], 1);
    const agents = new Set();
    for (const issue of data.issues || []) {
      for (const label of issue.fields.labels || []) {
        if (label.startsWith("agent:") && label.toLowerCase().includes(query.toLowerCase())) {
          agents.add(label.replace("agent:", ""));
        }
      }
    }

    if (agents.size === 0) {
      const broadJql = `project = ${PROJECT_KEY} AND labels is not EMPTY ORDER BY created DESC`;
      const broadData = await jiraSearch(broadJql, ["labels"], 50);
      for (const issue of broadData.issues || []) {
        for (const label of issue.fields.labels || []) {
          if (label.startsWith("agent:") && label.toLowerCase().includes(query.toLowerCase())) {
            agents.add(label.replace("agent:", ""));
          }
        }
      }
    }

    return { users: [...agents].map((name) => ({ name, type: "agent" })) };
  } catch (err) {
    console.log(`lookupUser error: ${err.message}`);
    return { users: [], message: `No agents found matching "${query}"` };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapIssue(issue) {
  const fields = issue.fields || {};
  const labels = fields.labels || [];
  const agentLabel = labels.find((l) => l.startsWith("agent:"));
  const wfLabel = labels.find((l) => l.startsWith("wf:"));

  return {
    ticketId: issue.key,
    title: fields.summary || "",
    status: mapStatusToInternal(fields.status?.name || "To Do"),
    assignee: agentLabel ? agentLabel.replace("agent:", "") : fields.assignee?.displayName || null,
    issueType: fields.issuetype?.name || "Task",
    parentKey: fields.parent?.key || null,
    workflowId: wfLabel ? wfLabel.replace("wf:", "") : null,
    labels,
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

const TOOLS = {
  Tickets___create_ticket: createTicket,
  Tickets___transition_ticket: transitionTicket,
  Tickets___update_ticket: updateTicket,
  Tickets___list_tickets: listTickets,
  Tickets___add_comment: addComment,
  Tickets___search_issues: searchIssues,
  Tickets___get_issue: getIssue,
  Tickets___get_transitions: getTransitions,
  Tickets___list_projects: listProjects,
  Tickets___get_project_issue_types: getProjectIssueTypes,
  Tickets___lookup_user: lookupUser,
  // Backward compat: accept old prefix during transition
  JiraIntegration___create_ticket: createTicket,
  JiraIntegration___transition_ticket: transitionTicket,
  JiraIntegration___update_ticket: updateTicket,
  JiraIntegration___list_tickets: listTickets,
  JiraIntegration___add_comment: addComment,
  JiraIntegration___search_issues: searchIssues,
  JiraIntegration___get_issue: getIssue,
  JiraIntegration___get_transitions: getTransitions,
  JiraIntegration___list_projects: listProjects,
  JiraIntegration___get_project_issue_types: getProjectIssueTypes,
  JiraIntegration___lookup_user: lookupUser,
};

export const handler = async (event) => {
  const toolName = event.tool_name;
  const params = event.parameters || {};

  console.log(`[jira-tools] tool=${toolName} params=${JSON.stringify(params)}`);

  const fn = TOOLS[toolName];
  if (!fn) {
    console.log(`[jira-tools] Unknown tool: ${toolName}`);
    return { error: `Unknown tool: ${toolName}` };
  }

  try {
    const result = await fn(params);
    console.log(`[jira-tools] tool=${toolName} result=${JSON.stringify(result).slice(0, 500)}`);
    return result;
  } catch (err) {
    console.error(`[jira-tools] tool=${toolName} ERROR: ${err.message}`);
    return { error: err.message };
  }
};
