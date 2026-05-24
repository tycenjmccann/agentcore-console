#!/bin/bash
# Deploy the minimal test-streaming agent to AgentCore Runtime
set -e

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/agentis-agentcore-role"
AGENT_NAME="agentis_test_streaming"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$SCRIPT_DIR"

echo "Configuring $AGENT_NAME..."
agentcore configure \
  -e "main.py" \
  -n "$AGENT_NAME" \
  -er "$ROLE_ARN" \
  -rf requirements.txt \
  -r "$REGION" \
  -dt direct_code_deploy \
  --runtime PYTHON_3_10 \
  --idle-timeout 3600 \
  --max-lifetime 3600 \
  -ni \
  -s3 "bedrock-agentcore-codebuild-sources-${ACCOUNT_ID}-us-east-1"

echo "Deploying $AGENT_NAME..."
agentcore deploy \
  --auto-update-on-conflict \
  --env "BYPASS_TOOL_CONSENT=true" \
  --env "MODEL_ID=us.anthropic.claude-sonnet-4-20250514" \
  --env "AWS_REGION=us-east-1" \
  --env "EVENTS_TABLE=agentis-events" \
  --env "HOME=/tmp" \
  --env "TMPDIR=/tmp"

echo ""
echo "Checking status..."
agentcore status
