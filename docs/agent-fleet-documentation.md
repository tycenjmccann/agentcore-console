# Agentis Pipeline — Agent Fleet Documentation

## Fleet Overview

14 specialized agents deployed on AWS Bedrock AgentCore Runtime. Each agent is a Strands-based Python process with a baked-in system prompt, shared toolset, and model configuration.

| Agent | Role | Phase | Skills Loaded |
|-------|------|-------|---------------|
| `agentis_requirements_analyst` | Analyzes inputs, creates tickets for relevant agents | Requirements | requirements-analysis |
| `agentis_frontend_designer` | Designs UI/UX for web features | Design | frontend-design, ios-architecture |
| `agentis_backend_designer` | Designs backend systems & APIs | Design | backend-systems |
| `agentis_ios_designer` | Designs native iOS features | Design | ios-architecture |
| `agentis_android_designer` | Designs Android features | Design | general-design |
| `agentis_analytics_designer` | Designs analytics/tracking | Design | general-design |
| `agentis_frontend_dev` | Implements web UI features | Development | full-stack, code-simplifier, feature-dev |
| `agentis_backend_dev` | Implements backend services | Development | node-typescript, feature-dev |
| `agentis_api_dev` | Implements API endpoints | Development | node-typescript, feature-dev |
| `agentis_qa_verifier` | Runs builds, tests, static analysis | Verification | qa-verification |
| `agentis_ci_agent` | CI pipeline validation | Verification | ci-verification |
| `agentis_security_reviewer` | Security audit of code changes | Review | code-review |
| `agentis_legal_compliance` | Privacy/compliance review | Review | privacy-compliance |
| `agentis_localization` | i18n implementation | Development | localization, i18n-tooling |

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  AgentCore Runtime (us-east-1)                              │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ agentis_frontend │  │ agentis_backend │  ... x14         │
│  │     _dev         │  │     _dev        │                  │
│  │                  │  │                 │                  │
│  │ main.py (shared) │  │ main.py (shared)│                  │
│  │ SYSTEM_PROMPT=.. │  │ SYSTEM_PROMPT=..│                  │
│  └────────┬─────────┘  └────────┬────────┘                  │
│           │                      │                          │
│  ┌────────┴──────────────────────┴────────┐                 │
│  │  Shared Tools (loaded at invocation)    │                 │
│  │                                         │                 │
│  │  Built-in:  shell, editor, file_read,   │                 │
│  │    file_write, python_repl, calculator, │                 │
│  │    http_request, image_reader,          │                 │
│  │    current_time, environment, retrieve  │                 │
│  │                                         │                 │
│  │  AgentCore: Code Interpreter, Browser   │                 │
│  │                                         │                 │
│  │  Claude Code: claude_code tool (SDK)    │                 │
│  │                                         │                 │
│  │  Lambda-backed: S3, Jira, Workflow,     │                 │
│  │    SkillLoader                          │                 │
│  │                                         │                 │
│  │  MCP: GitHub (push, PR, file ops)       │                 │
│  └─────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Tool Inventory (per agent)

### Built-in Strands Tools (13)
| Tool | Purpose |
|------|---------|
| `shell` | Run shell commands (git, npm, etc.) |
| `file_read` | Read files from disk |
| `file_write` | Write files to disk |
| `editor` | Edit files with find/replace |
| `python_repl` | Execute Python code |
| `calculator` | Math operations |
| `http_request` | HTTP GET/POST/etc. |
| `image_reader` | Analyze images (multimodal) |
| `current_time` | Get current time |
| `environment` | Read/set env vars |
| `retrieve` | RAG retrieval |
| `code_interpreter` | AgentCore sandboxed code execution |
| `browser` | AgentCore managed Playwright browser |

### Claude Code SDK Tool (1)
| Tool | Purpose |
|------|---------|
| `claude_code` | Delegate complex coding tasks to Claude Code CLI |

