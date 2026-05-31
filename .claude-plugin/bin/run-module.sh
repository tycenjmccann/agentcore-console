#!/usr/bin/env bash
# Idempotent dispatcher for AgentCore Hub modules.
# Knows the script order and required env vars per module.
# Underlying scripts already exist in deploy/ and scripts/ — this only sequences them.
#
# Usage: run-module.sh <core|builder|workflow|evaluations>
#
# Reads from environment:
#   AWS_PROFILE, AWS_REGION (required)
#   TICKET_PROVIDER ("dynamodb" or "jira") — required for workflow

set -euo pipefail

MODULE="${1:-}"
if [[ -z "$MODULE" ]]; then
  echo "Usage: $0 <core|builder|workflow|evaluations>" >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

: "${AWS_REGION:?AWS_REGION must be set}"
: "${AWS_PROFILE:=default}"
export AWS_PROFILE AWS_REGION

echo "── Running module: $MODULE ────────────────────────────────"

case "$MODULE" in
  core)
    if [[ ! -d node_modules ]]; then
      echo "→ npm install"
      npm install
    else
      echo "→ node_modules already present, skipping npm install"
    fi
    echo "→ Verifying AWS credentials"
    aws sts get-caller-identity --output text >/dev/null
    ;;

  builder)
    echo "→ node deploy/setup-builder-agent.mjs"
    node deploy/setup-builder-agent.mjs
    ;;

  workflow)
    : "${TICKET_PROVIDER:?TICKET_PROVIDER must be 'dynamodb' or 'jira'}"

    if [[ "$TICKET_PROVIDER" == "dynamodb" ]]; then
      echo "→ ./scripts/create-dynamodb-tables.sh --with-tickets"
      ./scripts/create-dynamodb-tables.sh --with-tickets
    else
      echo "→ ./scripts/create-dynamodb-tables.sh"
      ./scripts/create-dynamodb-tables.sh
    fi

    echo "→ Ensuring artifact bucket exists"
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    BUCKET="agentcore-hub-artifacts-${ACCOUNT_ID}-${AWS_REGION}"
    if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
      echo "  Bucket $BUCKET already exists, skipping"
    else
      aws s3 mb "s3://$BUCKET" --region "$AWS_REGION"
    fi

    echo "→ bash deploy/setup-runtime-role.sh"
    bash deploy/setup-runtime-role.sh

    echo "→ node deploy/setup-tickets-lambda.mjs"
    node deploy/setup-tickets-lambda.mjs

    echo "→ deploy/runtime-agent/build-and-push.sh"
    (cd deploy/runtime-agent && ./build-and-push.sh)

    echo "→ deploy/runtime-agent/deploy-fleet.sh"
    (cd deploy/runtime-agent && ./deploy-fleet.sh)

    echo "→ node deploy/setup-team-agents.mjs"
    node deploy/setup-team-agents.mjs
    ;;

  evaluations)
    echo "→ deploy/evaluations/setup-evaluations.sh"
    bash deploy/evaluations/setup-evaluations.sh

    echo "→ deploy/continuous-improvement/deploy-all.sh"
    bash deploy/continuous-improvement/deploy-all.sh
    ;;

  *)
    echo "Unknown module: $MODULE" >&2
    echo "Valid: core, builder, workflow, evaluations" >&2
    exit 2
    ;;
esac

echo "── Module $MODULE: deploy steps complete ───────────────────"
