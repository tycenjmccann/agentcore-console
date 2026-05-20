"""
Agentis Pipeline Agent — Strands on AgentCore Runtime

Universal agent code deployed as 13 separate Runtime resources.
Each deployment gets its own SYSTEM_PROMPT env var baked in at deploy time,
making each agent a fully self-contained specialist.

The orchestrator is thin/dumb — it only passes the task prompt (ticket context).
Agent identity (system prompt, tools, model) is fixed at deploy time.

Key advantages over Harness:
  - We control botocore read_timeout (600s) so Opus can think without being killed
  - OTel auto-instrumentation is enabled via the CMD in deployment
  - Streaming responses via async generator entrypoint
  - All gateway tools (S3, Jira, GitHub, SkillLoader, WorkflowOutput) via Lambda invocation
"""

import os
os.environ["BYPASS_TOOL_CONSENT"] = "true"  # Required for non-interactive strands_tools (shell, editor, etc.)
os.environ["HOME"] = "/tmp"  # Runtime /var/task is read-only; tools need writable HOME
os.chdir("/tmp")  # python_repl, editor, shell all use cwd() for state — must be writable

import json
import logging
import boto3

from strands import Agent, tool
from strands.models import BedrockModel
from botocore.config import Config as BotocoreConfig
from bedrock_agentcore.runtime import BedrockAgentCoreApp

# Built-in Strands tools — lazy import to stay under 30s init limit
def _load_builtin_tools():
    """Import strands_tools at invocation time, not module load time.

    All built-in tools are loaded for every agent. AgentCore Runtime provides /tmp
    as writable space, and Code Interpreter / Browser run in separate sandboxes.
    """
    from strands_tools import (
        # Multi-modal
        image_reader,
        # Web & Network
        http_request,
        # Utilities
        current_time,
        calculator,
        # File Operations
        file_read,
        file_write,
        editor,
        # Shell & System
        shell,
        environment,
        # Code Interpretation
        python_repl,
        # RAG & Memory
        retrieve,
    )
    # AgentCore built-in services (Code Interpreter + Browser)
    from strands_tools.code_interpreter import AgentCoreCodeInterpreter
    from strands_tools.browser import AgentCoreBrowser

    code_interpreter_tool = AgentCoreCodeInterpreter(region=REGION)
    browser_tool = AgentCoreBrowser(region=REGION)

    return [
        # Multi-modal
        image_reader,
        # Web & Network
        http_request,
        # Utilities
        current_time,
        calculator,
        # File Operations
        file_read,
        file_write,
        editor,
        # Shell & System
        shell,
        environment,
        # Code Interpretation
        python_repl,
        # RAG & Memory
        retrieve,
        # AgentCore Services — sandboxed code execution & browser automation
        code_interpreter_tool.code_interpreter,
        browser_tool.browser,
    ]

# --- Configuration ---
REGION = os.getenv("AWS_REGION", "us-east-1")
MODEL_ID = os.getenv("MODEL_ID", "us.anthropic.claude-opus-4-6-v1")
READ_TIMEOUT = int(os.getenv("READ_TIMEOUT", "600"))  # 10 minutes — no more urllib3 kills
GATEWAY_ARN = os.getenv("GATEWAY_ARN", "arn:aws:bedrock-agentcore:us-east-1:023392223961:gateway/datesparkiamgw-vjme4fyj6k")
SYSTEM_PROMPT = os.getenv("SYSTEM_PROMPT", "You are a helpful AI agent on a development team.")

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
JIRA_TOOLS_LAMBDA = os.getenv("JIRA_TOOLS_LAMBDA", "datespark-jira-mcp")
BUILDER_TOOLS_LAMBDA = os.getenv("BUILDER_TOOLS_LAMBDA", "agentis-builder-tools")
WORKFLOW_OUTPUT_LAMBDA = os.getenv("WORKFLOW_OUTPUT_LAMBDA", "agentis-workflow-output")
SKILL_LOADER_LAMBDA = os.getenv("SKILL_LOADER_LAMBDA", "agentis-skill-loader")

# Default artifact bucket — agents should use this for all workflow artifacts
ARTIFACT_BUCKET = os.getenv("ARTIFACT_BUCKET", "agentcore-artifacts-023392223961-us-east-1")

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
def download_s3_file(key: str, bucket: str = "") -> str:
    """Download a file from S3 to local /tmp directory so it can be read by image_reader or other tools.
    Use this for images (PNG, JPG, etc.) that need visual analysis.

    Args:
        key: Object key/path in the bucket
        bucket: S3 bucket name (defaults to the team artifact bucket)

    Returns:
        Local file path where the file was saved (e.g., /tmp/filename.png)
    """
    import os
    actual_bucket = bucket or ARTIFACT_BUCKET
    filename = os.path.basename(key)
    local_path = f"/tmp/{filename}"
    s3_client.download_file(actual_bucket, key, local_path)
    size = os.path.getsize(local_path)
    return f"Downloaded to {local_path} ({size} bytes). Use image_reader tool with this path to view the image."


