#!/bin/bash
#
# refresh-agents-json.sh — Sync src/config/agents.json with what's actually
# deployed in AgentCore, without redeploying.
#
# Queries AWS for all agentis_* runtimes via boto3, then updates the
# harnessName and runtimeArn on every agent in agents.json whose id maps
# to a deployed runtime. Also writes deploy/runtime-agent/fleet-runtime-ids.json
# for use by the health-check harness (verify-fleet-invoke.py).
#
# Use this when:
#   - You deployed individual agents with deploy.sh / deploy-one.sh (which
#     don't update agents.json).
#   - agents.json drifted from reality and you want to reconcile.
#   - You need fleet-runtime-ids.json for verify-fleet-invoke.py.
#
# Usage:
#   AWS_PROFILE=tycenj-prod ./refresh-agents-json.sh [--region us-east-1]
#

set -e

REGION="${AWS_REGION:-us-east-1}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --region) REGION="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENTS_JSON="$SCRIPT_DIR/../../src/config/agents.json"
RESULTS_FILE="$SCRIPT_DIR/fleet-runtime-ids.json"

if [ ! -f "$AGENTS_JSON" ]; then
  echo "ERROR: agents.json not found at $AGENTS_JSON"
  exit 1
fi

REGION="$REGION" AGENTS_JSON="$AGENTS_JSON" RESULTS_FILE="$RESULTS_FILE" \
python3 <<'PYEOF'
import json
import os
import sys

import boto3

region = os.environ["REGION"]
agents_json_path = os.environ["AGENTS_JSON"]
results_file = os.environ["RESULTS_FILE"]

print(f"Querying AgentCore runtimes in {region}...")
client = boto3.client("bedrock-agentcore-control", region_name=region)

# Paginate list_agent_runtimes — the API returns up to 100 per page
deployed = {}
paginator = client.get_paginator("list_agent_runtimes")
for page in paginator.paginate():
    for rt in page.get("agentRuntimes", []):
        name = rt.get("agentRuntimeName", "")
        arn = rt.get("agentRuntimeArn", "")
        if name.startswith("agentis_"):
            deployed[name] = arn

if not deployed:
    print(f"ERROR: No agentis_* runtimes found in {region}. Check your AWS_PROFILE.")
    sys.exit(1)

print(f"  Found {len(deployed)} deployed runtimes.")

# Write fleet-runtime-ids.json (consumed by verify-fleet-invoke.py)
with open(results_file, "w") as f:
    json.dump(deployed, f, indent=2)
    f.write("\n")
print(f"  Wrote {len(deployed)} entries to fleet-runtime-ids.json")

# Update agents.json in place using line-level edits to preserve the file's
# existing formatting (compact inline arrays). A naive json.load/json.dump
# round-trip would expand every array onto multiple lines.
with open(agents_json_path) as f:
    text = f.read()

# Parse to walk the structure and figure out what to change
config = json.loads(text)

# Build per-agent expected values
plans = []  # list of (agent_id, runtime_name, runtime_arn)
missing = []
for agent in config["agents"]:
    runtime_name = "agentis_" + agent["id"].replace("team-", "").replace("-", "_")
    if runtime_name in deployed:
        plans.append((agent["id"], runtime_name, deployed[runtime_name]))
    else:
        missing.append(agent["id"])

import re
updated = 0
unchanged = 0

for agent_id, runtime_name, runtime_arn in plans:
    # Locate this agent's block in the text by its id
    id_marker = f'"id": "{agent_id}"'
    id_pos = text.find(id_marker)
    if id_pos < 0:
        continue
    # Find the closing brace of this agent object
    # Simple approach: find next "    }" after id_pos (4-space indent for agent object)
    end_pos = text.find("\n    }", id_pos)
    if end_pos < 0:
        continue
    block = text[id_pos:end_pos]

    new_block = block

    # Replace or insert harnessName
    if re.search(r'"harnessName":\s*"[^"]*"', new_block):
        new_block = re.sub(r'"harnessName":\s*"[^"]*"', f'"harnessName": "{runtime_name}"', new_block)
    else:
        # Insert after the id line
        new_block = re.sub(
            r'("id":\s*"' + re.escape(agent_id) + r'",\n)',
            r'\1      "harnessName": "' + runtime_name + r'",\n',
            new_block,
        )

    # Replace or insert runtimeArn
    if re.search(r'"runtimeArn":\s*"[^"]*"', new_block):
        new_block = re.sub(r'"runtimeArn":\s*"[^"]*"', f'"runtimeArn": "{runtime_arn}"', new_block)
    else:
        # Insert after harnessName
        new_block = re.sub(
            r'("harnessName":\s*"' + re.escape(runtime_name) + r'",\n)',
            r'\1      "runtimeArn": "' + runtime_arn + r'",\n',
            new_block,
        )

    if new_block == block:
        unchanged += 1
    else:
        text = text[:id_pos] + new_block + text[end_pos:]
        updated += 1

with open(agents_json_path, "w") as f:
    f.write(text)

print(f"  agents.json: {updated} updated, {unchanged} unchanged")
if missing:
    print(f"  WARNING: {len(missing)} agents in agents.json have no deployed runtime:")
    for m in missing:
        print(f"    - {m}")
PYEOF

echo ""
echo "Done. Files synced:"
echo "  - $AGENTS_JSON"
echo "  - $RESULTS_FILE"
