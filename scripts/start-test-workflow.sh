#!/bin/bash
# ─── Start Test Workflow ─────────────────────────────────────────────────────
#
# Submits a workflow via the /api/workflow/start endpoint.
# This is the ONLY correct way to start a workflow — it ensures:
#   - Workflow metadata in agentis-workflows has all required fields (startedAt, etc.)
#   - Epic + requirements ticket created in agentis-tickets
#   - DynamoDB Stream fires → orchestrator Lambda invokes agents
#
# Usage:
#   ./scripts/start-test-workflow.sh                     # Default test scope
#   ./scripts/start-test-workflow.sh --title "My feature" --desc "Details here"
#   ./scripts/start-test-workflow.sh --scope sidebar     # Pre-defined scope
#   ./scripts/start-test-workflow.sh --scope minimal     # Smallest possible test
#
# Requirements:
#   - Next.js dev server running on localhost:3000 (or set BASE_URL)
#   - AWS credentials configured (DynamoDB access)
#
# ─────────────────────────────────────────────────────────────────────────────

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
REPO_URL="${REPO_URL:-https://github.com/tycen-io/agentis-hub}"
DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"

# ─── Parse args ──────────────────────────────────────────────────────────────

TITLE=""
DESC=""
SCOPE=""
MODEL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --title) TITLE="$2"; shift 2 ;;
    --desc|--description) DESC="$2"; shift 2 ;;
    --scope) SCOPE="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --url) BASE_URL="$2"; shift 2 ;;
    --repo) REPO_URL="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--title <title>] [--desc <description>] [--scope <name>] [--model <model>]"
      echo ""
      echo "Scopes:"
      echo "  minimal   - Single-file change (fastest, ~5 min)"
      echo "  sidebar   - Collapsible sidebar feature (medium, ~20 min)"
      echo "  full      - Multi-component feature (longest, ~30 min)"
      echo ""
      echo "Models: sonnet (default), opus"
      exit 0
      ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ─── Pre-defined scopes ──────────────────────────────────────────────────────

case "${SCOPE:-}" in
  minimal)
    TITLE="${TITLE:-[TEST] Add /health endpoint}"
    DESC="${DESC:-Add a health check endpoint at src/app/api/health/route.ts that returns {status: \"ok\", timestamp: ISO string, uptime: process.uptime()}. Single file, no dependencies.}"
    ;;
  sidebar)
    TITLE="${TITLE:-[TEST] Collapsible History Sidebar + Intake Card Enhancements}"
    DESC="${DESC:-Add a collapsible history sidebar to the workflow page that shows previous workflow runs.
The sidebar should:
- Show last 10 workflow runs with title, date, and status
- Collapse/expand with a toggle button
- Persist collapse state in localStorage
- Highlight the currently active workflow

Also enhance the intake card:
- Add drag-and-drop file upload for mockup images
- Show image previews inline
- Add a \"paste from clipboard\" button for screenshots

Files to modify: src/app/workflow/page.tsx, src/components/workflow/WorkflowBoard.tsx}"
    ;;
  full)
    TITLE="${TITLE:-[TEST] Data Table with Sorting and Filtering}"
    DESC="${DESC:-Create a reusable data table component with:
- Column sorting (asc/desc toggle)
- Text search filtering across all columns
- Pagination (10/25/50 rows per page)
- Row selection with checkbox
- Export selected rows to CSV

Use it on the agents page to replace the current agent list.

Files to create: src/components/ui/DataTable.tsx, src/components/ui/DataTable.test.tsx
Files to modify: src/app/agents/page.tsx}"
    ;;
  "")
    # Default: use sidebar if no title/desc provided
    if [ -z "$TITLE" ] && [ -z "$DESC" ]; then
      TITLE="[TEST] Status Badge Component System"
      DESC="Create a reusable StatusBadge component that displays agent/ticket status with appropriate colors and icons. Support statuses: active, idle, error, complete, blocked, running. Use it on the dashboard agent table. Files to modify: src/app/page.tsx. Files to create: src/components/ui/StatusBadge.tsx"
    fi
    ;;
esac

# ─── Build request body ──────────────────────────────────────────────────────

BODY=$(cat <<EOF
{
  "title": $(echo "$TITLE" | jq -Rs .),
  "description": $(echo "$DESC" | jq -Rs .),
  "sources": [],
  "repoConfig": {
    "repos": [{"url": "$REPO_URL", "defaultBranch": "$DEFAULT_BRANCH"}]
  }$([ -n "$MODEL" ] && echo ", \"modelOverride\": \"$MODEL\"")
}
EOF
)

# ─── Submit ──────────────────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════════════"
echo "  Starting Test Workflow"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Target:  $BASE_URL/api/workflow/start"
echo "  Title:   $TITLE"
echo "  Repo:    $REPO_URL"
[ -n "$MODEL" ] && echo "  Model:   $MODEL"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/api/workflow/start" \
  -H "Content-Type: application/json" \
  -d "$BODY")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY_RESPONSE=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ne 200 ]; then
  echo "  ✗ FAILED (HTTP $HTTP_CODE)"
  echo "  Response: $BODY_RESPONSE"
  exit 1
fi

WORKFLOW_ID=$(echo "$BODY_RESPONSE" | jq -r '.workflowId // empty')
EPIC_ID=$(echo "$BODY_RESPONSE" | jq -r '.epicId // empty')

if [ -z "$WORKFLOW_ID" ]; then
  echo "  ✗ FAILED — no workflowId in response"
  echo "  Response: $BODY_RESPONSE"
  exit 1
fi

echo "  ✓ Workflow started!"
echo ""
echo "  Workflow ID: $WORKFLOW_ID"
echo "  Epic ID:     $EPIC_ID"
echo ""
echo "  View in UI:  $BASE_URL/workflow?id=$WORKFLOW_ID"
echo ""
echo "  Monitor:"
echo "    curl -s $BASE_URL/api/workflow/$WORKFLOW_ID/state | jq .phase"
echo ""
echo "═══════════════════════════════════════════════════════"
