# Agentis Hub — Architecture Pipeline Visualization

**File:** `agentis-v1-pipeline.html`
**Type:** Single-file HTML (self-contained, no external dependencies)
**Size:** ~141KB (icons are base64-embedded)

## What This Is

An animated architecture visualization showing the full Agentis Hub multi-agent development pipeline. It demonstrates how 13 AWS Bedrock AgentCore agents across 5 phases autonomously take a PRD/mockup from intake to shipped code with zero human intervention.

Open `agentis-v1-pipeline.html` directly in any modern browser — no server needed.

## Pipeline Architecture (5 Phases)

### Phase 1: Intake (Web Application)
- **Type:** Next.js 14 App Router (not an agent)
- **Function:** User uploads PRD/mockup/Figma, sets target repo, artifacts stored in S3
- **Trigger:** Creates epic + pre-creates ALL 13 agent ticket skeletons with dependency chains in DynamoDB. Requirements ticket starts as "todo" (no blockers), all others start "blocked". DynamoDB Stream triggers orchestrator.

### Phase 2: Requirements (1 Agent)
- **Agent:** Requirements Analyst
- **Model:** Claude Opus 4 via Bedrock (`us.anthropic.claude-opus-4-0-v1`)
- **Tools:** S3 Read/Write, Jira (list_tickets, transition_ticket, update_ticket, add_comment), SkillLoader, Browser
- **Skill loaded:** `requirements-analysis`
- **Process:** Load skill -> Read PRD from S3 -> Analyze requirements -> List pre-created ticket skeletons under epic -> Skip irrelevant agents (transition "skip" with reason) -> Update relevant tickets with detailed requirements -> Transition own ticket to "done" -> DynamoDB Stream cascade unblocks design phase

### Phase 3: Design (7 Agents in Parallel)
- **Agents:** iOS Designer, Backend Designer, Android Designer, Security Reviewer, Legal & Compliance, Localization, Analytics Designer
- **Model:** Claude Opus 4 via Bedrock
- **Tools:** S3 Read/Write, A2A, GitHub, SkillLoader, Browser
- **Skills loaded:** `ios-architecture`, `android-architecture`, `backend-systems`, `privacy-compliance`, `threat-modeling`, `localization`, `general-design`
- **Process:** Unblocked by requirements completion -> All non-skipped agents wake simultaneously -> Read requirements from S3 -> Load skills -> Produce design docs in parallel -> Write artifacts to S3 -> Agent-invoker marks ticket "done" -> DynamoDB Stream cascade unblocks dev phase

### Phase 4: Development (3 Agents in Parallel)
- **Agents:** Backend Developer, API Developer, Frontend Developer
- **Model:** Claude Opus 4 via Bedrock
- **Tools:** S3 Read, Code Interpreter, GitHub (commit, branch, PR), SkillLoader, A2A
- **Skills loaded:** `node-typescript` (backend + API), `full-stack`, `swift-development`
- **Process:** Unblocked by ALL design tickets completing -> Orchestrator creates shared feature branch -> Code in parallel using Code Interpreter sandboxes -> Commit to feature branch + push PR -> Agent-invoker marks ticket "done" -> DynamoDB Stream cascade unblocks QA

### Phase 5: QA & Ship (2 Agents)
- **Agents:** QA Verifier, CI Agent
- **Model:** Claude Opus 4 via Bedrock
- **Tools:** GitHub, Code Interpreter, A2A, SkillLoader
- **Skill loaded:** `qa-verification`
- **Process:** Unblocked by ALL dev tickets completing -> Read feature branch via GitHub tools -> Run tests in Code Interpreter sandbox -> Code review + test verification -> Workflow complete

## Animation Behavior

### Timing
- Each phase activates sequentially (pipeline flow)
- Within phases, parallel agents activate **simultaneously** (not cascading)
- Tools activate when used, re-activate when re-used (e.g., S3 tool lights up again when writing output)
- Git CLI and output items (Feature Branch, PR) light up simultaneously to show they're the same action

### Visual States
| State | Border Color | Effect |
|-------|-------------|--------|
| Inactive | `#1e293b` (dark) | 35% opacity |
| Active | `#0ea5e9` (blue) | Blue glow |
| Working | `#0ea5e9` (blue) | Breathing pulse animation |
| Done | `#22c55e` (green) | Subtle green glow |
| Trigger | `#f97316` (orange) | Brief scale pulse (connector fires) |

