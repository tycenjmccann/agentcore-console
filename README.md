# Agentis Hub

A web console for Amazon Bedrock AgentCore that dynamically discovers and interacts with your deployed agents. Clone, configure your AWS credentials, and it works — no hardcoded ARNs, memory IDs, or account numbers.

## Features

- **Dashboard** — Real metrics from CloudWatch and OTEL traces: invocations, per-agent token usage, latency, sessions
- **Agents** — Card grid of harnesses and runtimes; click for detail + invoke
- **Agent Detail** — Model, tools, memory, logs + live chat with sessions and full OTEL execution trace
- **Builder** — Chat-based agent creation (harness with code_interpreter + MCP)
- **Workflow** — Autonomous development pipeline: submit a feature request, 14 agents produce a PR. Real-time pipeline visualization with animated phases, timeline replay/scrubber, S3 artifact browsing, and dynamic header titles

## Prerequisites

- Node.js 18+
- AWS credentials configured (via `~/.aws/credentials`, env vars, or IAM role)
- At least one agent deployed to Bedrock AgentCore in your account

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

### Environment Variables

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_REGION` | No | Defaults to `us-east-1` |
| `HARNESS_EXECUTION_ROLE_ARN` | **Yes (for Deploy)** | IAM role ARN assigned to newly created harness agents. Must have Bedrock model invoke permissions. |
| `BUILDER_AGENT_ID` | No | Harness ID of a deployed builder agent. Enables tool-powered builder chat. |
| `GITHUB_PAT` | No | GitHub Personal Access Token. Pipeline agents use this to connect to GitHub's hosted MCP server. |
| `MCP_SERVERS` | No | JSON array of MCP server configs: `[{"url":"...","headers":{...}}]`. For custom tooling beyond GitHub. |

The app uses the standard AWS credential chain — no secrets in env files.

## How It Works

1. **Discovery** — On load, the Control Plane SDK (`ListHarnesses`, `ListAgentRuntimes`, `ListMemories`) discovers all agents in your account
2. **Invocation** — Chat uses `InvokeHarness` (for harnesses) or `InvokeAgentRuntime` (for runtimes) via the Data Plane SDK
3. **Memory** — Conversation history stored/retrieved via AgentCore Memory (`CreateEvent`, `ListEvents`)
4. **Metrics** — Per-agent token usage from `aws/spans` OTEL trace data; invocations and latency from `AWS/Bedrock-AgentCore` CloudWatch metrics
5. **Traces** — Full OTEL execution traces (model calls, tool executions, event loops) from the `aws/spans` CloudWatch Logs group

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- AWS SDKs: `@aws-sdk/client-bedrock-agentcore`, `@aws-sdk/client-bedrock-agentcore-control`, `@aws-sdk/client-bedrock-runtime`, `@aws-sdk/client-cloudwatch`, `@aws-sdk/client-cloudwatch-logs`

---

## Multi-Format Agent Invocation

Different agents expect different payload structures. The console auto-handles this with configurable payload formats per agent.

### Supported Request Formats

| Format | Payload Sent | Use Case |
|--------|---|---|
| `prompt` (default) | `{"prompt": "..."}` | Most custom agents |
| `messages` | `{"messages": [{"role":"user","content":[{"text":"..."}]}]}` | Converse-style agents |
| `input_text` | `{"input": {"text": "..."}}` | Simple input agents |
| `query` | `{"query": "..."}` | RAG agents |
| `custom` | Raw user input as JSON | Agents expecting custom JSON structs |

### Supported Response Formats (auto-detected)

The console parses agent responses in any of these shapes:
- SSE streams (`data: ...` lines)
- `{ result: { content: [{ text: "..." }] } }` — MCP/A2A style
- `{ output: { message: { content: [{ text: "..." }] } } }` — Converse output
- `{ output: { text: "..." } }` — Simple output
- `{ completion: "..." }` — Completion style
- `{ response: "..." }` — Generic response
- `{ answer: "..." }` — Q&A style
- Raw text fallback

### Configuring Per-Agent Format

```bash
# Set format for a specific agent
curl -X POST http://localhost:3000/api/agentcore/payload-format \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "my-agent-id", "format": "messages"}'

