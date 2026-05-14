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
