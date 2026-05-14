# AgentCore Console

A web console for Amazon Bedrock AgentCore that dynamically discovers and interacts with your deployed agents. Clone, configure your AWS credentials, and it works — no hardcoded ARNs, memory IDs, or account numbers.

## Features

- **Dashboard** — Overview of all discovered agents with status
- **Agents** — Card grid of harnesses and runtimes; click for detail + invoke
- **Agent Detail** — Model, tools, memory, logs + live chat with sessions and execution trace
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
4. **Traces** — Execution traces pulled from CloudWatch Logs (OTEL format) at `/aws/bedrock-agentcore/runtimes/`

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- AWS SDKs: `@aws-sdk/client-bedrock-agentcore`, `@aws-sdk/client-bedrock-agentcore-control`, `@aws-sdk/client-bedrock-runtime`, `@aws-sdk/client-cloudwatch-logs`
