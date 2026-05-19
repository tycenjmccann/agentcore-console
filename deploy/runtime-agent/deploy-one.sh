#!/bin/bash
# Deploy a single agent to AgentCore Runtime
# Usage: ./deploy-one.sh <agent_name>

AGENT_NAME=$1
ROLE_ARN="arn:aws:iam::023392223961:role/csharness_cssonnet"
REGION="us-east-1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

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
  --idle-timeout 900 \
  --max-lifetime 3600 \
  --disable-memory \
  --non-interactive > /dev/null 2>&1

OUTPUT=$(agentcore deploy \
  --auto-update-on-conflict \
  --env "GATEWAY_ARN=arn:aws:bedrock-agentcore:us-east-1:023392223961:gateway/datesparkiamgw-vjme4fyj6k" \
  --env "MODEL_ID=us.anthropic.claude-opus-4-6-v1" \
  --env "READ_TIMEOUT=600" \
  --env "AWS_REGION=us-east-1" 2>&1)

ARN=$(echo "$OUTPUT" | grep -o 'arn:aws:bedrock-agentcore:[^"]*runtime/[^"[:space:]]*' | head -1)

if [ -n "$ARN" ]; then
  echo "OK $AGENT_NAME $ARN"
else
  echo "FAIL $AGENT_NAME"
  echo "$OUTPUT" | grep -i "error\|fail\|Exception" | tail -3 >&2
fi

rm -rf "$DEPLOY_DIR"
