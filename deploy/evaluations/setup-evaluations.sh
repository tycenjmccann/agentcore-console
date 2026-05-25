#!/bin/bash
# Set up AgentCore Online Evaluations for all fleet agents
# Uses 8 built-in evaluators, 100% sampling
#
# NOTE: Builtin.TrajectoryInOrderMatch CANNOT be used in online evaluation
# (requires reference inputs — on-demand only). We use 8 built-in evaluators.
#
# Agent IDs are read dynamically from fleet-runtime-ids.json rather than
# hardcoded, so this script works after any redeployment.

set -e
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "${REPO_ROOT}/deploy/config.sh"

FLEET_FILE="${REPO_ROOT}/deploy/runtime-agent/fleet-runtime-ids.json"

if [ ! -f "$FLEET_FILE" ]; then
  echo "ERROR: Fleet runtime IDs file not found: $FLEET_FILE"
  echo "Run deploy-fleet.sh first to deploy the agent fleet."
  exit 1
fi

# Read agent names and runtime IDs from fleet file
echo "Reading agent IDs from: $FLEET_FILE"
echo ""

AGENTS=$(python3 -c "
import json
with open('$FLEET_FILE') as f:
    data = json.load(f)
for name, arn in data.items():
    rid = arn.split('/')[-1]
    print(f'{name} {rid}')
")

AGENT_COUNT=$(echo "$AGENTS" | wc -l | tr -d ' ')
echo "Creating online evaluation configs for ${AGENT_COUNT} agents..."
echo "Evaluators: 8 built-in (ToolSelectionAccuracy, ToolParameterAccuracy,"
echo "  InstructionFollowing, GoalSuccessRate, Correctness, Coherence,"
echo "  Faithfulness, Helpfulness)"
echo "Sampling: 100%"
echo ""

echo "$AGENTS" | while read name agent_id; do
  config_name="eval_${name}"

  echo "→ Creating config for ${name} (${agent_id})..."

  agentcore eval online create \
    --agent-id "${agent_id}" \
    --name "${config_name}" \
    --sampling-rate 100.0 \
    -e "Builtin.ToolSelectionAccuracy" \
    -e "Builtin.ToolParameterAccuracy" \
    -e "Builtin.InstructionFollowing" \
    -e "Builtin.GoalSuccessRate" \
    -e "Builtin.Correctness" \
    -e "Builtin.Coherence" \
    -e "Builtin.Faithfulness" \
    -e "Builtin.Helpfulness" \
    --description "Full evaluation suite for ${name} - 100% sampling" \
    2>&1 | grep -E "(✓|Config ID|Status|Error)" || true

  echo ""
done

echo "Done! Listing all configs:"
agentcore eval online list
