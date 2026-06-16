#!/bin/bash
# Deploy the Claude Code Runtime to AgentCore
#
# This creates a single runtime named "claude-code-worker" with persistent
# session storage. The Strands agents invoke this runtime for all coding work.
#
# Usage: ./deploy.sh [--image-tag latest]

set -e

RUNTIME_NAME="claude-code-worker"
ROLE_ARN="arn:aws:iam::023392223961:role/csharness_cssonnet"
REGION="us-east-1"
ECR_REGISTRY="023392223961.dkr.ecr.us-east-1.amazonaws.com"
IMAGE_NAME="claude-code-runtime"
IMAGE_TAG="${1:-latest}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Source project env vars (GITHUB_PAT for MCP access)
ENV_FILE="$SCRIPT_DIR/../../.env.local"
[ -f "$ENV_FILE" ] && set -a && source "$ENV_FILE" && set +a

# Build MCP env args
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
cp "$SCRIPT_DIR/otel-collector-config.yaml" "$DEPLOY_DIR/"
cd "$DEPLOY_DIR"

echo "═══════════════════════════════════════════════════════════════"
echo "  Deploying Claude Code Runtime"
echo "═══════════════════════════════════════════════════════════════"
echo "  Runtime:     $RUNTIME_NAME"
echo "  Region:      $REGION"
echo "  Image:       $ECR_REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
echo "  Storage:     /mnt/workspace (persistent session storage)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Configure as container deployment with session storage
agentcore configure \
  -e main.py \
  -n "$RUNTIME_NAME" \
  -er "$ROLE_ARN" \
  -r "$REGION" \
  -dt container \
  --idle-timeout 1800 \
  --max-lifetime 7200 \
  --disable-memory \
  --non-interactive > /dev/null 2>&1

echo "Deploying $RUNTIME_NAME..."

OUTPUT=$(agentcore deploy \
  --local-build \
  --auto-update-on-conflict \
  --env "AWS_REGION=us-east-1" \
  --env "CLAUDE_CODE_USE_BEDROCK=1" \
  --env "CLAUDE_CODE_ENABLE_TELEMETRY=1" \
  --env "CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1" \
  --env "OTEL_LOG_TOOL_DETAILS=1" \
  --env "CLAUDE_MODEL=us.anthropic.claude-opus-4-6-v1" \
  --env "ANTHROPIC_MODEL=us.anthropic.claude-opus-4-6-v1" \
  --env "MAX_TURNS=50" \
  --env "CLAUDE_TIMEOUT=900" \
  --env "PLAYWRIGHT_BROWSERS_PATH=/mnt/workspace/.pw-browsers" \
  --env "HOME=/mnt/workspace" \
  ${MCP_ENV} 2>&1)
DEPLOY_EXIT=$?

if [ $DEPLOY_EXIT -ne 0 ]; then
  if echo "$OUTPUT" | grep -qi "error\|failed\|exception"; then
    echo "FAIL (deploy error, exit=$DEPLOY_EXIT)"
    echo "$OUTPUT" | tail -10 >&2
    rm -rf "$DEPLOY_DIR"
    exit 1
  fi
fi

# Verify and extract ARN
STATUS_OUTPUT=$(agentcore status 2>&1)
if echo "$STATUS_OUTPUT" | grep -q "READY\|CREATE_COMPLETE\|UPDATE_COMPLETE"; then
  ARN=$(echo "$OUTPUT" | grep -o 'arn:aws:bedrock-agentcore:[^"]*runtime/[^"[:space:]]*' | head -1)
  if [ -z "$ARN" ]; then
    ARN=$(echo "$STATUS_OUTPUT" | grep -o 'arn:aws:bedrock-agentcore:[^"]*runtime/[^"[:space:]]*' | head -1)
  fi
  echo ""
  echo "OK $RUNTIME_NAME deployed"
  echo "ARN: ${ARN:-unknown}"
  echo ""
  echo "Add this to your orchestrator environment:"
  echo "  CLAUDE_CODE_RUNTIME_ARN=${ARN}"
else
  echo "FAIL (status check failed)"
  echo "$OUTPUT" | tail -10 >&2
fi

rm -rf "$DEPLOY_DIR"
