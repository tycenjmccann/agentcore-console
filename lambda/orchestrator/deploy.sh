#!/bin/bash
set -e

# ─── Agentis Orchestrator Deployment Script ──────────────────────────────────────
# Deploys the event-driven orchestration infrastructure:
# 1. Enables DynamoDB Streams on agentis-tickets table
# 2. Creates agentis-workflows and agentis-events tables
# 3. Deploys Orchestrator, Agent Invoker, and Events Writer Lambdas
# 4. Wires DynamoDB Stream → Orchestrator Lambda

REGION="${AWS_REGION:-us-east-1}"
TICKETS_TABLE="agentis-tickets"
WORKFLOWS_TABLE="agentis-workflows"
EVENTS_TABLE="agentis-events"
ARTIFACT_BUCKET="${TEAM_WORKFLOW_S3_BUCKET:-}"
GITHUB_LAMBDA="agentis-github-mcp"
ORCHESTRATOR_FUNCTION="agentis-orchestrator"
INVOKER_FUNCTION="agentis-agent-invoker"
EVENTS_WRITER_FUNCTION="agentis-events-writer"
ROLE_NAME="agentis-orchestrator-role"

echo "═══════════════════════════════════════════════════════"
echo "  Agentis Orchestrator — Event-Driven Deployment"
echo "═══════════════════════════════════════════════════════"
echo ""

# ─── Step 1: Enable DynamoDB Streams ────────────────────────────────────────────
echo "▶ Step 1: Enabling DynamoDB Streams on ${TICKETS_TABLE}..."
STREAM_ARN=$(aws dynamodb describe-table --table-name "$TICKETS_TABLE" --region "$REGION" \
  --query 'Table.LatestStreamArn' --output text 2>/dev/null || echo "None")

if [ "$STREAM_ARN" = "None" ] || [ -z "$STREAM_ARN" ]; then
  aws dynamodb update-table \
    --table-name "$TICKETS_TABLE" \
    --region "$REGION" \
    --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
    --no-cli-pager
  echo "  ✓ Streams enabled. Waiting for table to become ACTIVE..."
  aws dynamodb wait table-exists --table-name "$TICKETS_TABLE" --region "$REGION"
  STREAM_ARN=$(aws dynamodb describe-table --table-name "$TICKETS_TABLE" --region "$REGION" \
    --query 'Table.LatestStreamArn' --output text)
fi
echo "  ✓ Stream ARN: ${STREAM_ARN}"
echo ""

# ─── Step 2: Create Workflows Table ────────────────────────────────────────────
echo "▶ Step 2: Creating ${WORKFLOWS_TABLE} table..."
if ! aws dynamodb describe-table --table-name "$WORKFLOWS_TABLE" --region "$REGION" &>/dev/null; then
  aws dynamodb create-table \
    --table-name "$WORKFLOWS_TABLE" \
    --region "$REGION" \
    --attribute-definitions AttributeName=workflowId,AttributeType=S \
    --key-schema AttributeName=workflowId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --no-cli-pager
  aws dynamodb wait table-exists --table-name "$WORKFLOWS_TABLE" --region "$REGION"
  echo "  ✓ Created ${WORKFLOWS_TABLE}"
else
  echo "  ✓ ${WORKFLOWS_TABLE} already exists"
fi
echo ""

# ─── Step 3: Create Events Table ───────────────────────────────────────────────
echo "▶ Step 3: Creating ${EVENTS_TABLE} table..."
if ! aws dynamodb describe-table --table-name "$EVENTS_TABLE" --region "$REGION" &>/dev/null; then
  aws dynamodb create-table \
    --table-name "$EVENTS_TABLE" \
    --region "$REGION" \
    --attribute-definitions \
      AttributeName=workflowId,AttributeType=S \
      AttributeName=eventId,AttributeType=S \
    --key-schema \
      AttributeName=workflowId,KeyType=HASH \
      AttributeName=eventId,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --no-cli-pager
  aws dynamodb wait table-exists --table-name "$EVENTS_TABLE" --region "$REGION"

  # Enable TTL
  aws dynamodb update-time-to-live \
    --table-name "$EVENTS_TABLE" \
    --region "$REGION" \
    --time-to-live-specification Enabled=true,AttributeName=ttl \
    --no-cli-pager
  echo "  ✓ Created ${EVENTS_TABLE} with TTL"