### Lambda-Backed Tools (14)
| Tool | Lambda | Purpose |
|------|--------|---------|
| `download_s3_file` | direct boto3 | Download S3 files to /tmp |
| `S3Storage___read_object` | agentis-s3-tools | Read text from S3 |
| `S3Storage___write_object` | agentis-s3-tools | Write text to S3 |
| `S3Storage___list_objects` | agentis-s3-tools | List S3 objects |
| `JiraIntegration___create_ticket` | datespark-jira-mcp | Create tickets |
| `JiraIntegration___transition_ticket` | datespark-jira-mcp | Change ticket status |
| `JiraIntegration___update_ticket` | datespark-jira-mcp | Update ticket fields |
| `JiraIntegration___list_tickets` | datespark-jira-mcp | List child tickets |
| `JiraIntegration___add_comment` | datespark-jira-mcp | Comment on tickets |
| `JiraIntegration___search_issues` | datespark-jira-mcp | Search tickets |
| `WorkflowOutput___report_completion` | agentis-workflow-output | Mark work done |
| `WorkflowOutput___save_design_doc` | agentis-workflow-output | Save artifacts |
| `WorkflowOutput___submit_ticket_plan` | agentis-workflow-output | Batch create tickets |
| `SkillLoader___load_skill` | agentis-skill-loader | Load role instructions |

### MCP Tools (GitHub)
Connected via `GITHUB_PAT` env var to `https://api.githubcopilot.com/mcp/`:
- `push_files` — Push commits to GitHub
- `create_pull_request` — Create PRs
- `get_file_contents` — Read files from repos
- `search_repositories` — Search repos
- `create_or_update_file` — Commit file changes
- `list_branches` — List repo branches
- Plus ~20 more GitHub operations

---

## Claude Code Integration

### How It Works

The `claude_code` tool runs `claude --print` as a subprocess. When Claude Code operates in a cloned repo, it automatically:
1. Reads `CLAUDE.md` for project conventions
2. Loads plugins from `.claude/plugins/`
3. Has access to its own tools (Read, Write, Edit, Bash, Grep, Glob)
4. Can run slash commands like `/feature-dev`, `/code-review`

### Installed Plugins (in repo `.claude/plugins/`)

| Plugin | Type | What It Does |
|--------|------|-------------|
| `feature-dev` | Command + Agents | 7-phase structured feature development |
| `code-review` | Command | Multi-agent PR review with confidence scoring |
| `pr-review-toolkit` | Agents | 6 specialized review agents |
| `security-guidance` | Hook | Pre-tool-use security pattern detection |

### How Agents Should Use Claude Code

**Dev agents** (frontend, backend, API):
```
claude_code(task="Clone https://github.com/org/repo, checkout -b feature/TEAM-123-sidebar.
Implement the collapsible sidebar per the design doc at workflows/wf_xxx/shared/design.md in S3.
Use /feature-dev workflow. Commit and push when done.")
```

**QA agent**:
```
claude_code(task="Clone https://github.com/org/repo, checkout branch feature/TEAM-123-sidebar.
Run /code-review on the diff vs main. Then run npm test and npm run build.
Report all findings.")
```

**Security reviewer**:
```
claude_code(task="Clone https://github.com/org/repo, checkout branch feature/TEAM-123-sidebar.
Run the pr-review-toolkit security analysis. Check for OWASP Top 10 issues.
Report findings with file:line references.")
```

### Plugin Loading — No Redeploy Needed

Plugins live in the **repo**, not the agent. When you add/update plugins in `.claude/plugins/`:
- Next time any agent calls `claude_code` and clones the repo, it gets the updated plugins
- No agent redeploy required
- All agents benefit immediately

---

## Configuration

### Environment Variables (baked at deploy time)

| Variable | Value | Purpose |
|----------|-------|---------|
| `MODEL_ID` | `us.anthropic.claude-opus-4-6-v1` | LLM model |
| `AWS_REGION` | `us-east-1` | AWS region |
| `READ_TIMEOUT` | `600` | Boto3 read timeout (10 min) |
| `GATEWAY_ARN` | `arn:aws:bedrock-agentcore:...` | AgentCore gateway |
| `EVENTS_TABLE` | `agentis-events` | DynamoDB events table |
| `JIRA_TOOLS_LAMBDA` | `datespark-jira-mcp` | Jira tools Lambda |
| `ARTIFACT_BUCKET` | `agentcore-artifacts-...` | S3 artifact bucket |
| `SYSTEM_PROMPT` | (agent-specific) | Baked system prompt |
| `BYPASS_TOOL_CONSENT` | `true` | Non-interactive tools |
| `GITHUB_PAT` | (from .env.local) | GitHub MCP access |

### Deploy Process

```bash
cd deploy/runtime-agent
./deploy-one.sh <agent_name>    # Deploy single agent
# or deploy all:
for agent in $(ls prompts/ | sed 's/.txt$//'); do ./deploy-one.sh "$agent"; done
```