### Celebration Effect
On pipeline completion, all elements burst simultaneously using CSS `@keyframes` animations (not transitions — transitions can stagger due to browser paint order). Burst starts bright orange/white and settles back to subtle done state over 1.2s.

Key implementation detail: `document.body.offsetHeight` forces a reflow before adding the `celebrate` class, ensuring all animations start on the exact same frame.

## AWS Icons Used

All icons are from the official **AWS Architecture Icons** package (version 04302026), 48px PNG variants, base64-embedded:

| Icon | Service | Used For |
|------|---------|----------|
| `Arch_Amazon-Bedrock_48.png` | Amazon Bedrock | Model provider (Claude Opus 4) |
| `Arch_Amazon-Bedrock-AgentCore_48.png` | Bedrock AgentCore | Agent runtime + memory |
| `Arch_Amazon-Simple-Storage-Service_48.png` | Amazon S3 | Artifact storage |
| `Arch_Amazon-EventBridge_48.png` | Amazon EventBridge | Intake trigger |
| `Arch_AWS-CodeBuild_48.png` | (repurposed) | Code Interpreter sandbox |

Icons source: https://aws.amazon.com/architecture/icons/

## How to Recreate

### Prerequisites
1. Download AWS Architecture Icons: https://aws.amazon.com/architecture/icons/
2. Extract to get the 48px PNG files from `Architecture-Service-Icons_*/Arch_*/48/`

### Base64 Encoding Icons
```bash
# Example: encode an icon to base64 for embedding
base64 -i "Arch_Amazon-Bedrock_48.png" | tr -d '\n'
```

### Structure
The file is a single HTML document with:
1. `<style>` block — all CSS including animations
2. `<body>` — HTML structure (legend, 5 phase columns, status bar, controls)
3. `<script>` block — animation orchestration (async/await with sleep intervals)

### Key CSS Classes
- `.phase` — column container (states: active, done)
- `.agent-box` — phase header box (states: awake, done)
- `.item` — individual row (states: active, working, done, trigger)
- `.flow-path` — SVG connector between phases

### Key JavaScript Functions
- `activate(id, desc)` — light up an item (removes done state for re-activation)
- `startWorking(id)` — start breathing pulse
- `done(id)` — mark complete
- `trigger(id)` — orange flash (for connector-firing items)
- `wakeAgent(boxId)` / `doneAgent(boxId)` — phase box states
- `animateConnector(fromId, fromSide, toId, toSide, duration)` — draw animated SVG path between elements

### Animation Timing (approximate)
- Phase 1 (Intake): ~3.5s
- Phase 2 (Requirements): ~6s
- Phase 3 (Design): ~5s
- Phase 4 (Development): ~6s
- Phase 5 (QA & Ship): ~7s
- Celebration: 1.5s
- **Total runtime: ~30s**

## Architectural Accuracy Notes

- **Pre-created ticket skeletons** — ALL 13 tickets are created at workflow start with dependency chains. Requirements agent SKIPs irrelevant ones (transitions to "done"). No runtime ticket creation needed.
- **DynamoDB Streams cascade** — the SOLE orchestration mechanism. Ticket status changes fire stream events → orchestrator Lambda unblocks dependents → next agents invoke.
- **Agent-invoker Lambda** — async fire-and-forget. Invokes AgentCore harness, streams output, marks ticket "done" as fallback after agent completes.
- **Agents own the logic** — agents use their Jira MCP tools to skip/update/transition tickets. No application-layer parsing of agent output.
- **EventBridge** is used for real-time UI notifications (agent.streaming, agent.complete events), not for orchestration.
- **Code Interpreter** is the actual Bedrock AgentCore tool (not AWS CodeBuild, but we use that icon as a visual stand-in)
- **Git operations** use GitHub MCP tools via the gateway, not a separate CI service
- **A2A** (Agent-to-Agent) allows cross-agent queries within the same phase
- **Skills** are loaded dynamically via `SkillLoader___load_skill` gateway tool at agent initialization

## File Location

- **Canonical copy:** `/Users/tycenj/Desktop/tinder-agentis-mvp/demo/agentis-v1-pipeline.html`
- **Temp copy:** `/private/tmp/agentis-v1-pipeline.html` (may be cleaned up by OS)
