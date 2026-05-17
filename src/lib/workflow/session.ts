/**
 * Session ID generation for workflow agents.
 * Pattern: {TICKET-ID}_{agent-role}_sess_{randomId}{timestamp}
 *
 * This ties traces and sessions to Jira tickets, making them queryable
 * by ticket ID in CloudWatch Logs Insights (via attributes.session.id).
 */

import { randomBytes } from "crypto";

/**
 * Generate a workflow session ID that encodes the ticket and agent role.
 * Example: "TEAM-42_ios-designer_sess_a3f82b1716800000"
 */
export function generateSessionId(ticketId: string, agentRole: string): string {
  const randomPart = randomBytes(4).toString("hex"); // 8 hex chars
  const timestamp = Date.now().toString(36);          // compact timestamp
  const sanitizedRole = agentRole.replace(/^team-/, ""); // strip "team-" prefix
  return `${ticketId}_${sanitizedRole}_sess_${randomPart}${timestamp}`;
}

/**
 * Extract the ticket ID from a session ID.
 * Returns undefined if the session ID doesn't match the expected pattern.
 */
export function extractTicketId(sessionId: string): string | undefined {
  const match = sessionId.match(/^(TEAM-\d+)_/);
  return match ? match[1] : undefined;
}

/**
 * Extract the agent role from a session ID.
 */
export function extractAgentRole(sessionId: string): string | undefined {
  const match = sessionId.match(/^TEAM-\d+_([^_]+)_sess_/);
  return match ? match[1] : undefined;
}
