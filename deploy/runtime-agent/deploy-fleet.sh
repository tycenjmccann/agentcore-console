#!/bin/bash
#
# deploy-fleet.sh — Deploy 14 Strands agents to AgentCore Runtime (direct_code_deploy)
#
# Each agent uses the same main.py but gets its own Runtime resource with a unique
# SYSTEM_PROMPT env var baked in from deploy/runtime-agent/prompts/{agent_name}.txt.
# The orchestrator is dumb — it only passes task context (ticket description).
#
# Prerequisites:
#   pip install "bedrock-agentcore-starter-toolkit>=0.1.21" strands-agents boto3
#   AWS credentials configured
#
# Usage:
#   ./deploy-fleet.sh [--region us-east-1] [--role-arn arn:aws:iam::ACCOUNT:role/X]
#

set -e

# Source project env vars (GITHUB_PAT, etc.) so agents get MCP access
ENV_FILE="$(cd "$(dirname "$0")/../.." && pwd)/.env.local"
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
  echo "Loaded env from $ENV_FILE"
fi

REGION="${AWS_REGION:-us-east-1}"

# Create runtime role if not already set
if [ -z "${AGENTCORE_ROLE_ARN:-}" ]; then
  echo "AGENTCORE_ROLE_ARN not set — creating runtime role..."
  echo ""
  source "$SCRIPT_DIR/../setup-runtime-role.sh"
  echo ""
fi

ROLE_ARN="${AGENTCORE_ROLE_ARN}"
GATEWAY_ARN="${GATEWAY_ARN:-}"  # Optional: only needed for routing demo agents
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
echo "  Deploying Agentis Fleet — 14 Strands Agents on Runtime"
echo "═══════════════════════════════════════════════════════════════"
echo "  Region:      $REGION"
echo "  Role ARN:    $ROLE_ARN"
echo "  Gateway ARN: $GATEWAY_ARN"
echo "  Model:       $MODEL_ID"
echo "  Source:      $BASE_DIR/main.py"
echo "  Deploy Type: direct_code_deploy (CodeZip, no Docker)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# All 14 agents — same code, different runtime name + system prompt
AGENTS=(
  "agentis_requirements_analyst"
  "agentis_frontend_designer"
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

# Write back deployed ARNs and harnessNames to agents.json
AGENTS_JSON="$SCRIPT_DIR/../../src/config/agents.json"
if [ -f "$AGENTS_JSON" ]; then
  echo ""
  echo "Updating agents.json with deployed runtime ARNs..."
  python3 -c "
import json, sys

with open('$RESULTS_FILE') as f:
    deployed = json.load(f)

with open('$AGENTS_JSON') as f:
    config = json.load(f)

updated = 0
for agent in config['agents']:
    # Map agent id to deployed runtime name (team-foo-bar → agentis_foo_bar)
    runtime_name = 'agentis_' + agent['id'].replace('team-', '').replace('-', '_')
    if runtime_name in deployed:
        agent['harnessName'] = runtime_name
        agent['runtimeArn'] = deployed[runtime_name]
        updated += 1

with open('$AGENTS_JSON', 'w') as f:
    json.dump(config, f, indent=2)
    f.write('\n')

print(f'  ✓ Updated {updated}/{len(config[\"agents\"])} agents in agents.json')
"
fi

echo ""
echo "Running post-deploy health check..."
"$SCRIPT_DIR/verify-fleet.sh"
