"""
Agentis Pipeline Agent — Strands on AgentCore Runtime

A single universal agent code deployed as 13 separate Runtime resources.
The orchestrator passes system_prompt + prompt per invocation to specialize behavior.

Key advantages over Harness:
  - We control botocore read_timeout (600s) so Opus can think without being killed
  - OTel auto-instrumentation is enabled via the CMD in deployment
  - Streaming responses via async generator entrypoint
  - All gateway tools (S3, Jira, GitHub, SkillLoader, WorkflowOutput) via Lambda invocation
"""

import os
import json
import logging
import boto3

from strands import Agent, tool
from strands.models import BedrockModel
from botocore.config import Config as BotocoreConfig
from bedrock_agentcore.runtime import BedrockAgentCoreApp

# Built-in Strands tools — lazy import to stay under 30s init limit
# NOTE: shell, editor, file_write, python_repl need writable /var/task which Runtime doesn't allow
def _load_builtin_tools():
    """Import strands_tools at invocation time, not module load time."""
    from strands_tools import (
        image_reader,
        http_request,
        current_time,
    )
    return [image_reader, http_request, current_time]

# --- Configuration ---
REGION = os.getenv("AWS_REGION", "us-east-1")
MODEL_ID = os.getenv("MODEL_ID", "us.anthropic.claude-opus-4-6-v1")
READ_TIMEOUT = int(os.getenv("READ_TIMEOUT", "600"))  # 10 minutes — no more urllib3 kills
GATEWAY_ARN = os.getenv("GATEWAY_ARN", "arn:aws:bedrock-agentcore:us-east-1:023392223961:gateway/datesparkiamgw-vjme4fyj6k")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agentis-pipeline-agent")

# --- Model with custom timeout (THE FIX) ---
boto_config = BotocoreConfig(
    read_timeout=READ_TIMEOUT,
    connect_timeout=30,
    retries={"max_attempts": 2},
)

model = BedrockModel(
    model_id=MODEL_ID,
    region_name=REGION,
    boto_client_config=boto_config,
    streaming=True,
)

# --- Lambda client for invoking tool backends ---
lambda_client = boto3.client("lambda", region_name=REGION)

# Tool Lambda function names (the gateway targets are backed by these)
S3_TOOLS_LAMBDA = os.getenv("S3_TOOLS_LAMBDA", "agentis-s3-tools")
BUILDER_TOOLS_LAMBDA = os.getenv("BUILDER_TOOLS_LAMBDA", "agentis-builder-tools")
WORKFLOW_OUTPUT_LAMBDA = os.getenv("WORKFLOW_OUTPUT_LAMBDA", "agentis-workflow-output")
SKILL_LOADER_LAMBDA = os.getenv("SKILL_LOADER_LAMBDA", "agentis-skill-loader")

# MCP Servers — connect agents to external tools (GitHub, GitLab, Jira, Asana, etc.)
# Configured via MCP_SERVERS env var (JSON array) or legacy GITHUB_PAT shorthand.
#
# Format: [{"url": "https://...", "headers": {"Authorization": "Bearer xxx"}}]
#
# Examples:
#   GitHub:   {"url": "https://api.githubcopilot.com/mcp/", "headers": {"Authorization": "Bearer ghp_xxx"}}
#   GitLab:   {"url": "https://gitlab.com/-/mcp", "headers": {"PRIVATE-TOKEN": "glpat-xxx"}}
#   Custom:   {"url": "https://my-tools.company.com/mcp"}
#
MCP_SERVERS_JSON = os.getenv("MCP_SERVERS", "")

# Legacy shorthand: GITHUB_PAT auto-creates a GitHub MCP entry
GITHUB_PAT = os.getenv("GITHUB_PAT", "")
GITHUB_MCP_URL = os.getenv("GITHUB_MCP_URL", "https://api.githubcopilot.com/mcp/")

def _parse_mcp_servers():
    """Parse MCP server config from env. Returns list of {url, headers} dicts."""
    servers = []
    # Parse JSON config if provided
    if MCP_SERVERS_JSON:
        try:
            servers = json.loads(MCP_SERVERS_JSON)
        except json.JSONDecodeError:
            logger.warning("MCP_SERVERS env var is not valid JSON — ignoring")
    # Legacy: GITHUB_PAT shorthand adds GitHub MCP automatically
    if GITHUB_PAT and not any(s.get("url", "").startswith("https://api.githubcopilot.com") for s in servers):
        servers.append({
            "url": GITHUB_MCP_URL,
            "headers": {"Authorization": f"Bearer {GITHUB_PAT}"},
        })
    return servers


