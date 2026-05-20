/**
 * POST /api/workflow/[id]/cancel
 *
 * Cancels an active workflow:
 * 1. Validates workflow exists and is in a non-terminal state
 * 2. Sets workflow phase to "cancelled" with completedAt timestamp
 * 3. Transitions all non-done tickets to "cancelled" status
 * 4. Stops running/pending agent tasks
 * 5. Emits SSE events for real-time UI updates
 * 6. Persists to S3 via setWorkflow (automatic for terminal states)
 *
 * Running agents are NOT actively stopped — they will complete their current
 * task but no new tickets will be dispatched since the orchestrator ignores
 * non-actionable statuses.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getWorkflow,
  setWorkflow,
  emitEvent,
  getTicketsForWorkflow,
  setTicket,
} from "@/lib/workflow/store";

export const dynamic = "force-dynamic";

/** Phases that indicate the workflow is already terminal and cannot be cancelled. */
const TERMINAL_PHASES = new Set(["complete", "cancelled", "error"]);

/** Ticket statuses that are considered terminal (should not be overwritten). */
const TERMINAL_TICKET_STATUSES = new Set(["done", "cancelled"]);

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 1. Validate workflow exists
    const workflow = getWorkflow(id);
    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    // 2. Validate the workflow is in an active (non-terminal) state
    if (TERMINAL_PHASES.has(workflow.phase)) {
      return NextResponse.json(
        { error: "Workflow is already completed or cancelled" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 3. Update workflow state to cancelled
    workflow.phase = "cancelled";
    workflow.completedAt = now;
    workflow.error = "Cancelled by user";

    // 4. Stop all running/pending agent tasks
    for (const task of Object.values(workflow.agentTasks)) {
      if (
        task.status === "running" ||
        task.status === "waiting_response" ||
        task.status === "pending"
      ) {
        task.status = "error";
        task.error = "Workflow cancelled by user";
        task.completedAt = now;
      }
    }

    // 5. Cancel all non-done tickets in the workflow
    let ticketsCancelled = 0;
    const allTickets = getTicketsForWorkflow(workflow.epicId);

    for (const ticket of allTickets) {
      if (!TERMINAL_TICKET_STATUSES.has(ticket.status)) {
        ticket.status = "cancelled" as any; // TicketStatus now includes "cancelled"
        ticket.updatedAt = now;
        setTicket(ticket);
        ticketsCancelled++;

        // Emit ticket update event for each cancelled ticket
        emitEvent(id, {
          type: "ticket_update",
          ticketId: ticket.id,
          status: "cancelled" as any,
        });
      }
    }

    // 6. Persist the updated workflow state (setWorkflow handles S3 persistence
    //    immediately for terminal states like "cancelled")
    setWorkflow(workflow);

    // 7. Emit SSE events to all connected subscribers
    emitEvent(id, { type: "workflow_cancelled" });
    emitEvent(id, { type: "phase_change", phase: "cancelled" });

    console.log(
      `[cancel] Workflow ${id} cancelled. ${ticketsCancelled} tickets transitioned to cancelled.`
    );

    // 8. Return success response (matches design doc spec)
    return NextResponse.json({
      cancelled: true,
      ticketsCancelled,
    });
  } catch (err) {
    console.error("[cancel] Unexpected error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
