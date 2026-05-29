# Engineering Backlog

Prioritized work items. Update status as items move through development.

---

## High Priority

### BL-001: Consolidate Ticket Lambdas into Single Router
**Ref:** DL-009
**Status:** TODO
**Owner:** Application team
**Description:** Merge `agentis-jira` and `agentis-tickets` into one Lambda with internal routing based on `TICKET_PROVIDER` env var. Eliminates the class of bugs where a service has the wrong `TICKET_TOOLS_LAMBDA` configured.
**Acceptance:** All services invoke one Lambda name. Adding a new provider requires only a new adapter file.

### BL-002: Fix Orchestrator DynamoDB Writes in Jira Mode
**Status:** TODO
**Owner:** Application team
**Description:** `lambda/orchestrator/index.mjs` lines 755-762 and 847-854 unconditionally write to DDB tickets table in error paths even in Jira mode. Should branch on `TICKET_PROVIDER`.
**Impact:** Errors in Jira mode try to write to a non-existent DDB table, causing secondary failures that mask the real error.

### BL-003: Fix agentis-tickets Lambda Tool Name Mismatches
**Status:** TODO
**Owner:** Application team
**Description:** The DynamoDB ticket Lambda has tool name/parameter mismatches vs what agents actually send:
- `transition_ticket` vs `transition_issue`
- `update_ticket` vs `edit_issue`
- `add_comment` expects `body`/`content` but callers send `comment`
**Impact:** DynamoDB path is completely broken for any customer trying to use it.

---

## Medium Priority

### BL-004: Streaming Events Table Query Fix
**Status:** TODO
**Description:** App Runner logs show repeated `Query condition missed key schema element: timestamp` errors when polling workflow events. The streaming endpoint's DynamoDB query is malformed.

---

## Low Priority / Future

### BL-005: Add Asana Ticket Provider Adapter
**Status:** FUTURE
**Description:** Once BL-001 (single router) is done, add an Asana adapter for customers using Asana for project management.

### BL-006: Add Linear Ticket Provider Adapter
**Status:** FUTURE
**Description:** Same as above but for Linear.

---