# Check current format
curl http://localhost:3000/api/agentcore/payload-format?agent_id=my-agent-id
```

Format is persisted in `.payload-formats.json` and used automatically on all subsequent invocations. Can also be passed per-request via the `payloadFormat` field in the invoke body.

### Adding a New Invoke Pattern

If your agent uses a payload structure not listed above, add it in two places:

**1. Request format** — `src/lib/agentcore-sdk.ts`, in the `PAYLOAD_BUILDERS` object:

```typescript
// In src/lib/agentcore-sdk.ts, find the PAYLOAD_BUILDERS constant:
const PAYLOAD_BUILDERS: Record<string, (prompt: string, sessionId: string) => object> = {
  prompt: (prompt) => ({ prompt }),
  messages: (prompt) => ({ messages: [{ role: "user", content: [{ text: prompt }] }] }),
  input_text: (prompt) => ({ input: { text: prompt } }),
  query: (prompt) => ({ query: prompt }),
  // ADD YOUR FORMAT HERE:
  my_format: (prompt) => ({ my_field: { nested: prompt }, session: sessionId }),
};
```

**2. Response format** — same file, in the response parsing block (search for `// Handle various response structures`):

```typescript
// Add a new else-if for your agent's response shape:
} else if (parsed.my_response_field?.text) {
  text = parsed.my_response_field.text;
}
```

**3. Register the format name** — `src/app/api/agentcore/payload-format/route.ts`, add your format name to the `valid` array:

```typescript
const valid = ["prompt", "messages", "input_text", "query", "custom", "my_format"];
```

**4. Configure your agent to use it:**

```bash
curl -X POST http://localhost:3000/api/agentcore/payload-format \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "your-agent-id", "format": "my_format"}'
```

That's it — the console will now use your custom format for that agent on every invocation.

---

## Builder Agent (Agent that Creates Agents)

The Build tab is powered by a real AgentCore harness agent that can create other agents. It uses:
- **code_interpreter** — runs Python/boto3 to call AgentCore APIs (CreateHarness, ListAgentRuntimes, etc.)
- **Remote MCP** (optional) — connects to your MCP servers so the builder can discover available tools and wire them into agents it creates

### Deploying the Builder Agent

```bash
# Minimal — builder with code_interpreter only
node deploy/setup-builder-agent.mjs \
  --harness-role-arn arn:aws:iam::ACCOUNT:role/YourHarnessRole

# With MCP servers for tool discovery
node deploy/setup-builder-agent.mjs \
  --harness-role-arn arn:aws:iam::ACCOUNT:role/YourHarnessRole \
  --mcp-url https://api.githubcopilot.com/mcp/ \
  --mcp-url https://my-tools.example.com/mcp

# With memory for persistent context
node deploy/setup-builder-agent.mjs \
  --harness-role-arn arn:aws:iam::ACCOUNT:role/YourHarnessRole \
  --mcp-url https://my-tools.example.com/mcp \
  --memory-id my-builder-memory
```

**What this creates:**
1. **Builder Agent harness** (`agentis_builder`) with code_interpreter + any MCP servers you specify

**Output:**
```bash
BUILDER_AGENT_ID=agentis_builder-xxxxxxxxxx
```

Add to `.env.local` — the Build page will use the real harness agent instead of direct Converse.

### Prerequisites

1. **IAM execution role** for the harness — needs Bedrock model access + AgentCore control plane permissions (CreateHarness, ListHarnesses, ListAgentRuntimes, etc.)
2. **(Optional) MCP server URL(s)** — any MCP server the builder should discover tools from. The builder can then wire these into child agents it creates.
3. **(Optional) AgentCore Memory ID** — for persistent context across sessions

### How It Works

```
User (Build page) → InvokeHarness(agentis_builder)
                         ↓
              Builder Agent (Claude Sonnet 4.5)
                    ↓ tool calls ↓
    ┌────────────────────────────────────────┐
    │ code_interpreter (boto3)               │
    │  • CreateHarness → deploy new agents  │
    │  • ListHarnesses → see existing       │
    │  • ListGateways → find tools          │
    │  • ListMemories → find memories       │
    ├────────────────────────────────────────┤
    │ Remote MCP Server(s) (optional)        │
    │  • Tools auto-discovered via MCP      │
    │  • Any provider: GitHub, GitLab, Jira │
    │  • Builder wires these into children  │
    └────────────────────────────────────────┘
                    ↓
              Streams response back
```

