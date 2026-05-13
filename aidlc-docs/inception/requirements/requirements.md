# Requirements Document: Tinder Agentis MVP

## Intent Analysis

- **User Request**: Build an MVP for a cloud-based autonomous coding agent platform with a web frontend (single pane of glass) that allows developers to build, deploy, invoke, monitor, and debug AI agents.
- **Request Type**: New Project (MVP / Demo)
- **Scope**: Full-stack web application + agent runtime integration
- **Complexity**: High (but scoped to demo-ready for tomorrow)
- **Timeline**: Demo tomorrow — bare-minimum working demo

---

## Project Context

- **Target Audience**: Internal Tinder engineering team
- **Existing Platform**: Tinder has an internal platform called "Agentis" with Cloudflare auth
- **Goal**: Provide a "single pane of glass" frontend + working autonomous coding agents that they can later integrate into their existing stack
- **Agent Runtime**: Based on [aws-samples/sample-autonomous-cloud-coding-agents](https://github.com/aws-samples/sample-autonomous-cloud-coding-agents)

---

## Functional Requirements

### FR-1: Single Pane of Glass Web UI
- **Framework**: Next.js (React, App Router)
- **Deployment**: Localhost only (`npm run dev` or `npm start`)
- **Auth**: None (they'll wrap in their Cloudflare auth)
- **Core Views**:
  - Agent catalog/registry (view all available agents)
  - MCP server management
  - Blueprint management
  - Build interface
  - Deploy interface
  - Invoke/Play interface
  - Monitor dashboard
  - Debug/Evaluation interface

### FR-2: Build Capability
- Users can create/configure new agents through the UI
- Intake supports multiple methods:
  - Upload documents (one-pager, prototype code)
  - Paste/type requirements in a chat interface
  - Connect a GitHub repository with existing prototype
- Intake triggers the full development lifecycle:
  - Analyze input → Generate spec
  - Spec → Jira-like epic (mocked internally)
  - Epic → Individual workstream tickets
  - Agent autonomously determines which workstreams/blueprints apply
- Workstreams include: Backend Design, iOS Design, Android Design, Security Review, Privacy, Analytics, Localization (agent decides which are relevant)

### FR-3: Deploy Capability
- Deploy agents from the UI
- Show deployment status
- Manage agent versions/lifecycle

### FR-4: Invoke/Play Capability
- Mocked chat UI for demo (polished interface, simulated responses)
- Real integration to be added later from existing codebase
- Conversation history within session (UI-only for MVP)

### FR-5: Monitor Capability
- Real-time dashboard showing:
  - Agent invocations
  - Latency metrics
  - Error rates
  - Active/inactive agent status

### FR-6: Debug Capability
- View agent execution traces/logs with step-by-step reasoning
- Run evaluations (automated test suites against agent outputs)
- On-demand or scheduled evaluation runs

### FR-7: Simulated Jira Integration
- Internal task tracking that mimics Jira structure
- Epics containing workstream tickets
- Status tracking (To Do, In Progress, Done)
- Link tickets to agent execution results

### FR-8: GitHub Integration
- Produce real pull requests to specified GitHub repositories
- Show PR status and links in the UI

---

## Non-Functional Requirements

### NFR-1: Simplicity
- Single repo, single command to run (`npm run dev` or `docker compose up`)
- No cloud infrastructure required for the demo
- Minimal configuration

### NFR-2: Demo-Ready
- Must be presentable tomorrow
- Prioritize working UI flows over complete backend implementation
- Mock data acceptable where real agent integration isn't ready

### NFR-3: Portability
- Self-contained repo they can clone and run
- Clear documentation for setup
- Designed so they can later integrate into their existing Agentis platform

### NFR-4: Performance (Demo-level)
- Responsive UI
- Streaming chat responses
- No specific latency SLAs for MVP

---

## Architecture Overview

```
+--------------------------------------------------+
|              Next.js Application                  |
|                                                  |
|  +----------+  +--------+  +---------+          |
|  | Agent    |  | Build  |  | Monitor |          |
|  | Catalog  |  | Flow   |  | Dash    |          |
|  +----------+  +--------+  +---------+          |
|  +----------+  +--------+  +---------+          |
|  | Deploy   |  | Invoke |  | Debug   |          |
|  | Manager  |  | Chat   |  | Traces  |          |
|  +----------+  +--------+  +---------+          |
|                                                  |
|  +--------------------------------------------+ |
|  |          Next.js API Routes                 | |
|  +--------------------------------------------+ |
+--------------------------------------------------+
         |              |              |
         v              v              v
+----------------+ +----------+ +------------+
| Agent Runtime  | | Mock     | | GitHub     |
| (aws-samples)  | | Jira     | | API        |
+----------------+ +----------+ +------------+
```

---

## MVP Scope Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth | None | They have Cloudflare; we focus on functionality |
| Cloud deploy | None | Localhost demo; they integrate later |
| Jira | Mocked | Real integration is their concern |
| GitHub PRs | Real | Core value prop of the platform |
| Invoke/Chat | Mocked for demo | Real chat from existing codebase later |
| Agent runtime | aws-samples harness | Specified requirement |
| Workstream selection | Agent-determined | Part of autonomous behavior |
| Security rules | Skipped | Prototype/demo |
| PBT rules | Skipped | Demo timeline |

---

## Extension Configuration

| Extension | Enabled | Decided At |
|-----------|---------|------------|
| Security Baseline | No | Requirements Analysis |
| Property-Based Testing | No | Requirements Analysis |
