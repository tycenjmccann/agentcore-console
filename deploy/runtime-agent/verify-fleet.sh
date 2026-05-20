#!/bin/bash
#
# verify-fleet.sh — Post-deployment health check for the Agentis fleet
#
# Reads fleet-runtime-ids.json and invokes each agent with a health-check
# prompt that asks it to test all its tools. Collects responses and prints
# a summary table showing tool status per agent.
#
# Usage:
#   ./verify-fleet.sh [--region us-east-1] [--timeout 120]
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REGION="${AWS_REGION:-us-east-1}"
TIMEOUT=120
FLEET_FILE="$SCRIPT_DIR/fleet-runtime-ids.json"

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --region) REGION="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [ ! -f "$FLEET_FILE" ]; then
  echo "ERROR: $FLEET_FILE not found. Run deploy-fleet.sh first."
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Fleet Health Check — Invoking all agents"
echo "═══════════════════════════════════════════════════════════════"
echo "  Region:  $REGION"
echo "  Timeout: ${TIMEOUT}s per agent"
echo "  Fleet:   $FLEET_FILE"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Run the Python invoke script which handles SigV4 signing and response parsing
python3 "$SCRIPT_DIR/verify-fleet-invoke.py" \
  --fleet-file "$FLEET_FILE" \
  --region "$REGION" \
  --timeout "$TIMEOUT"
