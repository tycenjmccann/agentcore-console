#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Deploy the entire Continuous Improvement (Self-Improvement) Loop
#
# This is the ONE command to set up everything:
#   1. XRay indexing (100% — required for evals to find spans)
#   2. Online evaluation configs (14 agents × 10 evaluators)
#   3. Lambda functions (eval-packager, prd-submitter)
#   4. CW Logs subscription filters (eval results → packager)
#   5. EventBridge rule (S3 PRD → submitter)
#   6. Prompt sync to S3
#   7. Verification
#
# Prerequisites:
#   - Agent fleet deployed (deploy/runtime-agent/deploy-fleet.sh)
#   - App Runner service running (DEPLOYMENT_URL set)
#   - agentcore CLI installed
#
# Usage:
#   export AWS_PROFILE=your-profile
#   export DEPLOYMENT_URL=https://xxxxx.us-east-1.awsapprunner.com
#   ./deploy-all.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${REPO_ROOT}/deploy/config.sh"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  Continuous Improvement Loop — Full Deploy                    ║"
echo "║  Account: ${ACCOUNT_ID}                                       ║"
echo "║  Region:  ${AWS_REGION}                                       ║"
echo "║  Bucket:  ${ARTIFACT_BUCKET}                                  ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# ─── Step 1: XRay Indexing ───────────────────────────────────────────────────
echo "┌─ Step 1/7: XRay Indexing ──────────────────────────────────────────────┐"

CURRENT_RATE=$(aws xray get-indexing-rules --region "$AWS_REGION" \
  --query 'IndexingRules[0].Rule.Probabilistic.DesiredSamplingPercentage' --output text 2>/dev/null || echo "0")

if [ "$CURRENT_RATE" != "100.0" ] && [ "$CURRENT_RATE" != "100" ]; then
  aws xray update-indexing-rule --name "Default" \
    --rule '{"Probabilistic": {"DesiredSamplingPercentage": 100}}' \
    --region "$AWS_REGION" --output text >/dev/null
  echo "  ✓ XRay indexing set to 100% (was ${CURRENT_RATE}%)"
else
  echo "  ✓ XRay indexing already at 100%"
fi

# ─── Step 2: XRay IAM Permissions ───────────────────────────────────────────
echo "├─ Step 2/7: IAM XRay Permissions ───────────────────────────────────────┤"

ROLE_NAME="agentis-agentcore-role"
POLICY_NAME="agentcore-permissions"

# Check if xray permissions exist
HAS_XRAY=$(aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name "$POLICY_NAME" \
  --query 'PolicyDocument.Statement[?contains(to_string(Action), `xray`)]' --output text 2>/dev/null || echo "")

