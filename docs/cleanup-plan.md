# Repository Cleanup Plan

## Goal
Clean up the repo so it's presentable for customers. Remove personal artifacts, keep all product infrastructure (optional deployment scripts, agent fleet setup, etc.), and rework `demo/` into a reusable quickstart feature.

---

## .gitignore Additions

```
lambda/orchestrator/.aws-sam/
lambda/orchestrator/function.zip
deploy/runtime-agent/fleet-health-results.json
deploy/runtime-agent/fleet-runtime-ids.json
deploy/runtime-agent/repl_state
repl_state
demo/output/
demo/recordings/
*.mp4
*.webm
```

---

## Remove (personal/internal artifacts)

| Path | Reason |
|------|--------|
| `aidlc-docs/` | AIDLC workflow planning docs (your process, not product) |
| `aidlc-workflows/` | Same |
| `ABCA Customer Fit Analysis.md` | Internal sales doc |
| `BACKLOG.md` | Internal planning |
| `CHANGELOG.md` | Dev notes |
| `ideaWhiteboard.jpg` | Brainstorm |
| `idea.md` | Brainstorm |
| `demo-walkthrough.ts` | Old demo script |
| `demo/bug-reports/` | Internal retros |
| `demo/audio/`, `demo/audio-v2/` | Narration files |
| `demo/mockups/` | Old mockups |
| `demo/qa-*` | QA video scripts |
| `demo/*.sh` | Demo generation shell scripts |
| `demo/generate-tts.ts`, `demo/narration-v2.ts` | TTS generation |
| `demo/script.md` | Demo script |
| `demo/pipeline-css-and-structure.txt`, `demo/pipeline-screenshot.png` | Demo prep |
| `demo/agentis-v1-pipeline.html` | Old demo page |
| `demo/aws-icons.json` | Demo asset |
| `demo/lambda-durable-functions-assessment.md` | Internal research |
| `docs/prd-*` | Internal PRDs |
| `scripts/verify-workflow-run.md` | One-off notes |
| `lambda/jira-unified/` | Stale experimental Lambda variant |
| `deploy/branding/` | Your specific branding assets |

---

## Rework: `demo/` → Quickstart Test Run Feature

Strip all personal demo content. Replace with:

- **`demo/README.md`** — Explains how to run a test workflow and optionally record it
- **`demo/sample-workflows.json`** — Sample workflow configs customers can use (e.g., "Build a Tic-Tac-Toe game", "Add dark mode toggle")
- **`demo/playwright/`** — One clean playwright script that:
  1. Starts a workflow from sample config
  2. Monitors progress
  3. Optionally records the run
- **`demo/output/`** — Gitignored, user's recordings go here
- **`demo/recordings/`** — Gitignored, user's captures go here

---

## Keep As-Is (core product + optional infra)

| Path | Reason |
|------|--------|
| `src/` | Next.js app |
| `lambda/orchestrator/index.mjs` | Core orchestrator |
| `lambda/skill-loader/` | Skill loader Lambda |
| `lambda/jira-real/` | Jira tools Lambda |
| `deploy/runtime-agent/` | Agent fleet deployment (scripts, prompts, Dockerfile) |
| `deploy/setup-*.mjs` | DynamoDB, Jira mock, routing setup scripts |
| `Dockerfile` | App Runner deployment |
| `README.md` | Product documentation |
| `CLAUDE.md` | Dev instructions |
| `docs/workflow-pipeline-architecture.md` | Architecture decisions |
| `docs/agent-fleet-documentation.md` | Fleet documentation |
| `tests/`, `playwright.config.ts` | App tests |
| `public/` | Static assets |
| `package.json`, configs | Standard |

---

## Notes

- All deployment infra stays because it's part of the product offering (optional for customers)
- `TICKET_PROVIDER` flag-flip docs should remain in README (Jira vs DynamoDB deployment choice)
- `deploy/runtime-agent/fleet-runtime-ids.json` is gitignored — each deployment generates its own
