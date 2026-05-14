import { NextRequest, NextResponse } from "next/server";
import {
  BedrockAgentCoreClient,
  ListEventsCommand,
  CreateEventCommand,
} from "@aws-sdk/client-bedrock-agentcore";
import { findMemoryForAgent } from "@/lib/agentcore-sdk";

const REGION = process.env.AWS_REGION || "us-east-1";
const DEFAULT_ACTOR_ID = "agentcore_user";

let client: BedrockAgentCoreClient | null = null;
function getClient(): BedrockAgentCoreClient {
  if (!client) client = new BedrockAgentCoreClient({ region: REGION });
  return client;
}

/**
 * GET /api/agentcore/memory/events?agent_id=xxx&session_id=yyy
 * Lists events (conversation turns) for a session
 */
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agent_id");
  const sessionId = req.nextUrl.searchParams.get("session_id");
  const actorId = req.nextUrl.searchParams.get("actor_id") || DEFAULT_ACTOR_ID;

  if (!agentId || !sessionId) {
    return NextResponse.json({ error: "agent_id and session_id required" }, { status: 400 });
  }

  const memoryId = await findMemoryForAgent(agentId);
  if (!memoryId) {
    return NextResponse.json({ messages: [] });
  }

  try {
    const c = getClient();
    const res = await c.send(
      new ListEventsCommand({
        memoryId,
        actorId,
        sessionId,
        includePayloads: true,
        maxResults: 100,
      })
    );

    // Parse events into chat messages
    // ListEvents returns newest-first by default — reverse events to get chronological order
    const events = [...(res.events || [])].reverse();
    const messages: Array<{ role: string; content: string; timestamp: string }> = [];

    for (const event of events) {
      if (event.payload) {
        for (const item of event.payload) {
          // SDK uses { conversational: { role, content: { text } } }
          if ("conversational" in item && item.conversational) {
            const conv = item.conversational;
            let text = "";
            if (conv.content && "text" in conv.content) {
              text = conv.content.text || "";
            }

            // Handle nested JSON format from Converse API storage
            // e.g. {"message": {"role": "user", "content": [{"text": "..."}]}}
            let role = conv.role || "user";
            try {
              const parsed = JSON.parse(text);
              if (parsed.message?.content) {
                const contents = parsed.message.content;
                const textParts = contents
                  .filter((c: Record<string, unknown>) => c.text)
                  .map((c: Record<string, unknown>) => c.text);
                if (textParts.length > 0) {
                  text = textParts.join("\n");
                  role = parsed.message.role || role;
                } else {
                  // Skip tool use/result messages without text
                  continue;
                }
              }
            } catch {
              // Not JSON — use raw text as-is (this is our clean format)
            }

            if (text.trim()) {
              messages.push({
                role: role.toUpperCase() === "ASSISTANT" ? "assistant" : "user",
                content: text,
                timestamp: event.eventTimestamp?.toISOString() || "",
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Memory events error:", error);
    return NextResponse.json({ messages: [] });
  }
}

/**
 * POST /api/agentcore/memory/events
 * Store a conversation turn (user + assistant) in memory
 */
export async function POST(req: NextRequest) {
  const { agent_id, session_id, actor_id, user_message, assistant_message } = await req.json();

  if (!agent_id || !session_id || !user_message) {
    return NextResponse.json({ error: "agent_id, session_id, user_message required" }, { status: 400 });
  }

  const memoryId = await findMemoryForAgent(agent_id);
  if (!memoryId) {
    // No memory configured for this agent — silently skip
    return NextResponse.json({ stored: false });
  }

  // Build payload using SDK's discriminated union format
  // Roles must be uppercase: USER, ASSISTANT, TOOL, OTHER
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any[] = [
    {
      conversational: {
        role: "USER",
        content: { text: user_message },
      },
    },
  ];

  if (assistant_message) {
    payload.push({
      conversational: {
        role: "ASSISTANT",
        content: { text: assistant_message },
      },
    });
  }

  try {
    const c = getClient();
    await c.send(
      new CreateEventCommand({
        memoryId,
        actorId: actor_id || DEFAULT_ACTOR_ID,
        sessionId: session_id,
        eventTimestamp: new Date(),
        payload,
      })
    );
    return NextResponse.json({ stored: true });
  } catch (error) {
    console.error("Memory store error:", error);
    return NextResponse.json({ stored: false, error: String(error) });
  }
}
