# Continuous Improvement Loop (Self-Improvement)

The Self-Improvement (SI) loop automatically evaluates every agent invocation and, when scores drop below threshold, generates a PRD to fix the root cause — triggering the same workflow pipeline that builds features.

## How It Works

```
Agent invocation
    ↓
OTEL traces → XRay → aws/spans (indexed)
    ↓
AgentCore Online Evaluation (8 evaluators, 100% sampling)
    ↓
Eval results → CloudWatch Logs
    ↓
CW Logs Subscription Filter
    ↓
agentis-eval-packager Lambda
  (parses scores, reads current prompt, packages context)
    ↓
agentis_fleet_improver Runtime Agent
  (root-cause analysis → writes PRD to S3)
    ↓
S3 PutObject (fleet-imp-agent/prd/*.json)
    ↓
EventBridge rule
    ↓
agentis-prd-submitter Lambda
  (reads PRD, submits to Workflow API with [SI] prefix)
    ↓
14-agent development pipeline produces a PR
```

## Prerequisites

1. Agent fleet deployed (`deploy/runtime-agent/deploy-fleet.sh`) — this deploys the 14 pipeline agents
2. **Fleet Improver agent deployed** — this is a 15th agent (`agentis_fleet_improver`) that performs root-cause analysis on low eval scores. It is deployed separately via `deploy/runtime-agent/deploy-fleet.sh` (included in the fleet manifest) but serves the SI loop specifically. Its prompt is at `deploy/runtime-agent/prompts/agentis_fleet_improver.txt`.
3. `agentcore` CLI installed and configured
4. App Runner service deployed and running (for the Workflow API endpoint)
5. S3 bucket exists: `agentis-artifacts-{ACCOUNT_ID}`

## Deploy (One Command)

```bash
cd deploy/continuous-improvement
./deploy-all.sh
```

This script:
1. Creates online eval configs for all 14 agents (if not already present)
2. Deploys the eval-packager and prd-submitter Lambdas
3. Sets up CW Logs subscription filters (eval results → packager)
4. Creates EventBridge rule (S3 PRD → submitter)
5. Syncs agent prompts to S3
6. Runs a verification check

### Environment Variables

Set these before running (or rely on `deploy/config.sh` defaults):

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `AWS_PROFILE` | Yes | — | AWS credentials profile |
| `DEPLOYMENT_URL` | Yes | — | App Runner URL (workflow API) |
| `GITHUB_OWNER` | Yes | — | GitHub org/user for fleet repo |
| `ARTIFACT_BUCKET` | No | `agentis-artifacts-{ACCOUNT_ID}` | S3 bucket |
| `IMPROVEMENT_AGENT_ID` | No | (from fleet-runtime-ids.json) | Fleet improver runtime ID |

## IAM Requirements

### Agent Runtime Role (`agentis-agentcore-role`)

The agent runtime role **must** include XRay permissions for traces to be indexed:

```json
{
  "Effect": "Allow",
  "Action": [
    "xray:PutTraceSegments",
    "xray:PutTelemetryRecords",
    "xray:GetSamplingRules",
    "xray:GetSamplingTargets"
  ],
  "Resource": "*"
}
```

Without these, the OTEL collector in the AgentCore runtime cannot export traces to XRay, and the evaluation system will find "No spans" for any session.

### Lambda Role (`agentis-lambda-role`)

The eval-packager and prd-submitter Lambdas need:

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject",
    "s3:PutObject"
  ],
  "Resource": [
    "arn:aws:s3:::agentis-artifacts-{ACCOUNT_ID}/*"
  ]
},
{
  "Effect": "Allow",
  "Action": "bedrock-agentcore:InvokeAgentRuntime",
  "Resource": "arn:aws:bedrock-agentcore:*:*:runtime/agentis_fleet_improver*"
}
```

### XRay Indexing

XRay Transaction Search must be set to 100% indexing (not just sampling):

```bash
aws xray update-indexing-rule --name "Default" \
  --rule '{"Probabilistic": {"DesiredSamplingPercentage": 100}}'