Without `BUILDER_AGENT_ID`, the Build page falls back to a direct Converse API call (no tools, no memory — just config generation).

---

## Development Pipeline (14 Agents)

The Workflow tab runs an autonomous software development pipeline. Submit a feature request and 14 specialized agents (requirements, design, development, QA, review) produce a pull request.

### Architecture

- **Agents:** 14 Strands agents deployed on AgentCore Runtime (configurable 600s timeout)
- **Orchestration:** DynamoDB Streams cascade — ticket status changes trigger the next phase
- **Tools:** Agents connect to external tools via MCP (GitHub, GitLab, Jira, etc.) — configurable per deployment
- **Model:** Claude Opus 4.6 (default, configurable via `MODEL_ID` env var)

### Jira Integration (Real Jira Cloud)

The platform supports two ticket backends, switchable via a single env var:

| Mode | `TICKET_PROVIDER` | Backend | Trigger |
|------|-------------------|---------|---------|
| Mock | `dynamodb` (default) | DynamoDB tables | DynamoDB Streams → orchestrator Lambda |
| Real | `jira` | Jira Cloud REST API | Jira webhook → `/api/jira/webhook` |

**To switch to real Jira:**

```bash
# .env.local (or App Runner / container env vars)
TICKET_PROVIDER=jira
JIRA_SITE_URL=your-site.atlassian.net
JIRA_EMAIL=you@company.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=TEAM
```

**Jira project requirements:**
- Workflow statuses configured: `To Do`, `Ready`, `In Progress`, `In Review`, `Blocked`, `Done`
- Issue link type: `Blocks` (standard, exists by default)
- Agent assignments stored as labels: `agent:team-frontend-dev`
- Workflow IDs stored as labels: `wf:wf_123456`

**Webhook setup** (required for cascade orchestration):
1. In Jira → Settings → Webhooks → Create webhook
2. URL: `https://your-deployed-app.com/api/jira/webhook`
3. Events: `issue_updated`
4. Filter: project = YOUR_PROJECT_KEY

**Agent Jira Lambda** (separate infra, agents call Jira through this):
- Function: `agentis-jira-real` — SAM-deployed Lambda
- Only invocable by `bedrock-agentcore.amazonaws.com`
- Deploy: see `lambda/jira-real/` for the function code; deploy with SAM CLI

### Deploying the Agent Fleet

```bash
# Deploy all 14 agents (requires agentcore CLI configured)
cd deploy/runtime-agent
./deploy-fleet.sh

# With GitHub MCP tools attached
GITHUB_PAT=ghp_xxx ./deploy-fleet.sh

# With any MCP servers (JSON array)
MCP_SERVERS='[{"url":"https://api.githubcopilot.com/mcp/","headers":{"Authorization":"Bearer ghp_xxx"}}]' \
  ./deploy-fleet.sh
```

### MCP Flexibility

Each customer plugs in their own tooling via the `MCP_SERVERS` environment variable — a JSON array of `{url, headers}` objects. Examples:
- **GitHub:** `https://api.githubcopilot.com/mcp/` + Bearer token
- **GitLab:** Your GitLab MCP server URL
- **Jira/Linear/Asana:** Any project management MCP server
- **Custom tools:** Any MCP-compatible server

`GITHUB_PAT` is supported as a shorthand for the common GitHub case.

### Pipeline Phases

| Phase | Agents | Function |
|-------|--------|----------|
| Requirements | 1 (Requirements Analyst) | Analyze PRD, create tickets, skip irrelevant agents |
| Design | 8 (Frontend, iOS, Android, Backend, Security, Legal, Localization, Analytics) | Parallel design docs |
| Development | 3 (Backend Dev, API Dev, Frontend Dev) | Parallel code generation + PR |
| QA | 2 (QA Verifier, CI Agent) | Test verification + code review |

### Known Limitation: Harness Agents

An alternative deployment path (`deploy/setup-team-agents.mjs`) deploys agents as AgentCore Harnesses instead of Runtimes. Harness agents currently have an internal ~120s boto3 read timeout that cannot be configured, causing failures with complex agents. This is an open item with the AgentCore team. Use Runtime agents (the default) until resolved.

