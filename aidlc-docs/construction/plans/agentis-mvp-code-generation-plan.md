# Code Generation Plan: Agentis MVP

## Unit Context
- **Unit**: Full Next.js Application + ABCA Deployment
- **Target**: Working demo of autonomous coding agent platform with real agent execution
- **Framework**: Next.js 14+ (App Router, TypeScript, Tailwind CSS)
- **Agent Runtime**: aws-samples/sample-autonomous-cloud-coding-agents (CDK deploy to AWS)
- **Output**: Single repo, ABCA deployed to AWS, frontend on localhost

## Architecture
```
+----------------------------------+
|   Next.js Frontend (localhost)   |
|   npm run dev                    |
+----------------------------------+
          |  REST API calls
          v
+----------------------------------+
|   ABCA Stack (your AWS account)  |
|   - API Gateway                  |
|   - Input Gateway Lambda         |
|   - Orchestrator (Step Functions)|
|   - AgentCore Runtime (MicroVMs) |
|   - DynamoDB (Tasks, Events)     |
|   - Blueprints                   |
+----------------------------------+
          |
          v
+----------------------------------+
|   GitHub (real PRs)              |
+----------------------------------+
```

## What's REAL vs MOCKED

| Component | Status | Notes |
|-----------|--------|-------|
| Agent runtime | REAL | ABCA deployed via CDK |
| Blueprints | REAL | Configured in ABCA |
| Task submission | REAL | Calls ABCA API |
| Task execution | REAL | Agent runs in MicroVM |
| Task states/events | REAL | From ABCA DynamoDB |
| GitHub PRs | REAL | Agent creates real PRs |
| Monitor dashboard | REAL | Reads ABCA task/event data |
| Debug traces | REAL | ABCA TaskEvents audit log |
| Workstream selection | REAL | Agent determines from input |
| Jira structure | SIMULATED | In-UI task board (not real Jira API) |
| Chat/Invoke | MOCKED | Placeholder UI, real chat added later |

## Project Structure
```
tinder-agentis-mvp/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Dashboard
│   │   ├── agents/
│   │   │   ├── page.tsx          # Agent catalog (from ABCA blueprints)
│   │   │   └── [id]/page.tsx     # Agent detail
│   │   ├── build/
│   │   │   └── page.tsx          # Intake → submit to ABCA
│   │   ├── deploy/
│   │   │   └── page.tsx          # Agent deployment management
│   │   ├── invoke/
│   │   │   └── page.tsx          # Mocked chat UI
│   │   ├── monitor/
│   │   │   └── page.tsx          # Real metrics from ABCA
│   │   ├── debug/
│   │   │   └── page.tsx          # Real execution traces
│   │   └── api/
│   │       ├── agents/route.ts   # Proxy to ABCA
│   │       ├── tasks/route.ts    # Proxy to ABCA GET/POST /v1/tasks
│   │       └── events/route.ts   # Proxy to ABCA GET /v1/tasks/{id}/events
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── StatusBar.tsx
│   │   ├── agents/
│   │   │   ├── AgentCard.tsx
│   │   │   └── AgentList.tsx
│   │   ├── build/
│   │   │   ├── IntakeForm.tsx
│   │   │   ├── FileUpload.tsx
│   │   │   └── WorkstreamPlan.tsx
│   │   ├── deploy/
│   │   │   ├── DeployCard.tsx
│   │   │   └── DeployStatus.tsx
│   │   ├── invoke/
│   │   │   ├── ChatInterface.tsx
│   │   │   └── MessageBubble.tsx
│   │   ├── monitor/
│   │   │   ├── MetricsChart.tsx
│   │   │   ├── InvocationLog.tsx
│   │   │   └── StatusGrid.tsx
│   │   └── debug/
│   │       ├── TraceViewer.tsx
│   │       ├── EvalRunner.tsx
│   │       └── StepDetail.tsx
│   ├── lib/
│   │   ├── abca-client.ts       # ABCA REST API client
│   │   ├── types.ts             # TypeScript interfaces (aligned with ABCA schema)
│   │   ├── mock-chat.ts         # Mock data for chat only
│   │   └── utils.ts
│   └── styles/
│       └── globals.css
├── infra/                        # ABCA deployment reference/scripts
│   ├── deploy.sh                 # Script to deploy ABCA stack
│   └── README.md                 # Infrastructure setup instructions
├── public/
│   └── logo.svg
├── .env.example                  # ABCA_API_URL, AWS_REGION, etc.
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── README.md                     # Full setup: deploy ABCA + run frontend
```

---

## Generation Steps

### Step 1: Project Scaffolding
- [ ] Initialize Next.js project with TypeScript + Tailwind + App Router
- [ ] Configure package.json (next, react, tailwindcss, lucide-react, recharts)
- [ ] Configure tsconfig.json, tailwind.config.ts, next.config.ts
- [ ] Create globals.css with dark theme
- [ ] Create .env.example with ABCA connection vars