else
  echo "  ✓ ${EVENTS_TABLE} already exists"
fi
echo ""

# ─── Step 4: Create/Update IAM Role ────────────────────────────────────────────
echo "▶ Step 4: Ensuring IAM role..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

if ! aws iam get-role --role-name "$ROLE_NAME" &>/dev/null; then
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "lambda.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' \
    --no-cli-pager

  aws iam attach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

  # Inline policy for DynamoDB, S3, Lambda, EventBridge, Bedrock
  aws iam put-role-policy --role-name "$ROLE_NAME" \
    --policy-name orchestrator-access \
    --policy-document "{
      \"Version\": \"2012-10-17\",
      \"Statement\": [
        {
          \"Effect\": \"Allow\",
          \"Action\": [\"dynamodb:*\"],
          \"Resource\": [
            \"arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${TICKETS_TABLE}\",
            \"arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${TICKETS_TABLE}/index/*\",
            \"arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${TICKETS_TABLE}/stream/*\",
            \"arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${WORKFLOWS_TABLE}\",
            \"arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${EVENTS_TABLE}\"
          ]
        },
        {
          \"Effect\": \"Allow\",
          \"Action\": [\"s3:GetObject\", \"s3:PutObject\"],
          \"Resource\": \"arn:aws:s3:::${ARTIFACT_BUCKET:-*}/*\"
        },
        {
          \"Effect\": \"Allow\",
          \"Action\": [\"lambda:InvokeFunction\"],
          \"Resource\": [
            \"arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${GITHUB_LAMBDA}\",
            \"arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${INVOKER_FUNCTION}\"
          ]
        },
        {
          \"Effect\": \"Allow\",
          \"Action\": [\"events:PutEvents\"],
          \"Resource\": \"arn:aws:events:${REGION}:${ACCOUNT_ID}:event-bus/default\"
        },
        {
          \"Effect\": \"Allow\",
          \"Action\": [\"bedrock:*\", \"bedrock-agent-runtime:*\", \"bedrock-agentcore:*\"],
          \"Resource\": \"*\"
        },
        {
          \"Effect\": \"Allow\",
          \"Action\": [\"secretsmanager:GetSecretValue\"],
          \"Resource\": \"arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:agentis/*\"
        }
      ]
    }" \
    --no-cli-pager

  echo "  ✓ Created role ${ROLE_NAME}"
  echo "  ⏳ Waiting 10s for role propagation..."
  sleep 10
else
  echo "  ✓ Role ${ROLE_NAME} already exists"
fi
echo ""

# ─── Step 5: Package and Deploy Lambdas ────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="/tmp/agentis-orchestrator-pkg"

echo "▶ Step 5: Packaging Lambdas..."
rm -rf "$PACKAGE_DIR" && mkdir -p "$PACKAGE_DIR"
cp "$SCRIPT_DIR/index.mjs" "$PACKAGE_DIR/"
cp "$SCRIPT_DIR/agent-invoker.mjs" "$PACKAGE_DIR/"
cp "$SCRIPT_DIR/events-writer.mjs" "$PACKAGE_DIR/"

cd "$PACKAGE_DIR"

# Install dependencies
cat > package.json << 'PKGJSON'
{
  "name": "agentis-orchestrator",
  "type": "module",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.600.0",
    "@aws-sdk/lib-dynamodb": "^3.600.0",
    "@aws-sdk/client-lambda": "^3.600.0",
    "@aws-sdk/client-s3": "^3.600.0",
    "@aws-sdk/client-eventbridge": "^3.600.0",
    "@aws-sdk/client-bedrock-agent-runtime": "^3.600.0",
    "@aws-sdk/credential-provider-node": "^3.600.0",
    "@smithy/signature-v4": "^3.0.0",
    "@aws-crypto/sha256-js": "^5.0.0"
  }
}
PKGJSON

