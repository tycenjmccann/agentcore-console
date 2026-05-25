# BUG REPORT: Agent Timeout Causes Silent Failure — Tickets Stuck Forever in "in_progress"

**Date:** 2026-05-24
**Severity:** Critical (workflow-blocking, no auto-recovery)
**Affected Workflow:** `wf_1779647270454_unblro` (TEAM-1017 "[TEST] Add /health endpoint")
**Affected Agent:** `agentis_backend_dev` (Runtime ID: `agentis_backend_dev-UKXih09TYL`)
**Account:** 838829463875 (tycenj-prod)
**Region:** us-east-1

---

## Summary

When an AgentCore Runtime agent hits a Bedrock model read timeout during tool execution (specifically during deeply-nested `claude_code` subprocess calls), the agent silently dies without ever calling `report_completion`. The orchestrator never receives an `agent.complete` event, so the ticket remains in `"in_progress"` state **permanently**. No existing recovery mechanism (auto-nudge, stale detection) can fix this because they intentionally skip in-progress tickets.

---

## Impact

- Workflow is permanently stuck in "review" phase
- No auto-recovery possible — requires manual intervention ("Restart Agent" button)
- Even manual intervention requires the UI page to be open (client-side stale detection)
- If no human is watching the dashboard, the workflow hangs indefinitely

---

## Timeline (UTC)

| Timestamp | Event |
|-----------|-------|
| 18:51:03 | TEAM-1048 invoked (backend-dev, fix broken package-lock.json) |
| 18:51:47 | Agent calls `claude_code` tool (spawns nested sub-agent loop) |
| 18:53:33 | Claude Code subprocess returns — couldn't push, agent pivots to shell/API |
| 18:53:37 | TEAM-1049 invoked (second backend-dev instance, scaffold push) |
| 18:53:50 | TEAM-1049 session starts (sessionId: `TEAM-1048_wf_...-1779648817261`) |
| 18:54:24 | TEAM-1049 agent calls `claude_code` again for scaffold generation |
| 18:59:48 | TEAM-1049 successfully pushes scaffold files via `push_files` (commit: `4424d66...`) |
| 19:00:10 | TEAM-1049 attempts to push 191KB `package-lock.json` via `create_or_update_file` — **LAST STREAMING EVENT** |
| **19:03:54** | **TEAM-1048 crashes: `ReadTimeoutError` from Bedrock Runtime** |
| 19:03:54+ | **Silence. No `report_completion`. No `agent.complete`. Workflow stuck.** |

---

## Root Cause: Bedrock Runtime Read Timeout

### Error Log (Exact)

**Log Group:** `/aws/bedrock-agentcore/runtimes/agentis_backend_dev-UKXih09TYL-DEFAULT`
**Log Stream:** `2026/05/24/[runtime-logs-TEAM-1048_wf_1779647270454_unblro-team-backend-dev-1779648663317]838d9da3-2c16-4812-9c49-4a20aeeb543c`
**Filter:** Session ID `1779648663317`

```json
{
  "timestamp": "2026-05-24T19:03:54.296Z",
  "level": "ERROR",
  "message": "Error in sync streaming",
  "logger": "bedrock_agentcore.app",
  "requestId": "120a628c-f426-4a55-8bb5-123c830269b9",
  "sessionId": "TEAM-1048_wf_1779647270454_unblro-team-backend-dev-1779648663317",
  "errorType": "EventLoopException",
  "errorMessage": "AWSHTTPSConnectionPool(host='bedrock-runtime.us-east-1.amazonaws.com', port=443): Read timed out."
}
```

### Full Stack Trace

