#!/bin/bash
#
# deploy-fleet.sh — Deploy 13 Strands agents to AgentCore Runtime (direct_code_deploy)
#
# Each agent uses the same main.py but gets its own Runtime resource.
# The orchestrator differentiates them at invocation time via payload
# (system_prompt, agent_id, etc.)
#
# Prerequisites:
#   pip install "bedrock-agentcore-starter-toolkit>=0.1.21" strands-agents boto3
#   AWS credentials configured
#
# Usage:
#   ./deploy-fleet.sh [--region us-east-1] [--role-arn arn:aws:iam::ACCOUNT:role/X]
#

set -e

REGION="${AWS_REGION:-us-east-1}"
ROLE_ARN="${ROLE_ARN:-arn:aws:iam::023392223961:role/csharness_cssonnet}"
GATEWAY_ARN="${GATEWAY_ARN:-arn:aws:bedrock-agentcore:us-east-1:023392223961:gateway/datesparkiamgw-vjme4fyj6k}"
MODEL_ID="us.anthropic.claude-opus-4-6-v1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_DIR="$SCRIPT_DIR"

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --region) REGION="$2"; shift 2 ;;
    --role-arn) ROLE_ARN="$2"; shift 2 ;;
    --gateway-arn) GATEWAY_ARN="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

echo "═══════════════════════════════════════════════════════════════"
echo "  Deploying Agentis Fleet — 13 Strands Agents on Runtime"
echo "═══════════════════════════════════════════════════════════════"
echo "  Region:      $REGION"
echo "  Role ARN:    $ROLE_ARN"
echo "  Gateway ARN: $GATEWAY_ARN"
echo "  Model:       $MODEL_ID"
echo "  Source:      $BASE_DIR/main.py"
echo "  Deploy Type: direct_code_deploy (CodeZip, no Docker)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# All 13 agents — same code, different runtime name
AGENTS=(
  "agentis_requirements_analyst"
  "agentis_ios_designer"
  "agentis_backend_designer"
  "agentis_android_designer"
  "agentis_security_reviewer"
  "agentis_legal_compliance"
  "agentis_localization"
  "agentis_analytics_designer"
  "agentis_backend_dev"
  "agentis_api_dev"
  "agentis_frontend_dev"
  "agentis_qa_verifier"
  "agentis_ci_agent"
)

RESULTS_FILE="$SCRIPT_DIR/fleet-runtime-ids.json"

# Deploy in parallel using deploy-one.sh helper
echo "Deploying ${#AGENTS[@]} agents (3 concurrent)..."
echo ""

printf '%s\n' "${AGENTS[@]}" | xargs -P 3 -I {} "$SCRIPT_DIR/deploy-one.sh" {} | tee /tmp/fleet-deploy-output.txt

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Fleet Deployment Results"
echo "═══════════════════════════════════════════════════════════════"

# Parse results into JSON
echo "{" > "$RESULTS_FILE"
FIRST=true
SUCCESS=0
FAIL=0

while IFS= read -r line; do
  if [[ "$line" == OK* ]]; then
    AGENT_NAME=$(echo "$line" | awk '{print $2}')
    ARN=$(echo "$line" | awk '{print $3}')
    if [ "$FIRST" = true ]; then
      FIRST=false
    else
      echo "," >> "$RESULTS_FILE"
    fi
    printf '  "%s": "%s"' "$AGENT_NAME" "$ARN" >> "$RESULTS_FILE"
    echo "  ✓ $AGENT_NAME → $ARN"
    SUCCESS=$((SUCCESS + 1))
  elif [[ "$line" == FAIL* ]]; then
    AGENT_NAME=$(echo "$line" | awk '{print $2}')
    echo "  ✗ $AGENT_NAME FAILED"
    FAIL=$((FAIL + 1))
  fi
done < /tmp/fleet-deploy-output.txt

echo "" >> "$RESULTS_FILE"
echo "}" >> "$RESULTS_FILE"

echo ""
echo "  ✓ Success: $SUCCESS / ${#AGENTS[@]}"
echo "  ✗ Failed:  $FAIL"
echo "  Results:   $RESULTS_FILE"
echo "═══════════════════════════════════════════════════════════════"

# Print env var format for orchestrator
echo ""
echo "Environment variables for orchestrator Lambda:"
echo "───────────────────────────────────────────────"
cat "$RESULTS_FILE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for name, arn in data.items():
    env_key = 'RUNTIME_ARN_' + name.upper()
    print(f'{env_key}={arn}')
"