if [ -z "$HAS_XRAY" ]; then
  # Get current policy and add XRay
  CURRENT_POLICY=$(aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name "$POLICY_NAME" \
    --query 'PolicyDocument' --output json 2>/dev/null)

  if [ -n "$CURRENT_POLICY" ]; then
    UPDATED_POLICY=$(echo "$CURRENT_POLICY" | python3 -c "
import sys, json
doc = json.load(sys.stdin)
# Check if xray statement already exists
has_xray = any('xray' in str(s.get('Action','')) for s in doc.get('Statement', []))
if not has_xray:
    doc['Statement'].append({
        'Effect': 'Allow',
        'Action': ['xray:PutTraceSegments','xray:PutTelemetryRecords','xray:GetSamplingRules','xray:GetSamplingTargets'],
        'Resource': '*'
    })
print(json.dumps(doc))
")
    echo "$UPDATED_POLICY" > /tmp/agentcore-policy-with-xray.json
    aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name "$POLICY_NAME" \
      --policy-document file:///tmp/agentcore-policy-with-xray.json
    rm -f /tmp/agentcore-policy-with-xray.json
    echo "  ✓ Added XRay permissions to ${ROLE_NAME}"
  else
    echo "  ⚠ Could not read ${ROLE_NAME} policy — add XRay permissions manually (see README.md)"
  fi
else
  echo "  ✓ XRay permissions already present on ${ROLE_NAME}"
fi

# ─── Step 3: Online Evaluation Configs ───────────────────────────────────────
echo "├─ Step 3/7: Online Evaluation Configs ──────────────────────────────────┤"

# Check if configs already exist
EXISTING_CONFIGS=$(AWS_REGION="$AWS_REGION" agentcore eval online list 2>&1 | grep -c "ACTIVE" || true)

if [ "$EXISTING_CONFIGS" -ge 14 ]; then
  echo "  ✓ All 14 eval configs already exist (${EXISTING_CONFIGS} ACTIVE)"
else
  echo "  Creating evaluation configs (${EXISTING_CONFIGS}/14 exist)..."
  bash "${REPO_ROOT}/deploy/evaluations/setup-evaluations.sh" 2>&1 | grep -E "^(→|Done)" | head -20
  echo "  ✓ Evaluation configs created"
fi

# ─── Step 4: Lambdas ────────────────────────────────────────────────────────
echo "├─ Step 4/7: Lambda Functions ───────────────────────────────────────────┤"

BUCKET="$ARTIFACT_BUCKET"
ROLE_ARN="$LAMBDA_ROLE_ARN"
AGENT_ID="${IMPROVEMENT_AGENT_ID:-agentis_fleet_improver-k5W5Vb9GhE}"
WORKFLOW_API="${DEPLOYMENT_URL:?ERROR: DEPLOYMENT_URL must be set (App Runner URL)}"
FLEET_REPO="${FLEET_REPO_URL}"

deploy_lambda() {
  local NAME=$1 DIR=$2 TIMEOUT=$3 MEM=$4 ENV_VARS=$5
  cd "${REPO_ROOT}/lambda/${DIR}" && rm -f function.zip && zip -q function.zip index.mjs
  if aws lambda get-function --function-name "agentis-${NAME}" --region "$AWS_REGION" 2>/dev/null >/dev/null; then
    aws lambda update-function-code --function-name "agentis-${NAME}" \
      --zip-file fileb://function.zip --region "$AWS_REGION" --output text 2>/dev/null >/dev/null
    # Update env vars too
    aws lambda update-function-configuration --function-name "agentis-${NAME}" \
      --environment "Variables=${ENV_VARS}" --region "$AWS_REGION" --output text 2>/dev/null >/dev/null
    echo "  ✓ agentis-${NAME} (updated)"
  else
    aws lambda create-function \
      --function-name "agentis-${NAME}" --runtime nodejs20.x --handler index.handler \
      --role "$ROLE_ARN" --zip-file fileb://function.zip \
      --timeout "$TIMEOUT" --memory-size "$MEM" \
      --environment "Variables=${ENV_VARS}" \
      --region "$AWS_REGION" --output text 2>/dev/null >/dev/null
    echo "  ✓ agentis-${NAME} (created)"
  fi
  rm -f function.zip
}

deploy_lambda "eval-packager" "eval-packager" 300 512 \
  "{ARTIFACT_BUCKET=${BUCKET},IMPROVEMENT_AGENT_ID=${AGENT_ID},AWS_ACCOUNT_ID=${ACCOUNT_ID}}"

deploy_lambda "prd-submitter" "prd-submitter" 30 256 \
  "{ARTIFACT_BUCKET=${BUCKET},WORKFLOW_API_URL=${WORKFLOW_API},FLEET_REPO_URL=${FLEET_REPO}}"

# ─── Step 5: CW Logs Subscription Filters ───────────────────────────────────
echo "├─ Step 5/7: Subscription Filters ───────────────────────────────────────┤"

PACKAGER_ARN="arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:agentis-eval-packager"

# Grant CW Logs permission to invoke packager (idempotent)
aws lambda add-permission \
  --function-name agentis-eval-packager --statement-id cw-logs-invoke \
  --action lambda:InvokeFunction --principal "logs.${AWS_REGION}.amazonaws.com" \
  --source-account "$ACCOUNT_ID" --region "$AWS_REGION" --output text 2>/dev/null || true

# Create subscription filters on all eval result log groups
FILTER_COUNT=0
for LG in $(aws logs describe-log-groups \
  --log-group-name-prefix /aws/bedrock-agentcore/evaluations/results/ \
  --query 'logGroups[].logGroupName' --output text --region "$AWS_REGION"); do
  aws logs put-subscription-filter \
    --log-group-name "$LG" --filter-name "eval-to-packager" \
    --filter-pattern "" --destination-arn "$PACKAGER_ARN" \
    --region "$AWS_REGION" 2>/dev/null || true
  FILTER_COUNT=$((FILTER_COUNT + 1))
done
echo "  ✓ ${FILTER_COUNT} subscription filters → eval-packager"

# ─── Step 6: EventBridge Rule ────────────────────────────────────────────────
echo "├─ Step 6/7: EventBridge Rule (S3 → PRD Submitter) ─────────────────────┤"

SUBMITTER_ARN="arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:agentis-prd-submitter"

# Ensure S3 has EventBridge notifications enabled
aws s3api put-bucket-notification-configuration \
  --bucket "$BUCKET" --notification-configuration '{"EventBridgeConfiguration":{}}' \
  --region "$AWS_REGION" 2>/dev/null || true

aws events put-rule \
  --name "agentis-prd-submitter-trigger" \
  --event-pattern "{\"source\":[\"aws.s3\"],\"detail-type\":[\"Object Created\"],\"detail\":{\"bucket\":{\"name\":[\"${BUCKET}\"]},\"object\":{\"key\":[{\"prefix\":\"fleet-imp-agent/prd/\"}]}}}" \
  --state ENABLED --region "$AWS_REGION" --output text 2>/dev/null >/dev/null

aws events put-targets --rule "agentis-prd-submitter-trigger" \
  --targets "Id=prd-submitter,Arn=${SUBMITTER_ARN}" \
  --region "$AWS_REGION" --output text 2>/dev/null >/dev/null

aws lambda add-permission \
  --function-name agentis-prd-submitter --statement-id prd-s3-trigger \
  --action lambda:InvokeFunction --principal events.amazonaws.com \
  --source-arn "arn:aws:events:${AWS_REGION}:${ACCOUNT_ID}:rule/agentis-prd-submitter-trigger" \
  --region "$AWS_REGION" --output text 2>/dev/null || true

echo "  ✓ EventBridge: s3://${BUCKET}/fleet-imp-agent/prd/ → prd-submitter"

# ─── Step 7: Sync Prompts ────────────────────────────────────────────────────
echo "├─ Step 7/7: Sync Prompts to S3 ────────────────────────────────────────┤"

PROMPT_COUNT=0
for f in "${REPO_ROOT}/deploy/runtime-agent/prompts/agentis_"*.txt; do
  aws s3 cp "$f" "s3://${BUCKET}/prompts/$(basename "$f")" --quiet --region "$AWS_REGION"
  PROMPT_COUNT=$((PROMPT_COUNT + 1))
done
echo "  ✓ ${PROMPT_COUNT} prompts synced to s3://${BUCKET}/prompts/"

# ─── Summary ────────────────────────────────────────────────────────────────
echo "└──────────────────────────────────────────────────────────────────────────┘"
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  ✓ Continuous Improvement Loop Deployed                       ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║                                                               ║"
echo "║  XRay indexing:     100%                                      ║"
echo "║  Eval configs:      14 agents × 10 evaluators                ║"
echo "║  Subscription:      eval results → eval-packager              ║"
echo "║  EventBridge:       S3 PRD → prd-submitter → Workflow API     ║"
echo "║  Workflow API:      ${WORKFLOW_API}  ║"
echo "║                                                               ║"
echo "║  Next: Run ./verify.sh to confirm end-to-end flow             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
