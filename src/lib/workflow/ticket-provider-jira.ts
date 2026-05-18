/**
 * Jira Cloud Ticket Provider — Stub
 *
 * Placeholder for real Jira Cloud integration.
 * Set TICKET_PROVIDER=jira and JIRA_* env vars to use.
 */

import type { TicketProvider, CreateEpicInput, CreateTicketInput } from "./ticket-provider";
import type { JiraTicket, JiraComment, Artifact } from "./types";

export class JiraCloudProvider implements TicketProvider {
  createEpic(_input: CreateEpicInput): JiraTicket {
    throw new Error("Jira Cloud provider not yet implemented. Set TICKET_PROVIDER=memory or configure JIRA_* env vars.");
  }

  createTicket(_input: CreateTicketInput): JiraTicket {
    throw new Error("Jira Cloud provider not yet implemented.");
  }

  markDone(_ticketId: string, _workflowId: string): string[] {
    throw new Error("Jira Cloud provider not yet implemented.");
  }

  markInProgress(_ticketId: string, _workflowId: string): void {
    throw new Error("Jira Cloud provider not yet implemented.");
  }

  markBlocked(_ticketId: string, _reason: string, _workflowId: string): void {
    throw new Error("Jira Cloud provider not yet implemented.");
  }

  addArtifact(_ticketId: string, _artifact: Omit<Artifact, "id" | "timestamp">): Artifact {
    throw new Error("Jira Cloud provider not yet implemented.");
  }

  addComment(_ticketId: string, _author: string, _content: string): JiraComment {
    throw new Error("Jira Cloud provider not yet implemented.");
  }

  isWorkflowComplete(_epicId: string): boolean {
    throw new Error("Jira Cloud provider not yet implemented.");
  }
}
