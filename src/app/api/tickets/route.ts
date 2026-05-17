import { NextRequest, NextResponse } from "next/server";
import { JiraTicket, TicketStatus } from "@/lib/workflow/types";

// In-memory ticket storage
const tickets = new Map<string, JiraTicket>();

// Seed with mock tickets
function seedTickets() {
  if (tickets.size === 0) {
    const mockTickets: JiraTicket[] = [
      {
        id: "TEAM-58",
        type: "task",
        title: "Analyze workflow management requirements",
        description: "Gather requirements for workflow UI implementation",
        status: "done",
        assignee: "team-requirements-analyst",
        parent: "TEAM-1",
        children: ["TEAM-59"],
        blockedBy: [],
        comments: [
          {
            id: "c1",
            author: "team-requirements-analyst",
            content: "Requirements analysis complete. Created ticket for frontend implementation.",
            timestamp: new Date(Date.now() - 3000000).toISOString()
          }
        ],
        artifacts: [],
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 3000000).toISOString()
      },
      {
        id: "TEAM-59",
        type: "task",
        title: "Implement the feature based on design specs",
        description: "Create workflow management UI with list, detail, and creation views",
        status: "in_progress",
        assignee: "team-frontend-dev",
        parent: "TEAM-1",
        children: [],
        blockedBy: [],
        comments: [
          {
            id: "c2",
            author: "team-frontend-dev",
            content: "Started implementation. Creating branch feature/TEAM-59-frontend-dev",
            timestamp: new Date(Date.now() - 1800000).toISOString()
          }
        ],
        artifacts: [],
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        updatedAt: new Date(Date.now() - 1800000).toISOString()
      },
      {
        id: "TEAM-1",
        type: "epic",
        title: "Workflow Management System",
        description: "Complete agentic workflow management for AgentCore console",
        status: "in_progress",
        children: ["TEAM-58", "TEAM-59"],
        blockedBy: [],
        comments: [],
        artifacts: [],
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        updatedAt: new Date(Date.now() - 1800000).toISOString()
      }
    ];

    mockTickets.forEach(t => tickets.set(t.id, t));
  }
}

seedTickets();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const workflowId = searchParams.get("workflowId");

  if (id) {
    const ticket = tickets.get(id);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    return NextResponse.json(ticket);
  }

  // List tickets, optionally filtered by workflowId
  let allTickets = Array.from(tickets.values());
  
  // For now, just return all tickets
  return NextResponse.json({ tickets: allTickets });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, description, type, assignee, parent, blockedBy } = body;

  if (!title || !type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const ticketId = `TEAM-${tickets.size + 1}`;

  const ticket: JiraTicket = {
    id: ticketId,
    type: type || "task",
    title,
    description: description || "",
    status: "backlog",
    assignee,
    parent,
    children: [],
    blockedBy: blockedBy || [],
    comments: [],
    artifacts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  tickets.set(ticketId, ticket);

  // Update parent's children array
  if (parent) {
    const parentTicket = tickets.get(parent);
    if (parentTicket) {
      parentTicket.children.push(ticketId);
      tickets.set(parent, parentTicket);
    }
  }

  return NextResponse.json({ ticket }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, status, assignee, comment } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing ticket ID" }, { status: 400 });
  }

  const ticket = tickets.get(id);
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  if (status) {
    ticket.status = status;
  }

  if (assignee !== undefined) {
    ticket.assignee = assignee;
  }

  if (comment) {
    ticket.comments.push({
      id: `c${ticket.comments.length + 1}`,
      author: comment.author || "system",
      content: comment.content,
      timestamp: new Date().toISOString()
    });
  }

  ticket.updatedAt = new Date().toISOString();
  tickets.set(id, ticket);

  return NextResponse.json({ ticket });
}