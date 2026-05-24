#!/usr/bin/env bash
# Creates the DynamoDB tables required by Agentis Hub.
# Run once per account/region. Safe to re-run (will skip existing tables).
#
# Usage: AWS_PROFILE=your-profile ./scripts/create-dynamodb-tables.sh
#
# Tables:
#   agentis-workflows  — PK: workflowId (S), GSI: epicId-index
#   agentis-tickets    — PK: ticketId (S), GSIs: parentId-index, assignee-index
#   agentis-events     — PK: workflowId (S), SK: eventId (S), TTL: ttl

set -euo pipefail
REGION="${AWS_REGION:-us-east-1}"

echo "=== Creating DynamoDB tables in $REGION ==="

# ─── agentis-workflows ───────────────────────────────────────────────────────
echo "Creating agentis-workflows (PK=workflowId, GSI=epicId-index)..."
aws dynamodb create-table \
  --table-name agentis-workflows \
  --attribute-definitions \
    AttributeName=workflowId,AttributeType=S \
    AttributeName=epicId,AttributeType=S \
  --key-schema AttributeName=workflowId,KeyType=HASH \
  --global-secondary-indexes '[
    {
      "IndexName": "epicId-index",
      "KeySchema": [{"AttributeName":"epicId","KeyType":"HASH"}],
      "Projection": {"ProjectionType":"ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" 2>&1 || echo "  (table may already exist)"

# ─── agentis-tickets ─────────────────────────────────────────────────────────
echo "Creating agentis-tickets (PK=ticketId, Stream=NEW_AND_OLD_IMAGES)..."
aws dynamodb create-table \
  --table-name agentis-tickets \
  --attribute-definitions \
    AttributeName=ticketId,AttributeType=S \
    AttributeName=parentId,AttributeType=S \
    AttributeName=assignee,AttributeType=S \
  --key-schema AttributeName=ticketId,KeyType=HASH \
  --global-secondary-indexes '[
    {
      "IndexName": "parentId-index",
      "KeySchema": [{"AttributeName":"parentId","KeyType":"HASH"}],
      "Projection": {"ProjectionType":"ALL"}
    },
    {
      "IndexName": "assignee-index",
      "KeySchema": [{"AttributeName":"assignee","KeyType":"HASH"}],
      "Projection": {"ProjectionType":"ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
  --region "$REGION" 2>&1 || echo "  (table may already exist)"

# ─── agentis-events ──────────────────────────────────────────────────────────
echo "Creating agentis-events (PK=workflowId, SK=eventId, TTL=ttl)..."
aws dynamodb create-table \
  --table-name agentis-events \
  --attribute-definitions \
    AttributeName=workflowId,AttributeType=S \
    AttributeName=eventId,AttributeType=S \
  --key-schema \
    AttributeName=workflowId,KeyType=HASH \
    AttributeName=eventId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" 2>&1 || echo "  (table may already exist)"

# Enable TTL on events table
aws dynamodb update-time-to-live \
  --table-name agentis-events \
  --time-to-live-specification Enabled=true,AttributeName=ttl \
  --region "$REGION" 2>&1 || echo "  (TTL may already be enabled)"

echo ""
echo "=== Done. Verify with: aws dynamodb list-tables --region $REGION ==="