---

## Routing Demo (Agent Skills)

The Routing tab demonstrates end-to-end agent orchestration with **dynamic skill loading**:

```
Jira Ticket → Design Agent (loads skill) → Jira Update → Dev Agent (loads skill) → PR & Close
```

Each agent calls `load_skill` at runtime to get detailed instructions before producing output. This is visible in the OTEL trace as a tool invocation.

### One-Command Setup

```bash
node deploy/setup-routing-agents.mjs \
  --gateway-id <your-gateway-id> \
  --harness-role-arn arn:aws:iam::ACCOUNT:role/YourHarnessRole
```

This creates:
1. **Skill-loader Lambda** — serves skill instructions (ios-architecture, backend-systems, etc.)
2. **Gateway target** — exposes `load_skill` as a tool on your AgentCore gateway
3. **Design Agent harness** — calls `load_skill` → produces architecture docs
4. **Dev Agent harness** — calls `load_skill` → produces implementation code

The script outputs agent IDs to add to `.env.local`:
```bash
DESIGN_AGENT_ID=routing_designer_v2-xxxxxxxxxx
DEV_AGENT_ID=routing_developer_v2-xxxxxxxxxx
```

### Prerequisites for Routing

- An existing AgentCore gateway (created via console or `agentcore` CLI)
- An IAM execution role for harnesses with Bedrock model access
- The gateway must allow Lambda targets

### Available Skills

| Skill | Agent | Purpose |
|-------|-------|---------|
| `ios-architecture` | Design | iOS feature architecture |
| `backend-systems` | Design | APIs, services, infra |
| `privacy-compliance` | Design | GDPR, data export |
| `localization` | Design | i18n, multi-language |
| `general-design` | Design | Catch-all design |
| `swift-development` | Dev | iOS/Swift implementation |
| `node-typescript` | Dev | Backend Node.js/Lambda |
| `data-services` | Dev | Data pipelines, export |
| `i18n-tooling` | Dev | Localization infra |
| `full-stack` | Dev | Cross-stack features |

---

## Production Deployment

This app is designed to be deployed into a customer's AWS environment. The AWS SDK credential chain means **zero code changes** are needed — just deploy where an IAM role is available.

### Deployment Options

#### Option A: AWS Amplify Hosting (Easiest)

1. Connect your repo to Amplify Hosting
2. Amplify provides an IAM service role — attach the required policy (below)
3. Add Cognito for user authentication
4. Done — Amplify handles build, deploy, CDN, and custom domains

#### Option B: ECS/Fargate or Lambda Web Adapter

1. Containerize the Next.js app (`Dockerfile` with `npm run build && npm start`)
2. Deploy to ECS Fargate or Lambda via Lambda Web Adapter
3. Attach an **IAM Task Role** (ECS) or **Lambda Execution Role** with the required policy
4. Front with ALB or CloudFront + API Gateway
5. Add auth via Cognito, IAM Identity Center, or existing IdP

#### Option C: Integrate Into Existing Site

If you already have a hosted Next.js or React app:

1. Merge the `src/app/api/agentcore/` routes and `src/lib/agentcore-sdk.ts` into your existing app
2. Add the dashboard page (`src/app/page.tsx`) and agent detail page (`src/app/agents/[id]/page.tsx`)
3. Install the required AWS SDK packages (see `package.json`)
4. Add the IAM permissions below to your existing compute role
5. No additional credential configuration needed — uses whatever role your app already runs as

### Required IAM Policy

