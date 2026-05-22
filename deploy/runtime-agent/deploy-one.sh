#!/bin/bash
# Deploy a single agent to AgentCore Runtime
# Usage: ./deploy-one.sh <agent_name>

AGENT_NAME=$1
ROLE_ARN="arn:aws:iam::023392223961:role/csharness_cssonnet"
REGION="us-east-1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Source project env vars if not already set (GITHUB_PAT for MCP access)
if [ -z "${GITHUB_PAT:-}" ]; then
  ENV_FILE="$SCRIPT_DIR/../../.env.local"
  [ -f "$ENV_FILE" ] && set -a && source "$ENV_FILE" && set +a
fi

DEPLOY_DIR=$(mktemp -d)
cp "$SCRIPT_DIR/main.py" "$DEPLOY_DIR/"
cp "$SCRIPT_DIR/requirements.txt" "$DEPLOY_DIR/"
cd "$DEPLOY_DIR"

agentcore configure \
  -e main.py \
  -n "$AGENT_NAME" \
  -er "$ROLE_ARN" \
  -rf requirements.txt \
  -r "$REGION" \
  -dt direct_code_deploy \
  --runtime PYTHON_3_10 \
  --idle-timeout 3600 \
  --max-lifetime 3600 \
  --disable-memory \
  --non-interactive > /dev/null 2>&1

# Load agent-specific system prompt — upload to S3 if too large for env var (4000 byte limit)
PROMPT_FILE="$SCRIPT_DIR/prompts/${AGENT_NAME}.txt"
if [ ! -f "$PROMPT_FILE" ]; then
  echo "FAIL $AGENT_NAME (no prompt file: $PROMPT_FILE)"
  exit 1
fi

ARTIFACT_BUCKET="agentcore-artifacts-023392223961-us-east-1"
PROMPT_SIZE=$(wc -c < "$PROMPT_FILE")
PROMPT_S3_KEY=""

# Always upload to S3 — inline env vars break on special chars in prompts
PROMPT_S3_KEY="prompts/${AGENT_NAME}.txt"
aws s3 cp "$PROMPT_FILE" "s3://${ARTIFACT_BUCKET}/${PROMPT_S3_KEY}" --region "$REGION" > /dev/null 2>&1

# Build env args — MCP_SERVERS takes priority, GITHUB_PAT is legacy shorthand
MCP_ENV=""
if [ -n "${MCP_SERVERS:-}" ]; then
  MCP_ENV="--env MCP_SERVERS=${MCP_SERVERS}"
elif [ -n "${GITHUB_PAT:-}" ]; then
  MCP_ENV="--env GITHUB_PAT=${GITHUB_PAT}"
fi

# Build prompt env args — always S3
PROMPT_ENV="--env SYSTEM_PROMPT_S3_KEY=${PROMPT_S3_KEY}"

OUTPUT=$(agentcore deploy \
  --auto-update-on-conflict \
  --env "BYPASS_TOOL_CONSENT=true" \
  --env "GATEWAY_ARN=arn:aws:bedrock-agentcore:us-east-1:023392223961:gateway/datesparkiamgw-vjme4fyj6k" \
  --env "MODEL_ID=us.anthropic.claude-opus-4-6-v1" \
  --env "READ_TIMEOUT=600" \
  --env "AWS_REGION=us-east-1" \
  --env "EVENTS_TABLE=agentis-events" \
  --env "JIRA_TOOLS_LAMBDA=agentis-jira-real" \
  --env "ARTIFACT_BUCKET=agentcore-artifacts-023392223961-us-east-1" \
  --env "CLAUDE_CODE_USE_BEDROCK=1" \
  --env "CLAUDE_MODEL=us.anthropic.claude-opus-4-6-v1" \
  --env "ANTHROPIC_MODEL=us.anthropic.claude-opus-4-6-v1" \
  --env "PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers" \
  --env "HOME=/tmp" \
  --env "TMPDIR=/tmp" \
  ${PROMPT_ENV} \
  ${MCP_ENV} 2>&1)
DEPLOY_EXIT=$?

# Check deploy exit code first, then verify via agentcore status
if [ $DEPLOY_EXIT -ne 0 ]; then
  # Check if it's a real error or just a non-zero exit with successful update
  if echo "$OUTPUT" | grep -qi "error\|failed\|exception"; then
    echo "FAIL $AGENT_NAME (deploy error, exit=$DEPLOY_EXIT)"
    echo "$OUTPUT" | grep -i "error\|fail\|Exception" | tail -5 >&2
    rm -rf "$DEPLOY_DIR"
    exit 1
  fi
fi

# Verify deployment via status (reliable regardless of deploy output format)
STATUS_OUTPUT=$(agentcore status 2>&1)
if echo "$STATUS_OUTPUT" | grep -q "READY\|CREATE_COMPLETE\|UPDATE_COMPLETE"; then
  # Try to extract ARN from status or deploy output
  ARN=$(echo "$OUTPUT" | grep -o 'arn:aws:bedrock-agentcore:[^"]*runtime/[^"[:space:]]*' | head -1)
  if [ -z "$ARN" ]; then
    ARN=$(echo "$STATUS_OUTPUT" | grep -o 'arn:aws:bedrock-agentcore:[^"]*runtime/[^"[:space:]]*' | head -1)
  fi
  echo "OK $AGENT_NAME ${ARN:-deployed}"
else
  echo "FAIL $AGENT_NAME (status check failed)"
  echo "$OUTPUT" | tail -5 >&2
fi

rm -rf "$DEPLOY_DIR"