```
Traceback (most recent call last):
  File "/var/task/urllib3/response.py", line 905, in _error_catcher
    yield
  File "/var/task/urllib3/response.py", line 1430, in read_chunked
    self._update_chunk_length()
  File "/var/task/urllib3/response.py", line 1343, in _update_chunk_length
    line = self._fp.fp.readline()
  File "/opt/aws/agentcore-runtime/python/versions/3.10.19/lib/python3.10/socket.py", line 717, in readinto
    return self._sock.recv_into(b)
  File "/opt/aws/agentcore-runtime/python/versions/3.10.19/lib/python3.10/ssl.py", line 1307, in recv_into
    return self.read(nbytes, buffer)
  File "/opt/aws/agentcore-runtime/python/versions/3.10.19/lib/python3.10/ssl.py", line 1163, in read
    return self._sslobj.read(len, buffer)
TimeoutError: The read operation timed out

The above exception was the direct cause of the following exception:

  File "/var/task/strands/event_loop/event_loop.py", line 238, in event_loop_cycle
    async for tool_event in tool_events:
  File "/var/task/strands/event_loop/event_loop.py", line 646, in _handle_tool_execution
    async for event in events:
  File "/var/task/strands/event_loop/event_loop.py", line 318, in recurse_event_loop
    async for event in events:
  [...10+ levels of recurse_event_loop — deep nesting from claude_code tool...]
  File "/var/task/strands/event_loop/streaming.py", line 416, in process_stream
    async for chunk in chunks:
  File "/var/task/strands/models/bedrock.py", line 939, in stream
    await task
  File "/var/task/strands/models/bedrock.py", line 976, in _stream
    for chunk in response["stream"]:
  File "/var/task/botocore/eventstream.py", line 591, in __iter__
    for event in self._event_generator:
  File "/var/task/botocore/eventstream.py", line 598, in _create_raw_event_generator
    for chunk in self._raw_stream.stream():
  File "/var/task/urllib3/response.py", line 1260, in stream
    yield from self.read_chunked(amt, decode_content=decode_content)
  urllib3.exceptions.ReadTimeoutError: AWSHTTPSConnectionPool(host='bedrock-runtime.us-east-1.amazonaws.com', port=443): Read timed out.

The above exception was the direct cause of the following exception:

  File "/var/task/bedrock_agentcore/runtime/app.py", line 886, in _sync_stream_with_error_handling
    for value in generator:
  File "/var/task/bedrock_agentcore/runtime/app.py", line 747, in _async_gen_to_sync_gen
    raise value
  File "/var/task/bedrock_agentcore/runtime/app.py", line 736, in _produce
    async for chunk in async_gen:
  File "/var/task/main.py", line 815, in agent_invocation
    async for event in agent.stream_async(prompt):
  File "/var/task/strands/agent/agent.py", line 858, in stream_async
    async for event in events:
  File "/var/task/strands/agent/agent.py", line 924, in _run_loop
    async for event in events:
  File "/var/task/strands/agent/agent.py", line 990, in _execute_event_loop_cycle
    async for event in events:
```

### What This Means

The agent was executing the `claude_code` tool, which spawns a recursive sub-agent loop (Strands `recurse_event_loop`). That inner loop calls Bedrock Runtime for model inference. The model's streaming response connection timed out at the socket level (`ssl.py` → `recv_into` → `TimeoutError`).

The timeout is governed by the `READ_TIMEOUT=600` env var (10 minutes), but the socket-level timeout appears to be lower — the actual failure happened ~12 minutes after the `claude_code` tool was invoked (18:51:47 → 19:03:54), suggesting the timeout accumulated across multiple recursive model calls within the tool.

---

## Why No Recovery Fires

### Auto-Nudge (WorkflowBoard.tsx, lines 633-679)

The client-side auto-nudge checks every 15 seconds for idle >90s and calls `/api/workflow/[id]/nudge`. However, the nudge endpoint (`src/app/api/workflow/[id]/nudge/route.ts`) **explicitly skips in-progress tickets**:

```typescript
// Line 14-15 in nudge/route.ts:
// We intentionally do NOT reset in_progress tickets —
// they may have a long-running tool call (e.g., claude_code subprocess)
```

This was designed to avoid killing healthy agents running long `claude_code` sessions. But it means crashed agents are never recovered.

### Stale Detection (AgentOutputPanel.tsx, lines 358-390)

The UI shows an amber glow after 6 minutes of no streaming, with a "Restart Agent" button. But:
1. Requires UI page to be open
2. Requires manual user click
3. Is purely visual — no automatic action

### Orchestrator (lambda/orchestrator/index.mjs)

The orchestrator only processes events via DynamoDB Streams. No event = no action. It has no polling or timeout mechanism for running agents.

---

## How to Reproduce the Logs

```bash
# 1. Find the session IDs from DynamoDB events
AWS_PROFILE=tycenj-prod aws dynamodb query \
  --table-name agentis-events \
  --key-condition-expression "workflowId = :wf" \
  --expression-attribute-values '{":wf":{"S":"wf_1779647270454_unblro"}}' \
  --region us-east-1 | jq -r '.Items[] | select(.type.S == "orchestrator.agent_invoked") | "\(.timestamp.S) \(.detail.M.sessionId.S) \(.detail.M.ticketId.S)"'

# 2. List log streams (session IDs are embedded in stream names)
AWS_PROFILE=tycenj-prod aws logs describe-log-streams \
  --log-group-name "/aws/bedrock-agentcore/runtimes/agentis_backend_dev-UKXih09TYL-DEFAULT" \
  --order-by LastEventTime --descending --limit 10 \
  --region us-east-1

# 3. Search for the error by session ID
AWS_PROFILE=tycenj-prod aws logs filter-log-events \
  --log-group-name "/aws/bedrock-agentcore/runtimes/agentis_backend_dev-UKXih09TYL-DEFAULT" \
  --filter-pattern "1779648663317" \
  --region us-east-1

# 4. Search for timeout errors across all backend-dev sessions
AWS_PROFILE=tycenj-prod aws logs filter-log-events \
  --log-group-name "/aws/bedrock-agentcore/runtimes/agentis_backend_dev-UKXih09TYL-DEFAULT" \
  --filter-pattern "Read timed out" \
  --region us-east-1
```