Attach this policy to whichever IAM role your compute uses (Amplify service role, ECS task role, Lambda execution role, etc.):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AgentCoreFullAccess",
      "Effect": "Allow",
      "Action": [
        "bedrock-agentcore:InvokeAgentRuntime",
        "bedrock-agentcore:InvokeHarness",
        "bedrock-agentcore:ListAgentRuntimes",
        "bedrock-agentcore:ListHarnesses",
        "bedrock-agentcore:ListMemories",
        "bedrock-agentcore:GetAgentRuntime",
        "bedrock-agentcore:GetHarness",
        "bedrock-agentcore:CreateHarness",
        "bedrock-agentcore:ListSessions",
        "bedrock-agentcore:ListActors",
        "bedrock-agentcore:ListEvents",
        "bedrock-agentcore:CreateEvent",
        "bedrock-agentcore:RetrieveMemoryRecords"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PassRoleForHarnessCreation",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::*:role/*",
      "Condition": {
        "StringEquals": {
          "iam:PassedToService": "bedrock-agentcore.amazonaws.com"
        }
      }
    },
    {
      "Sid": "CloudWatchMetrics",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchLogsTraces",
      "Effect": "Allow",
      "Action": [
        "logs:StartQuery",
        "logs:GetQueryResults",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ],
      "Resource": [
        "arn:aws:logs:*:*:log-group:aws/spans:*",
        "arn:aws:logs:*:*:log-group:/aws/bedrock-agentcore/runtimes/*"
      ]
    },
    {
      "Sid": "BedrockModelAccess",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:*:*:inference-profile/*"
    }
  ]
}
```

#### Scoping Down Permissions

To restrict to specific agents or regions:

- Replace `"Resource": "*"` in `AgentCoreFullAccess` with specific agent ARNs:
  ```
  "arn:aws:bedrock-agentcore:us-east-1:ACCOUNT_ID:runtime/*"
  "arn:aws:bedrock-agentcore:us-east-1:ACCOUNT_ID:harness/*"
  "arn:aws:bedrock-agentcore:us-east-1:ACCOUNT_ID:memory/*"
  ```
- The `CloudWatchLogsTraces` statement is already scoped to AgentCore log groups and the `aws/spans` group
- The `PassRoleForHarnessCreation` statement is only needed if using the Deploy button on the Build page. Scope the `Resource` to your specific harness execution role ARN for tighter security.
- The `BedrockModelAccess` is only needed if using the Builder feature (agent creation via Converse API)

### Authentication

The app itself has no built-in auth. For production, add one of:

- **Amazon Cognito** — Easiest with Amplify; add a User Pool + hosted UI
- **IAM Identity Center** — For internal/enterprise use with SSO
- **Existing IdP** — SAML/OIDC federation through Cognito or directly

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AWS_REGION` | No | `us-east-1` | AWS region where agents are deployed |
| `AWS_ACCESS_KEY_ID` | No* | — | Only needed for local dev; use IAM roles in production |
| `AWS_SECRET_ACCESS_KEY` | No* | — | Only needed for local dev; use IAM roles in production |

*The AWS SDK credential chain automatically picks up: env vars → IAM role (ECS/Lambda/EC2) → `~/.aws/credentials`. In production, always use IAM roles — never hardcode keys.

---

## Testing

The project includes a comprehensive Playwright test suite that validates all UI tabs, API routes, and end-to-end workflow execution.

### Setup

```bash
npm install
npx playwright install chromium
```

### Run Tests

```bash
# Quick UI validation — all tabs + API routes (~15 seconds)
npm test

# Full suite including real workflow submission (~5-10 minutes)
./tests/run-all.sh --full

# Individual tab tests
npx playwright test tests/tab-dashboard.spec.ts
npx playwright test tests/tab-agents.spec.ts
npx playwright test tests/tab-build.spec.ts
npx playwright test tests/tab-workflow.spec.ts
npx playwright test tests/tab-routing.spec.ts
npx playwright test tests/tab-tickets.spec.ts

# End-to-end workflow (submits real workflow, monitors pipeline)
npx playwright test tests/e2e-workflow-full.spec.ts --timeout 600000
```

### Test Coverage

| Suite | What it validates |
|-------|-------------------|
| `tab-dashboard` | Metrics, navigation, sidebar collapse/expand |
| `tab-agents` | Agent discovery, card rendering, detail page chat |
| `tab-build` | Builder chat interface, inputs, deploy button |
| `tab-workflow` | Intake form, model selector, workflow history |
| `tab-routing` | Pipeline visualization, sample tickets, custom input |
| `tab-tickets` | Ticket history table, search/filter |
| `e2e-api-routes` | All API endpoints return expected data |
| `e2e-workflow-full` | Real workflow submission + phase progression |

Screenshots are saved to `test-results/` on failure for debugging.