# ─── S3 Storage Tools ─────────────────────────────────────────────────────────

@tool
def S3Storage___read_object(key: str, bucket: str = "") -> str:
    """Read a TEXT object from S3. Returns the object content as text. For images/binary files, use download_s3_file instead.

    Args:
        key: Object key/path in the bucket
        bucket: S3 bucket name (defaults to the team artifact bucket)
    """
    return _invoke_lambda(S3_TOOLS_LAMBDA, "S3Storage___read_object", {"bucket": bucket or ARTIFACT_BUCKET, "key": key})


@tool
def S3Storage___write_object(key: str, content: str, bucket: str = "", content_type: str = "text/plain") -> str:
    """Write content to an S3 object.

    Args:
        key: Object key/path in the bucket
        content: Content to write
        bucket: S3 bucket name (defaults to the team artifact bucket)
        content_type: MIME type of the content
    """
    return _invoke_lambda(S3_TOOLS_LAMBDA, "S3Storage___write_object", {
        "bucket": bucket or ARTIFACT_BUCKET, "key": key, "content": content, "content_type": content_type
    })


@tool
def S3Storage___list_objects(prefix: str = "", bucket: str = "") -> str:
    """List objects in an S3 bucket under a prefix.

    Args:
        prefix: Key prefix to filter by
        bucket: S3 bucket name (defaults to the team artifact bucket)
    """
    return _invoke_lambda(S3_TOOLS_LAMBDA, "S3Storage___list_objects", {"bucket": bucket or ARTIFACT_BUCKET, "prefix": prefix})


# ─── Jira Integration Tools ──────────────────────────────────────────────────

@tool
def JiraIntegration___create_ticket(title: str, description: str, parent_id: str = "", assignee: str = "", ticket_type: str = "task", blocked_by: str = "", workflow_id: str = "") -> str:
    """Create a new ticket in the project tracker.

    MANDATORY TICKETS (create these for EVERY workflow, no exceptions):
      - team-qa-verifier: "QA: Verify [feature]" — blocked_by=ALL dev ticket IDs
      - team-ci-agent: "CI: Validate build and tests for [feature]" — blocked_by=QA ticket ID

    Example complete ticket set for a frontend feature:
      1. create_ticket(assignee="team-frontend-designer", blocked_by="")
      2. create_ticket(assignee="team-frontend-dev", blocked_by="TEAM-101")
      3. create_ticket(assignee="team-qa-verifier", blocked_by="TEAM-102")  ← ALWAYS
      4. create_ticket(assignee="team-ci-agent", blocked_by="TEAM-103")     ← ALWAYS

    Args:
        title: Ticket title/summary
        description: Detailed description with requirements and acceptance criteria
        parent_id: Parent epic ticket ID (required for child tickets)
        assignee: Agent ID to assign to (e.g., team-frontend-dev, team-backend-dev, team-qa-verifier, team-ci-agent)
        ticket_type: Type of ticket (epic, story, task)
        blocked_by: Comma-separated list of ticket IDs this ticket is blocked by (e.g., "TEAM-401,TEAM-402")
        workflow_id: Workflow ID this ticket belongs to
    """
    blockers = [b.strip() for b in blocked_by.split(",") if b.strip()] if blocked_by else []
    return _invoke_lambda(JIRA_TOOLS_LAMBDA, "JiraIntegration___create_ticket", {
        "summary": title, "description": description, "parent_key": parent_id,
        "assignee": assignee, "issue_type": ticket_type, "blocked_by": blockers,
        "workflow_id": workflow_id
    })


