# Backlog — AgentCore Console

Issues from senior engineer review (2026-05-15). Priority order.

## Completed

- [x] **#1 — Resume-session fork bug** — Short session IDs no longer silently fork; chat locks to read-only with a banner. `src/app/agents/[id]/page.tsx`
- [x] **#2 — Trace health endpoint** — `GET /api/agentcore/traces/health` probes Transaction Search + recent activity. Account-wide `TraceHealthBanner` renders only when unhealthy.
- [x] **#3 — Anchored session.id query** — Two-phase: `attributes.session.id = "..."` first, falls back to `@message like "..."` with `sessionIdPropagationMissing` diagnostic flag. Per-session `TraceDiagnosticBanner` explains why traces are missing.

## Ready to Fix (next up)

- [ ] **#4 — Sessions query uses regex parse on raw JSON** — `parse @message '"session.id":"*"'` is brittle to format changes. Use structured field `attributes.session.id` and `resource.attributes.service.name`. Also filter by exact service name instead of `@message like "${agentServiceName}"` which false-positives.
  - File: `src/app/api/agentcore/traces/sessions/route.ts:62-66`

- [ ] **#5 — 14-day window + 6s poll cap** — Default to 1-day (24h) for the per-session trace query. Bump poll budget to 15s. Surface timeout distinctly from "no data" (already partially done via diagnostics — just need the window + poll changes).
  - File: `src/app/api/agentcore/traces/route.ts:110,135`

- [ ] **#9 — Memory sessions N+1 serial calls** — `listSessions` calls per-actor are sequential. Use `Promise.all` for parallel fetching.
  - File: `src/app/api/agentcore/memory/sessions/route.ts:50-66`

- [ ] **#11 — Hardcoded model in builder** — `modelId: "us.anthropic.claude-sonnet-4-20250514-v1:0"` should be `process.env.BUILDER_MODEL_ID || "global.anthropic.claude-sonnet-4-5-20250929-v1:0"`.
  - File: `src/lib/agentcore-sdk.ts:496`

- [ ] **#15 — Dead code MiniMetric** — Unused component at bottom of agent detail page. Delete it.
  - File: `src/app/agents/[id]/page.tsx:1051`

## Lower Priority

- [ ] **#6 — In-memory caches don't survive horizontal scaling** — Trace cache, memory mappings, and payload formats are all in-memory Maps. Works for single-instance but breaks on ECS/Lambda multi-instance. Fix: DynamoDB or document as single-instance-only.
  - Files: `src/app/api/agentcore/traces/route.ts:18`, `src/lib/agentcore-sdk.ts:36-37`

- [ ] **#7 — Memory mappings persist to disk in CWD** — `.memory-mappings.json` in `process.cwd()` fails on read-only filesystems (Lambda, immutable containers). Fix: DynamoDB or env-based config.
  - File: `src/lib/agentcore-sdk.ts:46-59`

- [ ] **#8 — findMemoryForAgent heuristic** — Name-substring matching works for our agents but will false-positive on customer accounts. Consider: keep auto-detect but show "auto-detected: X — change?" in UI rather than removing it.
  - File: `src/lib/agentcore-sdk.ts:338-382`

- [ ] **#10 — Strands-biased span formatting** — `formatSpanName`/`categorizeSpan` only recognize Strands conventions. LangChain, CrewAI, and custom agents emit different names and fall through to generic "span". Add basic recognition for common framework patterns.
  - File: `src/app/api/agentcore/traces/route.ts:182-258`

- [ ] **#12 — TS unsoundness** — `(data as any).error` in agent detail. Type the API response properly.
  - File: `src/app/agents/[id]/page.tsx:61`

- [ ] **#13 — Chat-mode never fetches real OTEL spans** — After stream completes in chat mode, the persisted trace list doesn't refresh from CloudWatch. Either run `fetchOtelTraces` post-stream in chat mode or add a "Refresh from CloudWatch" button.
  - File: `src/app/agents/[id]/page.tsx` (chat send handler)

- [ ] **#14 — traceCacheGet race** — Mutates the Map on every read for LRU bookkeeping in a GET handler. Low impact (cache, not correctness) but unnecessary. Fix: use a proper LRU or just don't reorder on read.
  - File: `src/app/api/agentcore/traces/route.ts:24-30`

## Architecture Decisions (future)

- [ ] **Cache completed session traces** — Sessions are immutable once complete. Cache their trace results with a long TTL to avoid re-running 14-day Logs Insights scans on every page load.
- [ ] **Watch for first-class AgentCore trace APIs** — Currently reverse-engineering CloudWatch Application Signals. AWS may ship dedicated list-traces APIs.
- [ ] **Open-source prep** — Remove internal references, add LICENSE, CONTRIBUTING.md, rename repo to `agentcore-console`.
