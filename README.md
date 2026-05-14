# Agentis Hub

A web console for Amazon Bedrock AgentCore that dynamically discovers and interacts with your deployed agents. Clone, configure your AWS credentials, and it works — no hardcoded ARNs, memory IDs, or account numbers.

## Features

- **Dashboard** — Real metrics from CloudWatch and OTEL traces: invocations, per-agent token usage, latency, sessions
- **Agents** — Card grid of harnesses and runtimes; click for detail + invoke
- **Agent Detail** — Model, tools, memory, logs + live chat with sessions and full OTEL execution trace
- **Builder** — Chat-based agent creation via Bedrock Converse API

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

The only env var needed is `AWS_REGION` (defaults to `us-east-1`):

```bash
cp .env.example .env.local
# Edit AWS_REGION if your agents are in a different region
```

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
        "bedrock-agentcore:ListSessions",
        "bedrock-agentcore:ListActors",
        "bedrock-agentcore:ListEvents",
        "bedrock-agentcore:CreateEvent",
        "bedrock-agentcore:RetrieveMemoryRecords"
      ],
      "Resource": "*"
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
