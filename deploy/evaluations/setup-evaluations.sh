#!/bin/bash
# Set up AgentCore Online Evaluations for all fleet agents
# Uses Opus 4.7 as judge model, 100% sampling, 10 evaluators per config

set -e
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "${REPO_ROOT}/deploy/config.sh"

# 9 built-in + 1 custom = 10 (the max)
EVALUATORS=(
  "-e Builtin.ToolSelectionAccuracy"
  "-e Builtin.ToolParameterAccuracy"
  "-e Builtin.InstructionFollowing"
  "-e Builtin.GoalSuccessRate"
  "-e Builtin.Correctness"
  "-e Builtin.Coherence"
  "-e Builtin.Faithfulness"
  "-e Builtin.TrajectoryInOrderMatch"
  "-e Builtin.Helpfulness"
  "-e dependency_chain_compliance-VyBv7H2bCi"
)

EVAL_FLAGS="${EVALUATORS[*]}"

# All fleet agent runtime IDs
declare -A AGENTS=(
  [agentis_analytics_designer]="agentis_analytics_designer-nIfOVs3GEj"
  [agentis_android_designer]="agentis_android_designer-99sWXeFskP"
  [agentis_api_dev]="agentis_api_dev-6V6nFpBL3L"
  [agentis_backend_designer]="agentis_backend_designer-WcCbzyBZ4i"
  [agentis_backend_dev]="agentis_backend_dev-UKXih09TYL"
  [agentis_ci_agent]="agentis_ci_agent-tSCbVuA5eb"
  [agentis_frontend_designer]="agentis_frontend_designer-0F6gH873ZO"
  [agentis_frontend_dev]="agentis_frontend_dev-1YoJPW6ASF"
  [agentis_ios_designer]="agentis_ios_designer-GOLOXGG3h7"
  [agentis_legal_compliance]="agentis_legal_compliance-R3RnglAnOm"
  [agentis_localization]="agentis_localization-EI5eUWGmDJ"
  [agentis_qa_verifier]="agentis_qa_verifier-RZfbvN5e64"
  [agentis_requirements_analyst]="agentis_requirements_analyst-iUpYwC25KS"
  [agentis_security_reviewer]="agentis_security_reviewer-tmoEXEHFg9"
)

echo "Creating online evaluation configs for ${#AGENTS[@]} agents..."
echo "Evaluators: 9 built-in + 1 custom (dependency_chain_compliance)"
echo "Sampling: 100%"
echo "Judge model: Opus 4.7"
echo ""

for name in "${!AGENTS[@]}"; do
  agent_id="${AGENTS[$name]}"
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
    -e "Builtin.TrajectoryInOrderMatch" \
    -e "Builtin.Helpfulness" \
    -e "dependency_chain_compliance-VyBv7H2bCi" \
    --description "Full evaluation suite for ${name} - 100% sampling with Opus 4.7 judge" \
    2>&1 | grep -E "(✓|Config ID|Status|Error)" || true

  echo ""
done

echo "Done! Listing all configs:"
agentcore eval online list