def _invoke_lambda(function_name: str, tool_name: str, arguments: dict) -> str:
    """Invoke a Lambda-backed tool and return its response text."""
    # Lambda tools expect short names (e.g., "list_objects" not "S3Storage___list_objects")
    short_name = tool_name.split("___")[-1] if "___" in tool_name else tool_name
    payload = {"name": short_name, "arguments": arguments}
    response = lambda_client.invoke(
        FunctionName=function_name,
        Payload=json.dumps(payload).encode(),
    )
    result = json.loads(response["Payload"].read())
    # Lambda tools return {content: [{type: "text", text: "..."}]}
    if isinstance(result, dict) and "content" in result:
        texts = [c.get("text", "") for c in result["content"] if c.get("type") == "text"]
        return "\n".join(texts)
    if isinstance(result, dict) and "errorMessage" in result:
        return f"Error: {result['errorMessage']}"
    return json.dumps(result)


# ─── S3 File Download (for image_reader integration) ─────────────────────────

s3_client = boto3.client("s3", region_name=REGION)

@tool
def download_s3_file(bucket: str, key: str) -> str:
    """Download a file from S3 to local /tmp directory so it can be read by image_reader or other tools.
    Use this for images (PNG, JPG, etc.) that need visual analysis.

    Args:
        bucket: S3 bucket name
        key: Object key/path in the bucket

    Returns:
        Local file path where the file was saved (e.g., /tmp/filename.png)
    """
    import os
    filename = os.path.basename(key)
    local_path = f"/tmp/{filename}"
    s3_client.download_file(bucket, key, local_path)
    size = os.path.getsize(local_path)
    return f"Downloaded to {local_path} ({size} bytes). Use image_reader tool with this path to view the image."


# ─── S3 Storage Tools ─────────────────────────────────────────────────────────

@tool
def S3Storage___read_object(bucket: str, key: str) -> str:
    """Read a TEXT object from S3. Returns the object content as text. For images/binary files, use download_s3_file instead.

    Args:
        bucket: S3 bucket name
        key: Object key/path in the bucket
    """
    return _invoke_lambda(S3_TOOLS_LAMBDA, "S3Storage___read_object", {"bucket": bucket, "key": key})


@tool
def S3Storage___write_object(bucket: str, key: str, content: str, content_type: str = "text/plain") -> str:
    """Write content to an S3 object.

    Args:
        bucket: S3 bucket name
        key: Object key/path in the bucket
        content: Content to write
        content_type: MIME type of the content
    """
    return _invoke_lambda(S3_TOOLS_LAMBDA, "S3Storage___write_object", {
        "bucket": bucket, "key": key, "content": content, "content_type": content_type
    })


@tool
def S3Storage___list_objects(bucket: str, prefix: str = "") -> str:
    """List objects in an S3 bucket under a prefix.

    Args:
        bucket: S3 bucket name
        prefix: Key prefix to filter by
    """
    return _invoke_lambda(S3_TOOLS_LAMBDA, "S3Storage___list_objects", {"bucket": bucket, "prefix": prefix})


# ─── Jira Integration Tools ──────────────────────────────────────────────────

@tool
def JiraIntegration___create_ticket(title: str, description: str, parent_id: str = "", assignee: str = "", ticket_type: str = "task") -> str:
    """Create a new Jira ticket.

    Args:
        title: Ticket title/summary
        description: Detailed description
        parent_id: Parent ticket ID (for subtasks)
        assignee: Agent ID to assign to
        ticket_type: Type of ticket (epic, story, task)
    """
    return _invoke_lambda(BUILDER_TOOLS_LAMBDA, "JiraIntegration___create_ticket", {
        "title": title, "description": description, "parent_id": parent_id,
        "assignee": assignee, "type": ticket_type
    })