### Fleet Registry

`deploy/runtime-agent/fleet-runtime-ids.json` — Maps agent names to ARNs.

---

## Skills System

Skills are loaded at invocation time via `SkillLoader___load_skill(skill_name="...")`. They return markdown instructions that guide agent behavior for specific tasks.

### Available Skills

| Skill | Used By | Purpose |
|-------|---------|---------|
| `ios-architecture` | iOS designer | Native iOS architecture design |
| `backend-systems` | Backend designer | Backend/API systems design |
| `privacy-compliance` | Legal compliance | GDPR/CCPA compliance design |
| `localization` | Localization agent | i18n design patterns |
| `frontend-design` | Frontend designer | Bold, distinctive UI design |
| `general-design` | Any designer | Generic software design |
| `requirements-analysis` | Requirements analyst | Ticket creation methodology |
| `qa-verification` | QA verifier | Build/test/verify process |
| `ci-verification` | CI agent | CI pipeline process |
| `swift-development` | iOS dev | Swift/SwiftUI implementation |
| `node-typescript` | Backend/API dev | Node.js/TS implementation |
| `full-stack` | Frontend dev | Full-stack development |
| `data-services` | Backend dev | Data processing services |
| `i18n-tooling` | Localization | i18n tooling implementation |
| `code-architect` | Dev agents | Architecture blueprints |
| `type-design` | Dev agents | Type system analysis |
| `code-review` | Security reviewer | Code review methodology |
| `silent-failure-hunter` | QA/Security | Error handling audit |
| `code-simplifier` | Dev agents | Code simplification |
| `test-coverage` | QA/CI | Test coverage analysis |
| `feature-dev` | Dev agents | 7-phase feature development |

---

## Workflow Execution

### Ticket-Driven Pipeline

```
User Input → Requirements Agent → Creates Tickets → DynamoDB Stream
                                                         │
    ┌────────────────────────────────────────────────────┘
    │
    ▼ (for each ticket with status="ready")
Orchestrator Lambda → Invokes Agent via Runtime ARN
    │
    ▼
Agent executes → Uses tools → Writes artifacts → Marks ticket "done"
    │
    ▼ (DynamoDB Stream fires on status change)
Orchestrator checks → Unblocks downstream tickets → Invokes next agents
    │
    ▼ (all tickets done)
Workflow Complete
```

### Dependency Chain

```
Design agents (no blockers) → Dev agents (blocked by design) → QA (blocked by ALL dev) → CI (blocked by QA)
```

---

## Starting Test Workflows

Use `scripts/start-test-workflow.sh` to start workflows for testing. This is the **only** correct way to create workflows outside the UI — it calls `/api/workflow/start` which initializes all required fields and creates ticket skeletons.

```bash
./scripts/start-test-workflow.sh --scope minimal     # Quick smoke test
./scripts/start-test-workflow.sh --scope full         # Full pipeline exercise
```

See `docs/workflow-pipeline-architecture.md` § "Starting Test Workflows" for full usage.

---

## A/B Testing

Local test script at `deploy/runtime-agent/local-ab-test.py`:
- Variant A: Agent codes directly (shell, editor, file_write)
- Variant B: Agent delegates to Claude Code SDK
- Same model (Opus 4.6), same prompt — only difference is the `claude_code` tool
- Both clone repo, branch, code, commit, push, create PRs
- Compare: time, tool calls, code quality, test quality

```bash
python3 deploy/runtime-agent/local-ab-test.py --parallel
```

---

## Monitoring & Debugging

### Real-Time Events
All agent activity writes to `agentis-events` DynamoDB table:
- `agent.started` — Agent invoked
- `agent.streaming` (type=trace) — Tool use events
- `agent.complete` — Agent finished
- `workflow.nudge` — Stuck tickets auto-fixed

### Nudge System
`POST /api/workflow/[id]/nudge` — Fixes stuck tickets:
- `todo` with no blockers → `ready` (missed stream event)
- `blocked` with all blockers done → `ready` (missed unblock cascade)

Note: `in_progress` tickets are never reset by nudge — an agent session is actively running. See DL-021 for why this was removed (caused duplicate agent sessions).

### UI Replay
`GET /api/workflow/[id]/events` — Returns all events for timeline replay with scrubber.