@tool
def JiraIntegration___transition_ticket(ticket_id: str, transition_id: str, reason: str = "") -> str:
    """Transition a ticket to a new status (e.g., done, skip, blocked).

    Args:
        ticket_id: The ticket ID to transition
        transition_id: Target status (done, skip, blocked, in_progress, todo)
        reason: Reason for the transition
    """
    return _invoke_lambda(JIRA_TOOLS_LAMBDA, "JiraIntegration___transition_ticket", {
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
    return _invoke_lambda(JIRA_TOOLS_LAMBDA, "JiraIntegration___update_ticket", args)


@tool
def JiraIntegration___list_tickets(parent_id: str) -> str:
    """List all child tickets under a parent (epic or story).

    Args:
        parent_id: Parent ticket ID to list children of
    """
    return _invoke_lambda(JIRA_TOOLS_LAMBDA, "JiraIntegration___list_tickets", {"parent_id": parent_id})


@tool
def JiraIntegration___add_comment(ticket_id: str, comment: str) -> str:
    """Add a comment to a ticket.

    Args:
        ticket_id: The ticket ID to comment on
        comment: Comment text to add
    """
    return _invoke_lambda(JIRA_TOOLS_LAMBDA, "JiraIntegration___add_comment", {
        "ticket_id": ticket_id, "comment": comment
    })


@tool
def JiraIntegration___search_issues(query: str, max_results: int = 20) -> str:
    """Search for tickets matching a query.

    Args:
        query: Search query string
        max_results: Maximum number of results to return
    """
    return _invoke_lambda(JIRA_TOOLS_LAMBDA, "JiraIntegration___search_issues", {
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


# ─── Claude Code SDK Tool ────────────────────────────────────────────────────
# Agents that write code delegate to Claude Code for higher-quality implementation.
# Claude Code reads CLAUDE.md in the repo, follows project conventions, and handles
# complex multi-file edits better than raw shell/editor tool usage.

# All agents get claude_code — even non-dev agents benefit from it for
# reading repos, analyzing code structure, generating docs from source, etc.

@tool
def claude_code(task: str, working_directory: str = "/tmp") -> str:
    """Delegate a coding task to Claude Code — a specialized AI coding agent.

    Claude Code excels at:
    - Cloning repos and understanding existing codebases (reads CLAUDE.md automatically)
    - Multi-file code implementation with proper imports and types
    - Running tests and iteratively fixing failures
    - Git operations (branch, commit, push)
    - Following project conventions from CLAUDE.md

    WHEN TO USE: Any time you need to write/edit code, run tests, or interact with a git repo.
    Let Claude Code handle the HOW while you handle the WHAT and WHY.

    Args:
        task: Complete description of what to implement. Include:
              - Repo URL and branch name
              - What to build (specific files, endpoints, features)
              - Acceptance criteria (what success looks like)
              - Any constraints (don't modify X, use library Y)
        working_directory: Directory to operate in (default: /tmp)
    """
    import subprocess
    import shutil

    logger.info(f"[claude_code] Delegating task: {task[:150]}...")

    # Ensure claude CLI is available (install if needed — first invocation only)
    claude_bin = shutil.which("claude")
    if not claude_bin:
        logger.info("[claude_code] Installing Claude Code CLI...")
        try:
            subprocess.run(
                ["npm", "install", "-g", "@anthropic-ai/claude-code"],
                capture_output=True, text=True, timeout=120,
                env={**os.environ, "HOME": "/tmp"},
            )
            claude_bin = shutil.which("claude") or "/tmp/.npm-global/bin/claude"
        except Exception as e:
            return f"ERROR: Failed to install Claude Code CLI: {e}. Use shell/editor tools directly instead."

    try:
        result = subprocess.run(
            [
                claude_bin,
                "--print",
                "--output-format", "text",
                "--max-turns", "50",
                task,
            ],
            cwd=working_directory,
            capture_output=True,
            text=True,
            timeout=540,  # 9 min (leave 1 min buffer for agent to process result)
            env={
                **os.environ,
                "CLAUDE_CODE_ENTRYPOINT": "agentis-pipeline",
                "HOME": "/tmp",
            },
        )

        output = result.stdout.strip()
        if result.returncode != 0 and result.stderr:
            output += f"\n\nSTDERR: {result.stderr[-500:]}"

        logger.info(f"[claude_code] Complete. {len(output)} chars, exit code: {result.returncode}")
        return output if output else f"Claude Code exited with code {result.returncode}. Stderr: {result.stderr[-300:]}"

    except subprocess.TimeoutExpired:
        return "ERROR: Claude Code timed out after 540 seconds. The task may be too complex for a single delegation — break it into smaller steps."
    except FileNotFoundError:
        return "ERROR: 'claude' CLI not found in this environment. Falling back — use shell, editor, and file_write tools directly."
    except Exception as e:
        return f"ERROR invoking Claude Code: {str(e)}"


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
        "prompt": "The task context (ticket description, workflow metadata)",
        "workflow_id": "wf_xxx",
        "agent_id": "team-security-reviewer",
        "model_override": "us.anthropic.claude-opus-4-6-v1" (optional)
    }

    The system prompt is NOT in the payload — it's baked into the agent at deploy time
    via the SYSTEM_PROMPT env var. The orchestrator is dumb and only passes task context.
    """
    prompt = payload.get("prompt", "")
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
    all_tools = builtin_tools + LAMBDA_TOOLS + [claude_code]

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
                            },
                        )
                    except Exception as e:
                        logger.warning(f"[{agent_id}] Failed to publish tool event: {e}")

    # Create agent with system prompt baked in at deploy time (SYSTEM_PROMPT env var)
    agent = Agent(
        model=active_model,
        system_prompt=SYSTEM_PROMPT,
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