@tool
def JiraIntegration___transition_ticket(ticket_id: str, transition_id: str, reason: str = "") -> str:
    """Transition a ticket to a new status (e.g., done, skip, blocked).

    Args:
        ticket_id: The ticket ID to transition
        transition_id: Target status (done, skip, blocked, in_progress, todo)
        reason: Reason for the transition
    """
    return _invoke_lambda(BUILDER_TOOLS_LAMBDA, "JiraIntegration___transition_ticket", {
        "ticket_id": ticket_id, "transition_id": transition_id, "reason": reason
    })


@tool
def JiraIntegration___update_ticket(ticket_id: str, description: str = "", title: str = "") -> str:
    """Update an existing ticket's title or description.

    Args:
        ticket_id: The ticket ID to update
        description: New description (optional)
        title: New title (optional)
    """
    args = {"ticket_id": ticket_id}
    if description:
        args["description"] = description
    if title:
        args["title"] = title
    return _invoke_lambda(BUILDER_TOOLS_LAMBDA, "JiraIntegration___update_ticket", args)


@tool
def JiraIntegration___list_tickets(parent_id: str) -> str:
    """List all child tickets under a parent (epic or story).

    Args:
        parent_id: Parent ticket ID to list children of
    """
    return _invoke_lambda(BUILDER_TOOLS_LAMBDA, "JiraIntegration___list_tickets", {"parent_id": parent_id})


@tool
def JiraIntegration___add_comment(ticket_id: str, comment: str) -> str:
    """Add a comment to a ticket.

    Args:
        ticket_id: The ticket ID to comment on
        comment: Comment text to add
    """
    return _invoke_lambda(BUILDER_TOOLS_LAMBDA, "JiraIntegration___add_comment", {
        "ticket_id": ticket_id, "comment": comment
    })


@tool
def JiraIntegration___search_issues(query: str, max_results: int = 20) -> str:
    """Search for tickets matching a query.

    Args:
        query: Search query string
        max_results: Maximum number of results to return
    """
    return _invoke_lambda(BUILDER_TOOLS_LAMBDA, "JiraIntegration___search_issues", {
        "query": query, "max_results": max_results
    })


# ─── Workflow Output Tools ────────────────────────────────────────────────────

@tool
def WorkflowOutput___report_completion(ticket_id: str, summary: str, artifacts: str = "", branch: str = "", commit_sha: str = "", pr_url: str = "") -> str:
    """Report that your work is complete. This marks your ticket as done.

    Args:
        ticket_id: Your assigned ticket ID
        summary: Summary of work completed
        artifacts: Comma-separated list of artifact paths in S3
        branch: Git branch name (for dev agents)
        commit_sha: Git commit SHA (for dev agents)
        pr_url: Pull request URL (for dev agents)
    """
    return _invoke_lambda(WORKFLOW_OUTPUT_LAMBDA, "WorkflowOutput___report_completion", {
        "ticket_id": ticket_id, "summary": summary, "artifacts": artifacts,
        "branch": branch, "commit_sha": commit_sha, "pr_url": pr_url
    })


@tool
def WorkflowOutput___save_design_doc(workflow_id: str, agent_id: str, content: str, doc_type: str = "design") -> str:
    """Save a design document or artifact for the workflow.

    Args:
        workflow_id: Workflow ID this belongs to
        agent_id: Your agent ID
        content: Document content (markdown)
        doc_type: Type of document (design, requirements, spec)
    """
    return _invoke_lambda(WORKFLOW_OUTPUT_LAMBDA, "WorkflowOutput___save_design_doc", {
        "workflow_id": workflow_id, "agent_id": agent_id, "content": content, "doc_type": doc_type
    })


@tool
def WorkflowOutput___submit_ticket_plan(workflow_id: str, epic_id: str, tickets: str) -> str:
    """Submit a plan of tickets to create for the workflow.

    Args:
        workflow_id: Workflow ID
        epic_id: Epic ticket ID to create children under
        tickets: JSON array of ticket objects [{title, description, assignee, blockedBy}]
    """
    return _invoke_lambda(WORKFLOW_OUTPUT_LAMBDA, "WorkflowOutput___submit_ticket_plan", {
        "workflow_id": workflow_id, "epic_id": epic_id, "tickets": tickets
    })


# ─── Skill Loader Tool ────────────────────────────────────────────────────────

@tool
def SkillLoader___load_skill(skill_name: str) -> str:
    """Load detailed skill instructions for a specific agent role.

    Args:
        skill_name: Name of the skill to load (e.g., 'security_reviewer', 'ios_designer')
    """
    return _invoke_lambda(SKILL_LOADER_LAMBDA, "SkillLoader___load_skill", {"skill_name": skill_name})


