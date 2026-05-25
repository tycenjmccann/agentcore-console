#!/bin/bash
#
# verify-infra.sh — Check that all required AWS resources exist
#
# Usage:
#   ./scripts/verify-infra.sh [--with-tickets]
#
# Sources .env.local for table names and bucket. Exits 0 if all pass, 1 if any fail.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env.local"

if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

REGION="${AWS_REGION:-us-east-1}"
WORKFLOWS_TABLE="${WORKFLOWS_TABLE:-agentis-workflows}"
EVENTS_TABLE="${EVENTS_TABLE:-agentis-events}"
TICKETS_TABLE="${TICKETS_TABLE:-agentis-tickets}"
ARTIFACT_BUCKET="${ARTIFACT_BUCKET:-}"
CHECK_TICKETS=false

# Parse args
for arg in "$@"; do
  case $arg in
    --with-tickets) CHECK_TICKETS=true ;;
  esac
done

# If TICKET_PROVIDER=dynamodb, always check tickets table
if [ "${TICKET_PROVIDER}" = "dynamodb" ]; then
  CHECK_TICKETS=true
fi

PASS=0
FAIL=0

check() {
  local name=$1
  local cmd=$2
  if eval "$cmd" > /dev/null 2>&1; then
    echo "  ✓ $name"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "  Verifying Agentis Infrastructure"
echo "  ═══════════════════════════════════"
echo "  Region: $REGION"
echo ""

# DynamoDB tables
check "DynamoDB: $WORKFLOWS_TABLE" \
  "aws dynamodb describe-table --table-name $WORKFLOWS_TABLE --region $REGION"

check "DynamoDB: $EVENTS_TABLE" \
  "aws dynamodb describe-table --table-name $EVENTS_TABLE --region $REGION"

if [ "$CHECK_TICKETS" = true ]; then
  check "DynamoDB: $TICKETS_TABLE (with streams)" \
    "aws dynamodb describe-table --table-name $TICKETS_TABLE --region $REGION --query 'Table.StreamSpecification.StreamEnabled' --output text | grep -qi true"
fi

# S3 bucket
if [ -n "$ARTIFACT_BUCKET" ]; then
  check "S3: $ARTIFACT_BUCKET" \
    "aws s3api head-bucket --bucket $ARTIFACT_BUCKET --region $REGION"
else
  echo "  - S3: ARTIFACT_BUCKET not set (skipped)"
fi

# Lambda
check "Lambda: agentis-tickets" \
  "aws lambda get-function --function-name agentis-tickets --region $REGION"

echo ""
echo "  ───────────────────────────────────"
echo "  Results: $PASS passed, $FAIL failed"
echo ""

if [ $FAIL -gt 0 ]; then
  exit 1
fi