### Step 2: Type Definitions & ABCA Client
- [ ] Create `src/lib/types.ts` — interfaces aligned with ABCA schema (Task, TaskEvent, Blueprint, Agent status, InternalMessage)
- [ ] Create `src/lib/abca-client.ts` — REST client for ABCA API (GET /v1/tasks, POST /v1/tasks, GET /v1/tasks/{id}/events)
- [ ] Create `src/lib/mock-chat.ts` — mock data for invoke/chat only
- [ ] Create `src/lib/utils.ts` — formatting helpers

### Step 3: Layout & Navigation
- [ ] Create root `layout.tsx` with sidebar navigation
- [ ] Create `Sidebar.tsx` — nav for: Dashboard, Agents, Build, Deploy, Invoke, Monitor, Debug
- [ ] Create `Header.tsx` — breadcrumb, search, connection status to ABCA
- [ ] Dark theme, developer-tool aesthetic

### Step 4: Dashboard/Home Page
- [ ] Create `app/page.tsx` — overview pulling real data from ABCA API
- [ ] Show: active agents, recent tasks (from ABCA), system status, quick actions
- [ ] Summary cards linking to each capability

### Step 5: Agent Catalog
- [ ] Create `app/agents/page.tsx` — list agents/blueprints from ABCA config
- [ ] Create `AgentCard.tsx` — agent name, status, blueprint type, last task
- [ ] Create `app/agents/[id]/page.tsx` — agent detail (config, MCP servers, task history)

### Step 6: Build Capability (Real ABCA Submission)
- [ ] Create `app/build/page.tsx` — intake flow
- [ ] Create `IntakeForm.tsx` — multi-step: upload docs / paste requirements / connect repo
- [ ] Create `FileUpload.tsx` — drag-and-drop
- [ ] Create `WorkstreamPlan.tsx` — shows generated epic + workstream tickets after ABCA analyzes input
- [ ] On submit: POST to ABCA API to create a real task
- [ ] Show ABCA task state progression in real-time

### Step 7: Deploy Capability
- [ ] Create `app/deploy/page.tsx` — agent deployment management
- [ ] Create `DeployCard.tsx` — agent status (maps to ABCA blueprint deployment state)
- [ ] Create `DeployStatus.tsx` — deployment history, configuration
- [ ] Actions: configure blueprint, view deployment status

### Step 8: Invoke/Play Capability (Mocked Chat)
- [ ] Create `app/invoke/page.tsx` — chat interface
- [ ] Create `ChatInterface.tsx` — message list + input, agent selector
- [ ] Create `MessageBubble.tsx` — user/agent message styling
- [ ] Mocked streaming responses (typewriter effect)
- [ ] Banner indicating "Chat integration coming soon — use Build to submit real tasks"

### Step 9: Monitor Capability (Real ABCA Data)
- [ ] Create `app/monitor/page.tsx` — monitoring dashboard
- [ ] Create `MetricsChart.tsx` — charts from real ABCA task data (invocations over time, duration, success/fail)
- [ ] Create `InvocationLog.tsx` — live feed from GET /v1/tasks (polling or SSE)
- [ ] Create `StatusGrid.tsx` — agent health from real task states

### Step 10: Debug Capability (Real ABCA Traces)
- [ ] Create `app/debug/page.tsx` — debug & evaluation
- [ ] Create `TraceViewer.tsx` — step-by-step from GET /v1/tasks/{id}/events (real TaskEvents)
- [ ] Create `EvalRunner.tsx` — trigger evaluation run against an agent
- [ ] Create `StepDetail.tsx` — individual event detail (tool calls, reasoning, outputs)
- [ ] Show real ABCA states: SUBMITTED → HYDRATING → RUNNING → FINALIZING → COMPLETED/FAILED

### Step 11: API Routes (Proxy to ABCA)
- [ ] Create `app/api/agents/route.ts` — proxy/aggregate ABCA agent data
- [ ] Create `app/api/tasks/route.ts` — proxy to ABCA POST/GET /v1/tasks
- [ ] Create `app/api/events/route.ts` — proxy to ABCA GET /v1/tasks/{id}/events
- [ ] Handle ABCA auth (API key or Cognito token in server-side routes)

### Step 12: Infrastructure & Deployment Scripts
- [ ] Create `infra/deploy.sh` — script to clone and deploy ABCA stack via CDK
- [ ] Create `infra/README.md` — prerequisites, AWS account setup, CDK deploy instructions
- [ ] Create root `README.md` — full setup guide (deploy ABCA + configure .env + run frontend)
- [ ] Create `.env.example` with all required vars

### Step 13: Polish & Demo Readiness
- [ ] Add loading states and error handling for ABCA API calls
- [ ] Add connection status indicator (is ABCA reachable?)
- [ ] Ensure all navigation flows work end-to-end
- [ ] Test: submit a real task via Build → watch it appear in Monitor → view trace in Debug
- [ ] Verify real PR gets created on GitHub

---

## Key Design Decisions
- **Dark theme** — developer tool aesthetic
- **Real-first** — everything hits real ABCA APIs except chat
- **Proxy pattern** — Next.js API routes proxy to ABCA (keeps ABCA URL server-side, handles auth)
- **ABCA-native** — task states, event schema, blueprint model all match ABCA exactly
- **Portable** — .env config for ABCA endpoint, works with any ABCA deployment