# ─── External Tool Integration (via MCP — GitHub, GitLab, Jira, etc.) ────────

def _create_mcp_clients():
    """Create MCPClient instances for each configured MCP server."""
    from strands.tools.mcp import MCPClient
    from mcp.client.streamable_http import streamablehttp_client

    servers = _parse_mcp_servers()
    clients = []

    for server in servers:
        url = server.get("url", "")
        headers = server.get("headers", {})
        if not url:
            continue
        # Capture url/headers in closure
        clients.append(MCPClient(
            (lambda u, h: lambda: streamablehttp_client(url=u, headers=h, timeout=60))(url, headers)
        ))
        logger.info(f"MCP server configured: {url}")

    return clients


# ─── All pipeline tools ───────────────────────────────────────────────────────

LAMBDA_TOOLS = [
    # S3 file download (for images → image_reader)
    download_s3_file,
    # S3 (Lambda-backed)
    S3Storage___read_object,
    S3Storage___write_object,
    S3Storage___list_objects,
    # Jira (Lambda-backed)
    JiraIntegration___create_ticket,
    JiraIntegration___transition_ticket,
    JiraIntegration___update_ticket,
    JiraIntegration___list_tickets,
    JiraIntegration___add_comment,
    JiraIntegration___search_issues,
    # Workflow (Lambda-backed)
    WorkflowOutput___report_completion,
    WorkflowOutput___save_design_doc,
    WorkflowOutput___submit_ticket_plan,
    # Skills (Lambda-backed)
    SkillLoader___load_skill,
    # GitHub tools come from MCPClient (remote MCP) — not Lambda-backed
]

logger.info(f"Loaded {len(LAMBDA_TOOLS)} Lambda-backed tools + GitHub MCP (built-in tools loaded at invocation time)")

# --- DynamoDB client for real-time event publishing ---
_ddb_events_client = boto3.client("dynamodb", region_name=REGION)
_EVENTS_TABLE = os.getenv("EVENTS_TABLE", "agentis-events")