---

## Recommended Fix

### Option A: Agent-Level Error Handler (in `main.py`)

When the agent catches an unrecoverable error (like `ReadTimeoutError` or `EventLoopException`), it should **call `report_completion` with a failure status** before dying:

```python
# In main.py, around the agent_invocation generator (line ~815):
try:
    async for event in agent.stream_async(prompt):
        yield event
except (EventLoopException, ReadTimeoutError, Exception) as e:
    # Report failure to orchestrator so it can retry
    error_summary = f"Agent crashed: {type(e).__name__}: {str(e)[:500]}"
    try:
        await call_report_completion(
            ticket_id=ticket_id,
            summary=f"AGENT_ERROR: {error_summary}",
            workflow_id=workflow_id,
            status="blocked"  # <-- NEW: signal this is a crash, not a success
        )
    except Exception:
        pass  # Last resort — at least the error is logged
    raise
```

### Option B: Orchestrator-Level Timeout (Server-Side Reaper)

Add a scheduled Lambda (EventBridge rule, every 5 minutes) that:
1. Scans `agentis-workflows` for tasks with `status: "running"` and `lastStreamingAt` older than X minutes
2. Transitions those tickets to `"blocked"` with error reason
3. Emits `agent.complete` event with failure status so the orchestrator can decide to retry

### Option C: Nudge Enhancement (Minimal Change)

Modify the nudge endpoint to also handle `in_progress` tickets that have been idle for >10 minutes:

```typescript
// In nudge/route.ts — add a "stale in-progress" check:
const staleThreshold = 10 * 60 * 1000; // 10 minutes
const staleRunning = tickets.filter(t =>
  t.status === "in_progress" &&
  (Date.now() - new Date(t.lastStreamingAt).getTime()) > staleThreshold
);
// Reset these to "ready" with resumeContext
```

### Recommended: Options A + B Together

- **Option A** handles the 90% case — the agent knows it failed and reports it immediately
- **Option B** is the safety net for the 10% case where the agent process is killed externally (OOM, container eviction) and can't self-report

---

## Secondary Bug: TEAM-1049 Session ID Mismatch

The orchestrator logged TEAM-1049's invocation with TEAM-1048's session ID:

```
18:53:37 agent.invoked       ticketId=TEAM-1049
18:53:37 orchestrator.agent_invoked  sessionId=TEAM-1048_wf_...-1779648817261  ticketId=TEAM-1048  ← BUG
```

This suggests the `agent-invoker.mjs` is constructing the session ID from the wrong ticket ID when firing concurrent invocations. Not the root cause here, but could cause confusion in log correlation and could affect the retry/resume system if it uses session IDs to build `resumeContext`.

**Location to investigate:** `lambda/orchestrator/agent-invoker.mjs` — the session ID construction in `fireAndForgetRuntime()`.

---

## Current State (as of writing)

- Workflow `wf_1779647270454_unblro` is stuck in `phase: "review"`
- TEAM-1048 and TEAM-1049 show as `"running"` in `agentTasks`
- No events after 19:00:10 UTC
- Requires manual "Restart Agent" via UI or direct DDB update to unblock

---

## Files Referenced

| File | Purpose |
|------|---------|
| `deploy/runtime-agent/main.py` (line ~815) | Agent invocation generator — where error handling should be added |
| `lambda/orchestrator/agent-invoker.mjs` (line ~163) | `fireAndForgetRuntime()` — session ID construction |
| `src/app/api/workflow/[id]/nudge/route.ts` (line 14) | Nudge endpoint — skips in-progress tickets |
| `src/components/workflow/AgentOutputPanel.tsx` (line 358) | Stale detection UI — manual only |
| `src/components/workflow/WorkflowBoard.tsx` (line 633) | Auto-nudge interval — only handles todo/blocked |
| `lambda/workflow-output/index.mjs` | `report_completion` handler — needs "blocked" status support |

---

## Environment Details

- **AgentCore Runtime:** Python 3.10.19
- **Strands SDK:** (deployed via `requirements.txt`)
- **Model:** `us.anthropic.claude-opus-4-6-v1` (via Bedrock Runtime)
- **READ_TIMEOUT env:** 600 (seconds)
- **Idle timeout:** 3600s (AgentCore config)
- **Max lifetime:** 3600s (AgentCore config)
