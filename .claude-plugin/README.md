# AgentCore Hub Setup Plugin

A Claude Code plugin that turns AgentCore Hub setup from "read a 900-line README and run six scripts in the right order" into a guided conversation.

## What it does

Run `/setup` from inside an `agentcore-hub` clone. The plugin:

1. Asks 4–6 questions to figure out which modules you want.
2. Detects your AWS account/region from existing credentials.
3. Generates a `.env.local` from your answers (existing files are backed up).
4. Runs only the deploy scripts the modules you picked actually need.
5. Verifies each phase before moving to the next, surfacing real errors instead of swallowing them.

## What it deploys

The plugin reasons about four modules (see `docs/MODULES.md` for the full breakdown):

- **Core** — always installed. Discovery, Agents browser, Invoke console.
- **Builder** — `/build` page + `builder-tools` Lambda.
- **Workflow** — multi-agent pipeline + Jira/DynamoDB ticket store + 14-agent runtime fleet.
- **Evaluations** — CloudWatch-driven eval packager + self-improvement loop.

## File layout

```
.claude-plugin/
├── plugin.json                # plugin manifest
├── skills/
│   └── setup.md               # the /setup conversation flow
├── agents/
│   └── deploy-runner.md       # subagent for long-running deploys (5–15 min)
└── bin/
    ├── apply-env.sh           # writes .env.local from a JSON answer blob
    ├── run-module.sh <module> # the one place that knows script order per module
    └── verify-module.sh <module>
```

`bin/run-module.sh` is the single source of truth for "to deploy module X, run scripts A, B, C." If a script is added or removed, this file is the only one to update.

## Hard rules the plugin follows

- Never adds new infra — only orchestrates scripts that already exist in `deploy/` and `scripts/`.
- Never overwrites `.env.local` — backs up to `.env.local.bak` first.
- Always passes `AWS_PROFILE` + `AWS_REGION` through to every `aws` call. Never assumes `default`.
- Never logs secrets (Jira API token, GitHub PAT). They go straight from the prompt into `.env.local` mode 600.
- Never silences errors — verification failures show the real stderr and the script that produced it.

## Re-runs

`/setup` is safe to re-run. Underlying scripts are idempotent and the plugin checks for existing resources before creating new ones.