```

The `deploy-all.sh` script sets this automatically.

## Verification

After deployment, verify the full chain:

```bash
./verify.sh
```

This invokes an agent, waits for the span to appear in `aws/spans`, and confirms the online eval system can evaluate it.

## Toggling the Loop On/Off

The UI provides a toggle on the Evaluations page. Under the hood, this sets the eval-packager Lambda's reserved concurrency to 0 (off) or removes it (on):

- **Off**: `aws lambda put-function-concurrency --function-name agentis-eval-packager --reserved-concurrent-executions 0`
- **On**: `aws lambda delete-function-concurrency --function-name agentis-eval-packager`

When off, eval results still accumulate in CloudWatch Logs but aren't processed. Turning it back on resumes processing.

## Evaluators

Each agent is evaluated by 8 built-in evaluators:

| Evaluator | What It Measures |
|-----------|-----------------|
| ToolSelectionAccuracy | Did the agent pick the right tool? |
| ToolParameterAccuracy | Were tool arguments correct? |
| InstructionFollowing | Did it follow system prompt instructions? |
| GoalSuccessRate | Did it accomplish the stated goal? |
| Correctness | Is the output factually correct? |
| Coherence | Is the response logically coherent? |
| Faithfulness | Does it stay true to source material? |
| Helpfulness | How useful is the response? |

**Note:** `Builtin.TrajectoryInOrderMatch` cannot be used in online evaluation — it requires reference inputs and only supports on-demand evaluation. Custom evaluators (e.g., `dependency_chain_compliance`) can be added once created via `agentcore eval evaluator create`.

## Troubleshooting

### Evals show "No spans found"

**Cause:** Traces aren't reaching XRay.

1. Check XRay permissions on the agent runtime role:
   ```bash
   aws iam get-role-policy --role-name agentis-agentcore-role --policy-name agentcore-permissions \
     | grep -A2 xray
   ```
   If missing, add the XRay statement (see IAM section above).

2. Check XRay indexing is at 100%:
   ```bash
   aws xray get-indexing-rules
   ```

3. Verify spans appear after an invocation:
   ```bash
   # Invoke an agent, wait 60s, then:
   aws logs filter-log-events --log-group-name "aws/spans" \
     --start-time $(python3 -c "import time; print(int((time.time()-120)*1000))") \
     --query 'events | length(@)'
   ```

### Eval-packager not firing

**Cause:** Subscription filter isn't connected, or Lambda concurrency is 0.

```bash
# Check concurrency (0 = off)
aws lambda get-function-concurrency --function-name agentis-eval-packager

# Check subscription filter exists
aws logs describe-subscription-filters \
  --log-group-name "/aws/bedrock-agentcore/evaluations/results/eval_qa_verifier-P4T5vs6w6Y"
```

### PRD-submitter can't reach workflow API

**Cause:** `WORKFLOW_API_URL` env var is stale (App Runner URL changed after redeploy).

```bash
# Check current value
aws lambda get-function-configuration --function-name agentis-prd-submitter \
  --query 'Environment.Variables.WORKFLOW_API_URL'

# Update to current App Runner URL
aws lambda update-function-configuration --function-name agentis-prd-submitter \
  --environment "Variables={ARTIFACT_BUCKET=...,WORKFLOW_API_URL=https://NEW-URL.awsapprunner.com,FLEET_REPO_URL=...}"
```

### S3 AccessDenied on prompts

**Cause:** Agent role's S3 policy references the old bucket name.

The bucket is `agentis-artifacts-{ACCOUNT_ID}` (with region suffix). Update the IAM policy's S3 Resource ARN.

### Evaluations running but no workflow created

The fleet improver agent may decide no action is needed (scores are acceptable). Check its output:

```bash
aws s3 ls s3://${ARTIFACT_BUCKET}/fleet-imp-agent/ --recursive
```

If packages exist but no PRDs, the agent determined the scores were fine.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        AgentCore Runtime Platform                         │
│                                                                          │
│  ┌─────────────┐   OTEL    ┌──────┐   Index    ┌───────────┐           │
│  │ Agent Fleet │──traces──→│ XRay │──────────→│ aws/spans │           │
│  │ (14 agents) │           └──────┘            └─────┬─────┘           │
│  └─────────────┘                                     │                  │
│                                                      │ query            │
│  ┌─────────────────────┐                    ┌────────┴────────┐        │
│  │ Online Eval Configs  │───schedules───→│ Evaluation Engine │        │
│  │ (14 configs, 100%)   │                    └────────┬────────┘        │
│  └─────────────────────┘                             │                  │
│                                                      │ results          │
│                                              ┌───────┴───────┐          │
│                                              │ CW Logs (eval) │          │
│                                              └───────┬───────┘          │
└──────────────────────────────────────────────────────┼──────────────────┘
                                                       │
                         ┌─────────────────────────────┘
                         │ Subscription Filter
                         ▼
               ┌──────────────────┐        ┌─────────────────────┐
               │ eval-packager λ  │──────→│ fleet_improver agent │
               │ (parse + package)│        │ (root-cause → PRD)   │
               └──────────────────┘        └──────────┬──────────┘
                                                      │ S3 PutObject
                                                      ▼
                                           ┌──────────────────┐
                                           │ fleet-imp-agent/  │
                                           │ prd/*.json        │
                                           └────────┬─────────┘
                                                    │ EventBridge
                                                    ▼
                                           ┌──────────────────┐
                                           │ prd-submitter λ   │
                                           │ → Workflow API     │
                                           └────────┬─────────┘
                                                    │
                                                    ▼
                                           ┌──────────────────┐
                                           │ [SI] Workflow Run │
                                           │ (14 agents → PR)  │
                                           └──────────────────┘
```

## File Structure

```
deploy/
├── continuous-improvement/
│   ├── README.md           ← this file
│   ├── deploy-all.sh       ← one-command deploy (evals + lambdas + wiring)
│   ├── deploy.sh           ← SI infrastructure only (lambdas + subscriptions)
│   └── verify.sh           ← post-deploy validation
├── evaluations/
│   ├── setup-evaluations.sh         ← creates 14 online eval configs
│   ├── eval-config-ids.json         ← config registry
│   └── dependency_chain_evaluator.json  ← custom evaluator definition
└── config.sh               ← central env config (sourced by all scripts)

lambda/
├── eval-packager/
│   └── index.mjs           ← parses eval results, invokes fleet improver
└── prd-submitter/
    └── index.mjs           ← reads PRD from S3, submits to workflow API
```
