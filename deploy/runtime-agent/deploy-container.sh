#!/bin/bash
# Deploy an agent to AgentCore Runtime using a pre-built container image
# Usage: ./deploy-container.sh <agent_name> [image_tag]
#
# This uses --local-build mode with our pre-built ECR image.
# The container has Node.js, Claude Code CLI, and Playwright pre-installed.

AGENT_NAME=$1
IMAGE_TAG="${2:-latest}"
ROLE_ARN="arn:aws:iam::023392223961:role/csharness_cssonnet"
REGION="us-east-1"
ECR_REGISTRY="023392223961.dkr.ecr.us-east-1.amazonaws.com"
ECR_IMAGE="${ECR_REGISTRY}/runtime-agent:${IMAGE_TAG}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -z "$AGENT_NAME" ]; then
  echo "Usage: ./deploy-container.sh <agent_name> [image_tag]"
  exit 1
fi

# Source project env vars
if [ -z "${GITHUB_PAT:-}" ]; then
  ENV_FILE="$SCRIPT_DIR/../../.env.local"
  [ -f "$ENV_FILE" ] && set -a && source "$ENV_FILE" && set +a
fi

# Load agent-specific system prompt
PROMPT_FILE="$SCRIPT_DIR/prompts/${AGENT_NAME}.txt"
if [ ! -f "$PROMPT_FILE" ]; then
  echo "FAIL $AGENT_NAME (no prompt file: $PROMPT_FILE)"
  exit 1
fi
SYSTEM_PROMPT=$(cat "$PROMPT_FILE")

# Build env args
MCP_ENV=""
if [ -n "${MCP_SERVERS:-}" ]; then
  MCP_ENV="--env MCP_SERVERS=${MCP_SERVERS}"
elif [ -n "${GITHUB_PAT:-}" ]; then
  MCP_ENV="--env GITHUB_PAT=${GITHUB_PAT}"
fi

DEPLOY_DIR=$(mktemp -d)
cp "$SCRIPT_DIR/main.py" "$DEPLOY_DIR/"
cp "$SCRIPT_DIR/requirements.txt" "$DEPLOY_DIR/"
cp "$SCRIPT_DIR/Dockerfile" "$DEPLOY_DIR/"
cd "$DEPLOY_DIR"

# Configure as container deployment with our ECR image
agentcore configure \
  -e main.py \
  -n "$AGENT_NAME" \
  -er "$ROLE_ARN" \
  -ecr "$ECR_IMAGE" \
  -r "$REGION" \
  -dt container \
  --idle-timeout 900 \
  --max-lifetime 3600 \
  --disable-memory \
  --non-interactive > /dev/null 2>&1

echo "Deploying $AGENT_NAME as container (image: $ECR_IMAGE)..."

OUTPUT=$(agentcore deploy \
  --local-build \
  --auto-update-on-conflict \
  --env "BYPASS_TOOL_CONSENT=true" \
  --env "GATEWAY_ARN=arn:aws:bedrock-agentcore:us-east-1:023392223961:gateway/datesparkiamgw-vjme4fyj6k" \
  --env "MODEL_ID=us.anthropic.claude-opus-4-6-v1" \
  --env "READ_TIMEOUT=600" \
  --env "AWS_REGION=us-east-1" \
  --env "EVENTS_TABLE=agentis-events" \
  --env "JIRA_TOOLS_LAMBDA=datespark-jira-mcp" \
  --env "ARTIFACT_BUCKET=agentcore-artifacts-023392223961-us-east-1" \
  --env "SYSTEM_PROMPT=${SYSTEM_PROMPT}" \
  ${MCP_ENV} 2>&1)
DEPLOY_EXIT=$?

if [ $DEPLOY_EXIT -ne 0 ]; then
  if echo "$OUTPUT" | grep -qi "error\|failed\|exception"; then
    echo "FAIL $AGENT_NAME (deploy error, exit=$DEPLOY_EXIT)"
    echo "$OUTPUT" | tail -10 >&2
    rm -rf "$DEPLOY_DIR"
    exit 1
  fi
fi

# Verify
STATUS_OUTPUT=$(agentcore status 2>&1)
if echo "$STATUS_OUTPUT" | grep -q "READY\|CREATE_COMPLETE\|UPDATE_COMPLETE"; then
  ARN=$(echo "$OUTPUT" | grep -o 'arn:aws:bedrock-agentcore:[^"]*runtime/[^"[:space:]]*' | head -1)
  if [ -z "$ARN" ]; then
    ARN=$(echo "$STATUS_OUTPUT" | grep -o 'arn:aws:bedrock-agentcore:[^"]*runtime/[^"[:space:]]*' | head -1)
  fi
  echo "OK $AGENT_NAME ${ARN:-deployed} (container: $IMAGE_TAG)"
else
  echo "FAIL $AGENT_NAME (status check failed)"
  echo "$OUTPUT" | tail -10 >&2
fi

rm -rf "$DEPLOY_DIR"
