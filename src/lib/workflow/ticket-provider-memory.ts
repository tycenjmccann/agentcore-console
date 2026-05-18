/**
 * In-Memory Ticket Provider
 *
 * Wraps the jira-mock module to implement the TicketProvider interface.
 * This is the default provider — no external dependencies needed.
 */

import type { TicketProvider, CreateEpicInput, CreateTicketInput } from "./ticket-provider";
import type { JiraTicket, JiraComment, Artifact } from "./types";
import * as jiraMock from "./jira-mock";

export class InMemoryProvider implements TicketProvider {
  createEpic(input: CreateEpicInput): JiraTicket {
    return jiraMock.createEpic(input);
  }

  createTicket(input: CreateTicketInput, workflowId?: string): JiraTicket {
    return jiraMock.createTicket(input, workflowId);
  }

  markDone(ticketId: string, workflowId: string): string[] {
    return jiraMock.markDone(ticketId, workflowId);
  }

  markInProgress(ticketId: string, workflowId: string): void {
    jiraMock.markInProgress(ticketId, workflowId);
  }

  markBlocked(ticketId: string, reason: string, workflowId: string): void {
    jiraMock.markBlocked(ticketId, reason, workflowId);
  }

  addArtifact(ticketId: string, artifact: Omit<Artifact, "id" | "timestamp">): Artifact {
    return jiraMock.addArtifact(ticketId, artifact);
  }

  addComment(ticketId: string, author: string, content: string): JiraComment {
    return jiraMock.addComment(ticketId, author, content);
  }

  isWorkflowComplete(epicId: string): boolean {
    return jiraMock.isWorkflowComplete(epicId);
  }
}