npm install --production --silent 2>/dev/null
zip -r /tmp/orchestrator.zip . -x "*.DS_Store" > /dev/null

echo "  ✓ Package created ($(du -h /tmp/orchestrator.zip | cut -f1))"
echo ""

# Deploy Orchestrator
echo "▶ Step 5a: Deploying ${ORCHESTRATOR_FUNCTION}..."
ENV_VARS="Variables={TICKETS_TABLE=${TICKETS_TABLE},WORKFLOWS_TABLE=${WORKFLOWS_TABLE},EVENTS_TABLE=${EVENTS_TABLE},ARTIFACT_BUCKET=${ARTIFACT_BUCKET},GITHUB_LAMBDA=${GITHUB_LAMBDA},EVENT_BUS=default,PROJECT_KEY=TEAM}"

if aws lambda get-function --function-name "$ORCHESTRATOR_FUNCTION" --region "$REGION" &>/dev/null; then
  aws lambda update-function-code \
    --function-name "$ORCHESTRATOR_FUNCTION" \
    --region "$REGION" \
    --zip-file fileb:///tmp/orchestrator.zip \
    --no-cli-pager > /dev/null
  aws lambda update-function-configuration \
    --function-name "$ORCHESTRATOR_FUNCTION" \
    --region "$REGION" \
    --timeout 60 \
    --memory-size 256 \
    --environment "$ENV_VARS" \
    --no-cli-pager > /dev/null
else
  aws lambda create-function \
    --function-name "$ORCHESTRATOR_FUNCTION" \
    --region "$REGION" \
    --runtime nodejs20.x \
    --handler index.handler \
    --role "$ROLE_ARN" \
    --zip-file fileb:///tmp/orchestrator.zip \
    --timeout 60 \
    --memory-size 256 \
    --environment "$ENV_VARS" \
    --no-cli-pager > /dev/null
fi
echo "  ✓ ${ORCHESTRATOR_FUNCTION} deployed"

# Deploy Agent Invoker
echo "▶ Step 5b: Deploying ${INVOKER_FUNCTION}..."
if aws lambda get-function --function-name "$INVOKER_FUNCTION" --region "$REGION" &>/dev/null; then
  aws lambda update-function-code \
    --function-name "$INVOKER_FUNCTION" \
    --region "$REGION" \
    --zip-file fileb:///tmp/orchestrator.zip \
    --no-cli-pager > /dev/null
  aws lambda update-function-configuration \
    --function-name "$INVOKER_FUNCTION" \
    --region "$REGION" \
    --handler agent-invoker.handler \
    --timeout 900 \
    --memory-size 512 \
    --environment "$ENV_VARS" \
    --no-cli-pager > /dev/null
else
  aws lambda create-function \
    --function-name "$INVOKER_FUNCTION" \
    --region "$REGION" \
    --runtime nodejs20.x \
    --handler agent-invoker.handler \
    --role "$ROLE_ARN" \
    --zip-file fileb:///tmp/orchestrator.zip \
    --timeout 900 \
    --memory-size 512 \
    --environment "$ENV_VARS" \
    --no-cli-pager > /dev/null
fi
echo "  ✓ ${INVOKER_FUNCTION} deployed"

# Deploy Events Writer
echo "▶ Step 5c: Deploying ${EVENTS_WRITER_FUNCTION}..."
if aws lambda get-function --function-name "$EVENTS_WRITER_FUNCTION" --region "$REGION" &>/dev/null; then
  aws lambda update-function-code \
    --function-name "$EVENTS_WRITER_FUNCTION" \
    --region "$REGION" \
    --zip-file fileb:///tmp/orchestrator.zip \
    --no-cli-pager > /dev/null
  aws lambda update-function-configuration \
    --function-name "$EVENTS_WRITER_FUNCTION" \
    --region "$REGION" \
    --handler events-writer.handler \
    --timeout 10 \
    --memory-size 128 \
    --environment "$ENV_VARS" \
    --no-cli-pager > /dev/null
