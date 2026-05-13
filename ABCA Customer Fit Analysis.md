# ABCA Repository — Customer Fit Analysis

**Repository:** [aws-samples/sample-autonomous-cloud-coding-agents](https://github.com/aws-samples/sample-autonomous-cloud-coding-agents)

---

## Customer Requirements vs. ABCA Capabilities

### 1. ✅ Dashboard UI with Session History (Resumable)

**What they want:** A custom dashboard where users can see all sessions/conversations with the agent, click on one, and resume it with full prior context.

**What ABCA provides:**
- ABCA has a **Tasks table in DynamoDB** that tracks every task with full metadata (task_id, status, timestamps, PR URLs, error messages, etc.)
- A **TaskEvents audit log** (append-only) captures every event in the task lifecycle
- Tasks have states: `SUBMITTED → HYDRATING → RUNNING → FINALIZING → COMPLETED/FAILED/CANCELLED`
- There's a REST API (`GET /v1/tasks`, `GET /v1/tasks/{id}`, `GET /v1/tasks/{id}/events`) that exposes all this
- The platform has a **memory system** (AgentCore Memory) that persists learnings across sessions per-repo

**Gap / Customization needed:**
- ⚠️ ABCA does **not** ship a web UI — it's CLI + API + Slack. The dashboard would need to be **built custom** on top of the existing REST API
- ⚠️ Sessions are **ephemeral and fire-and-forget** by design. Each task runs autonomously and ends. There is no "resume a conversation mid-task" capability. However...
- ✅ The **memory system** carries context across sessions. A new task on the same repo retrieves past episodes, learnings, and review feedback. So "resuming" means submitting a follow-up task that inherits memory — not literally re-entering a live session.
- The Input Gateway docs explicitly mention a **"future: web UI"** as a planned channel. The architecture is designed to support it (channel-agnostic internal message schema).

**Verdict:** The backend APIs and data model support building a dashboard. The "session history" UX is achievable — but it's a new task with memory, not a true session resume. The customer would build their own React/Next.js frontend against the existing REST API.

---

### 2. ⚠️ Interactive Chat with the Agent

**What they want:** The ability to have a real-time chat conversation with the agent (like ChatGPT/Claude/Amazon Quick).

**What ABCA provides:**
- ABCA is explicitly designed as **"asynchronous — no real-time conversation during execution"**
- The README states: *"No human interaction during execution"* and *"Fire and forget — submit, forget, review the outcome"*
- The agent runs in isolated MicroVMs with no interactive I/O

**Gap:**
- ❌ **This is a fundamental architectural mismatch.** ABCA is a background agent, not a conversational agent. There is no WebSocket/streaming interface, no message-passing during execution, and no turn-based conversation loop.
- To add chat, you would need to build a **separate conversational layer** — essentially a different agent mode that uses the same tooling (Claude Agent SDK, AgentCore) but with streaming responses and turn-based interaction instead of the fire-and-forget blueprint.

**Possible workaround:**
- Build a separate "chat mode" alongside ABCA's "task mode"
- Use the same AgentCore Runtime + Claude Agent SDK but with a synchronous/streaming invocation pattern
- Share the memory system so chat context and task context are unified
- This is significant custom development — it's building a second product on top of the same infra

**Verdict:** Not supported out of the box. Major custom development needed. Consider whether the customer actually needs chat *with the coding agent* or chat *about* the coding agent's work (the latter is much easier — just a standard chatbot that queries task status and memory).

---

### 3. ✅ Jira Integration (Webhook → Coding Task)

**What they want:** A Jira ticket triggers the coding process automatically via webhooks.

**What ABCA provides:**
- ✅ The platform already supports **HMAC-signed webhooks** as an input channel
- ✅ The Input Gateway architecture is explicitly designed to normalize requests from multiple channels (CLI, Slack, webhooks, web UI, GitHub Actions, browser extensions)
- ✅ Adding Jira is just a new **channel adapter** — it normalizes the Jira webhook payload into the internal message schema
- The typed task schema already supports: `task_description`, `repo` (org/repo), `issue_number`, and attachments

**What's needed:**
- Build a Jira channel adapter (Lambda function that receives Jira webhooks, validates them, and normalizes to the internal schema)
- Map Jira ticket fields (title, description, acceptance criteria) to the task description
- Add Jira-specific outbound adapter (post status updates back to the Jira ticket as comments)

**Verdict:** This is one of the easiest requirements. The architecture is designed for exactly this — adding a new input channel is a plug-in, not a rewrite.

---

### 4. ⚠️ Dynamic MCP Servers & Skills (Not Preconfigured)

**What they want:** The agent dynamically loads MCP servers and skills based on the task at hand, rather than having a fixed tool set.

**What ABCA provides:**
- The current tool set is: Shell, Filesystem, GitHub, Web Search (via AgentCore Gateway)
- The docs explicitly state: *"Plugins, skills, and MCP servers are out of scope for MVP"*
- However, the architecture has extension points:
  - Per-repo **Blueprint configuration** can customize which tools are available
  - **AgentCore Gateway** mediates tool access and can expose MCP servers
  - The security model has a tiered tool approach: "Default" (minimal) vs. "Extended" (opt-in per repo)
  - Per-repo `compute_type` and tool profiles are stored in onboarding config

**Gap:**
- ❌ **Fully dynamic, runtime tool selection** (agent decides which MCP servers to load based on the task) is NOT supported
- The current model is: tools are **preconfigured per repo** at onboarding time via the Blueprint CDK construct
- Dynamic tool loading would require changes to:
  1. The Blueprint model (make tools a runtime decision, not deploy-time)
  2. The AgentCore Gateway configuration
  3. The security model (Cedar policies would need to be dynamic too)
  4. Agent harness code (tool discovery + registration at runtime)

**Possible approach:**
- Use the Blueprint's existing `compute_type` + tool profile pattern but make it more granular
- Pre-register a catalog of MCP servers in AgentCore Gateway
- At context hydration, the orchestrator selects which MCP servers to enable based on task metadata (repo type, language, frameworks detected)
- This is "semi-dynamic" — choose from a pre-registered catalog at task start, but not truly runtime-discoverable

**Verdict:** Partially achievable with customization. True "the agent figures out what tools it needs and installs them on the fly" would require significant extension work. A "task routes to a pre-configured profile" model is more feasible.

---

### 5. ✅ Cloudflare Authentication (Replace Built-in Auth)

**What they want:** Users authenticate through Cloudflare, bypassing ABCA's built-in WAF and Cognito auth.

**What ABCA provides:**
- Current auth: Amazon Cognito (JWT) for CLI/REST, HMAC-SHA256 for webhooks
- Edge protection: AWS WAFv2 (common rules, rate limiting)
- The Input Gateway is designed for **extensible authentication** — each channel has its own auth mechanism

**What's needed:**
- Replace Cognito JWT verification with Cloudflare Access JWT verification (Cloudflare issues JWTs when users authenticate through their Zero Trust tunnel)
- The gateway Lambda just needs to verify against Cloudflare's JWKS endpoint instead of Cognito's
- Map the Cloudflare JWT claims (email, identity) to the platform's internal `user_id`
- Remove or skip the WAFv2 layer (since Cloudflare handles edge security)

**Implementation:**
1. Cloudflare Access sits in front of the API Gateway
2. Modify the Input Gateway's auth verification to validate Cloudflare-issued JWTs
3. Map `cf-access-jwt-assertion` header to internal user identity
4. Optionally remove WAFv2 rules (Cloudflare handles DDoS, bot protection, rate limiting)

**Verdict:** Very doable. It's swapping one JWT issuer (Cognito) for another (Cloudflare Access). The Input Gateway architecture specifically isolates auth as a per-channel concern. The user_id mapping needs work, but it's straightforward.

---

### 6. ✅ Bypass Input Gateway WAF → Go Straight to Orchestrator

**What they want:** After Cloudflare authenticates, requests go directly to the orchestration layer, skipping ABCA's own WAF/auth/API Gateway.

**What ABCA provides:**
- The architecture has clear separation: **Input Gateway** (auth + normalize + validate) → **Orchestrator** (task lifecycle)
- The Orchestrator is a Lambda Durable Function triggered by the internal message schema
- The Input Gateway's output is a typed `InternalMessage` — any component that produces this format can drive the orchestrator

**Options:**
1. **Replace the API Gateway + WAF** with Cloudflare → Lambda (direct invocation via Function URL or ALB behind Cloudflare)
2. **Keep API Gateway** but remove WAF rules and rely on Cloudflare for edge protection. API Gateway becomes a thin pass-through.
3. **Cloudflare Worker → Lambda Function URL** — Cloudflare handles auth, rate limiting, then calls the Lambda directly. Skip API Gateway entirely.

**Important caveat:**
- You still need the **normalization and validation** step somewhere. The Input Gateway doesn't just do auth — it also validates payloads, screens content through Bedrock Guardrails, and produces the typed internal message. If you bypass it entirely, you'd need to replicate those checks in the Cloudflare Worker or a lightweight Lambda.

**Verdict:** Achievable. The cleanest approach is: Cloudflare Access (auth) → API Gateway or Lambda Function URL (thin proxy, no WAF) → Existing validation/normalization Lambda → Orchestrator. You're removing WAFv2 and Cognito, not bypassing safety-critical validation.

---

## Architecture Summary: What Fits vs. What Needs Work

| Requirement | Fit | Effort |
|---|---|---|
| Dashboard UI with session history | 🟡 Backend ready, frontend needs building | Medium |
| Resumable sessions (pick up context) | 🟡 Via memory, not literal session resume | Low-Medium |
| Interactive chat with agent | 🔴 Architectural mismatch — fire-and-forget only | High |
| Jira webhook integration | 🟢 Designed for this exact pattern | Low |
| Dynamic MCP servers/skills | 🟡 Semi-dynamic via Blueprint profiles | Medium-High |
| Cloudflare authentication | 🟢 JWT swap, well-isolated concern | Low |
| Bypass WAF → direct to orchestrator | 🟢 Clean architectural boundary | Low |

---

## Recommendation

ABCA is a strong fit for **5 out of 7** requirements. The two challenges are:

1. **Interactive chat** — This is the biggest gap. ABCA is architecturally a batch/async system. If the customer truly needs real-time chat with the coding agent (not just status queries), they'd need to build a separate conversational mode alongside ABCA's task mode, sharing the same infra (AgentCore, memory, repo access).

2. **Fully dynamic tools** — Achievable as a "select from catalog at task start" pattern rather than "agent discovers and installs tools at runtime."

**The customer's flow would look like:**

```
User → Cloudflare Access (auth) → API Gateway (thin) → Input Gateway Lambda (validate, normalize, guardrails)
                                                              ↓
Jira Webhook → Jira Adapter Lambda → Internal Message Schema → Orchestrator (Lambda Durable)
                                                              ↓
                                                    Blueprint selects tools/MCP profile
                                                              ↓
                                                    AgentCore Runtime (MicroVM)
                                                              ↓
                                                    Agent executes → PR created
                                                              ↓
Dashboard UI ← REST API ← Tasks table + TaskEvents + Memory
```

The custom dashboard reads from the existing DynamoDB tables and REST API. The Jira adapter is a new Lambda. Cloudflare replaces Cognito/WAF. The tool profile system gets extended for semi-dynamic selection.