def _publish_agent_started(workflow_id: str, agent_id: str):
    """Publish agent.started event so UI immediately shows this agent as running."""
    import time, random, string
    try:
        event_id = f"{int(time.time() * 1000)}-{''.join(random.choices(string.ascii_lowercase, k=4))}"
        _ddb_events_client.put_item(
            TableName=_EVENTS_TABLE,
            Item={
                "workflowId": {"S": workflow_id},
                "eventId": {"S": event_id},
                "type": {"S": "agent.started"},
                "detail": {"M": {
                    "agentId": {"S": agent_id},
                    "workflowId": {"S": workflow_id},
                    "timestamp": {"S": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
                }},
                "timestamp": {"S": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
                "ttl": {"N": str(int(time.time()) + 3600)},
            },
        )
        logger.info(f"[{agent_id}] Published agent.started event")
    except Exception as e:
        logger.warning(f"[{agent_id}] Failed to publish agent.started: {e}")


# --- App entrypoint (streaming enabled) ---
app = BedrockAgentCoreApp()


@app.entrypoint
async def agent_invocation(payload, context):
    """
    Handler for agent invocations — streaming responses.

    Expected payload:
    {
        "prompt": "The task instructions for this agent",
        "system_prompt": "Role-specific system prompt (from agent-prompts.ts)",
        "workflow_id": "wf_xxx",
        "agent_id": "team-security-reviewer",
        "model_override": "us.anthropic.claude-opus-4-6-v1" (optional)
    }
    """
    prompt = payload.get("prompt", "")
    system_prompt = payload.get("system_prompt", "You are a helpful AI agent on a development team.")
    workflow_id = payload.get("workflow_id", "unknown")
    agent_id = payload.get("agent_id", "unknown")
    model_override = payload.get("model_override")

    logger.info(f"[{agent_id}] Starting invocation for workflow {workflow_id}")
    logger.info(f"[{agent_id}] Model: {model_override or MODEL_ID}, read_timeout: {READ_TIMEOUT}s")

    # Publish "agent started" event so UI immediately shows this agent as running/pulsing
    _publish_agent_started(workflow_id, agent_id)

    # Use model override if provided (orchestrator can specify per-agent)
    active_model = model
    if model_override and model_override != MODEL_ID:
        override_config = BotocoreConfig(
            read_timeout=READ_TIMEOUT,
            connect_timeout=30,
            retries={"max_attempts": 2},
        )
        active_model = BedrockModel(
            model_id=model_override,
            region_name=REGION,
            boto_client_config=override_config,
            streaming=True,
        )

    # Load built-in tools (lazy — avoids 30s init timeout)
    builtin_tools = _load_builtin_tools()
    all_tools = builtin_tools + LAMBDA_TOOLS

    # External tools via MCP (GitHub, GitLab, Jira, Asana, etc.)
    # Strands Agent manages MCPClient lifecycle internally (start/stop)
    mcp_clients = _create_mcp_clients()
    if mcp_clients:
        all_tools.extend(mcp_clients)
        logger.info(f"[{agent_id}] {len(mcp_clients)} MCP server(s) attached")
    else:
        logger.warning(f"[{agent_id}] No MCP servers configured — external tools unavailable")

    # Collect tool_use events via callback handler AND publish them in real-time to the
    # events table so the UI can flash tool icons as they happen (not just at the end).
    tool_events = []

    class ToolTrackingHandler:
        """Callback handler that records tool invocations and publishes them to DynamoDB for real-time UI."""
        def __init__(self):
            self.previous_tool_use = None

        def __call__(self, **kwargs):
            current_tool_use = kwargs.get("current_tool_use", {})
            if current_tool_use and current_tool_use.get("name"):
                if self.previous_tool_use != current_tool_use:
                    self.previous_tool_use = current_tool_use
                    tool_name = current_tool_use["name"]
                    tool_events.append(tool_name)
                    logger.info(f"[{agent_id}] Tool call: {tool_name}")
                    # Publish real-time tool_use event to DynamoDB events table
                    try:
                        import time, random, string
                        event_id = f"{int(time.time() * 1000)}-{''.join(random.choices(string.ascii_lowercase, k=4))}"
                        _ddb_events_client.put_item(
                            TableName=_EVENTS_TABLE,
                            Item={
                                "workflowId": {"S": workflow_id},
                                "eventId": {"S": event_id},
                                "type": {"S": "agent.streaming"},
                                "detail": {"M": {
                                    "agentId": {"S": agent_id},
                                    "type": {"S": "trace"},
                                    "toolName": {"S": tool_name},
                                    "workflowId": {"S": workflow_id},
                                    "timestamp": {"S": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
                                }},
                                "timestamp": {"S": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
                                "ttl": {"N": str(int(time.time()) + 3600)},
                            },
                        )
                    except Exception as e:
                        logger.warning(f"[{agent_id}] Failed to publish tool event: {e}")

    # Create agent with role-specific system prompt and all tools
    agent = Agent(
        model=active_model,
        system_prompt=system_prompt,
        tools=all_tools,
        callback_handler=ToolTrackingHandler(),
    )

    # Use non-streaming call to avoid idle timeout on SSE connection during tool calls.
    # AgentCore's LB kills idle SSE connections after ~120s, which happens when the agent
    # is waiting for Lambda tool responses. The non-streaming path buffers internally.
    result = await agent.invoke_async(prompt)

    # Extract text from AgentResult.message (Message has "role" and "content" keys)
    final_text = ""
    if hasattr(result, "message") and result.message:
        msg = result.message
        content = msg.get("content", []) if isinstance(msg, dict) else getattr(msg, "content", [])
        for block in (content or []):
            if isinstance(block, dict) and "text" in block:
                final_text += block["text"]

    logger.info(f"[{agent_id}] Invocation complete for workflow {workflow_id}, output: {len(final_text)} chars, tools used: {len(tool_events)}")

    # Emit tool_use events FIRST so the agent-invoker can publish them for real-time UI flashing.
    # Format matches what agent-invoker.mjs parses: event.event.contentBlockStart.start.toolUse.name
    for tool_name in tool_events:
        yield {"event": {"contentBlockStart": {"start": {"toolUse": {"name": tool_name}}}}}

    # Then emit the final text as a single contentBlockDelta event
    yield {"event": {"contentBlockDelta": {"delta": {"text": final_text}}}}


if __name__ == "__main__":
    app.run()