else
  aws lambda create-function \
    --function-name "$EVENTS_WRITER_FUNCTION" \
    --region "$REGION" \
    --runtime nodejs20.x \
    --handler events-writer.handler \
    --role "$ROLE_ARN" \
    --zip-file fileb:///tmp/orchestrator.zip \
    --timeout 10 \
    --memory-size 128 \
    --environment "$ENV_VARS" \
    --no-cli-pager > /dev/null
fi
echo "  ✓ ${EVENTS_WRITER_FUNCTION} deployed"
echo ""

# ─── Step 6: Wire DynamoDB Stream → Orchestrator ───────────────────────────────
echo "▶ Step 6: Wiring DynamoDB Stream → Orchestrator..."
EXISTING_MAPPING=$(aws lambda list-event-source-mappings \
  --function-name "$ORCHESTRATOR_FUNCTION" \
  --region "$REGION" \
  --query "EventSourceMappings[?contains(EventSourceArn, '${TICKETS_TABLE}')].UUID" \
  --output text 2>/dev/null)

if [ -z "$EXISTING_MAPPING" ] || [ "$EXISTING_MAPPING" = "None" ]; then
  aws lambda create-event-source-mapping \
    --function-name "$ORCHESTRATOR_FUNCTION" \
    --region "$REGION" \
    --event-source-arn "$STREAM_ARN" \
    --starting-position LATEST \
    --batch-size 10 \
    --maximum-batching-window-in-seconds 1 \
    --no-cli-pager > /dev/null
  echo "  ✓ Stream → Lambda mapping created"
else
  echo "  ✓ Stream → Lambda mapping already exists (UUID: ${EXISTING_MAPPING})"
fi
echo ""

# ─── Step 7: Create EventBridge Rule ──────────────────────────────────────────
echo "▶ Step 7: Creating EventBridge rule..."
aws events put-rule \
  --name agentis-workflow-events \
  --region "$REGION" \
  --event-pattern '{
    "source": ["agentis.orchestrator", "agentis.agent-invoker"]
  }' \
  --state ENABLED \
  --no-cli-pager > /dev/null

EVENTS_WRITER_ARN=$(aws lambda get-function --function-name "$EVENTS_WRITER_FUNCTION" --region "$REGION" \
  --query 'Configuration.FunctionArn' --output text)

aws events put-targets \
  --rule agentis-workflow-events \
  --region "$REGION" \
  --targets "Id=events-writer,Arn=${EVENTS_WRITER_ARN}" \
  --no-cli-pager > /dev/null

# Grant EventBridge permission to invoke the Lambda
aws lambda add-permission \
  --function-name "$EVENTS_WRITER_FUNCTION" \
  --region "$REGION" \
  --statement-id eventbridge-invoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/agentis-workflow-events" \
  --no-cli-pager 2>/dev/null || true

echo "  ✓ EventBridge rule created"
echo ""

# ─── Done ───────────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  ✅ Deployment complete!"
echo ""
echo "  Infrastructure:"
echo "    • DynamoDB Stream: ${STREAM_ARN}"
echo "    • Orchestrator:    ${ORCHESTRATOR_FUNCTION}"
echo "    • Agent Invoker:   ${INVOKER_FUNCTION}"
echo "    • Events Writer:   ${EVENTS_WRITER_FUNCTION}"
echo "    • Workflows Table: ${WORKFLOWS_TABLE}"
echo "    • Events Table:    ${EVENTS_TABLE}"
echo ""
echo "  Next steps:"
echo "    1. Set HARNESS_ARN_* env vars on the orchestrator Lambda"
echo "       (one per agent, e.g., HARNESS_ARN_TEAM_REQUIREMENTS_ANALYST)"
echo "    2. Swap Next.js routes to event-driven versions:"
echo "       - src/app/api/workflow/start/route-event-driven.ts → route.ts"
echo "       - src/app/api/workflow/webhook/route-event-driven.ts → route.ts"
echo "       - src/app/api/workflow/[id]/stream/route-event-driven.ts → route.ts"
echo "    3. Test: POST to /api/workflow/start and watch CloudWatch logs"
echo "═══════════════════════════════════════════════════════"
