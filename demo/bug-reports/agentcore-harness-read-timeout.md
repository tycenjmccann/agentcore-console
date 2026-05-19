# AgentCore Harness Internal Read Timeout Bug Report

**Date:** 2026-05-19
**Severity:** P1 — Blocks multi-agent pipelines using Claude Sonnet 4.5 (and Opus 4) with >3 tool calls
**Account:** 023392223961
**Region:** us-east-1

---

## Summary

The AgentCore Harness runtime has a hardcoded **120-second `read_timeout`** on the botocore HTTP connection to `bedrock-runtime.us-east-1.amazonaws.com`. This timeout is **not configurable** by the customer. When a Bedrock model (particularly Claude Opus 4) takes longer than 120 seconds to produce the first token after receiving a large context (accumulated tool results), the connection is killed by urllib3's `ReadTimeoutError`.

This consistently breaks agents that require more than ~3-5 tool call cycles. The issue is **context accumulation**, not model speed — even Sonnet 4.5 times out once enough tool results are in the conversation.

## Impact

- **Agents that complete successfully:** Simple agents with 1-3 tool calls (requirements-analyst, backend-dev, api-dev, qa-verifier, ci-agent) — all finish fine with Sonnet 4.5
- **Agents that consistently fail:** Security reviewer (Sonnet 4.5 per CloudWatch metrics: `global.anthropic.claude-sonnet-4-5-20250929-v1:0`, 8+ gateway tools, complex system prompt) — fails 100% of the time across 7+ test runs over 24 hours

**IMPORTANT:** The harness OTel metrics confirm the model is `global.anthropic.claude-sonnet-4-5-20250929-v1:0` (Sonnet 4.5), NOT Opus. This means the timeout affects even faster models when context is large enough.

## Root Cause

The timeout occurs in the Strands Agents SDK event loop at:

```
strands/event_loop/event_loop.py:318 → recurse_event_loop
strands/event_loop/event_loop.py:198 → event_loop_cycle (model invocation)
strands/models/bedrock.py → _stream → botocore eventstream read
```

Call chain:
1. Agent executes a tool (e.g., `S3Storage___read_object`)
2. Tool result is appended to conversation context
3. `recurse_event_loop` calls the model again with the full accumulated context
4. Bedrock model begins thinking (Opus 4 TTFT can exceed 60s with large context)
5. **urllib3 kills the connection at exactly 120 seconds** — before any response token arrives

The `read_timeout` is set internally by the harness runtime's botocore client configuration. There is no customer-facing parameter to override it.

## Evidence

### Stack Trace (from CloudWatch)

```
Traceback (most recent call last):
  File "/opt/amazon/lib/python3.10/site-packages/urllib3/response.py", line 903, in _error_catcher
    yield
  File "/opt/amazon/lib/python3.10/site-packages/urllib3/response.py", line 1418, in read_chunked
    self._update_chunk_length()
  File "/opt/amazon/lib/python3.10/site-packages/urllib3/response.py", line 1333, in _update_chunk_length
    line = self._fp.fp.readline()
  File "/opt/amazon/python3.10/lib/python3.10/socket.py", line 717, in readinto
    return self._sock.recv_into(b)
  File "/opt/amazon/python3.10/lib/python3.10/ssl.py", line 1307, in recv_into
    return self.read(nbytes, buffer)
  File "/opt/amazon/python3.10/lib/python3.10/ssl.py", line 1163, in read
    return self._sslobj.read(len, buffer)
TimeoutError: The read operation timed out

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "/opt/amazon/lib/python3.10/site-packages/strands/event_loop/event_loop.py", line 238, in event_loop_cycle
    async for tool_event in tool_events:
  File "/opt/amazon/lib/python3.10/site-packages/strands/event_loop/event_loop.py", line 646, in _handle_tool_execution
    async for event in events:
  File "/opt/amazon/lib/python3.10/site-packages/strands/event_loop/event_loop.py", line 318, in recurse_event_loop
    async for event in events:
  File "/opt/amazon/lib/python3.10/site-packages/strands/event_loop/event_loop.py", line 198, in event_loop_cycle
    async for model_event in model_events:
  ...
urllib3.exceptions.ReadTimeoutError: AWSHTTPSConnectionPool(host='bedrock-runtime.us-east-1.amazonaws.com', port=443): Read timed out.
```

### CloudWatch Log Details

- **Log Group:** `/aws/bedrock-agentcore/runtimes/harness_team_security_reviewer-Lpq9zN5Ve7-DEFAULT`
- **Trace ID:** `6a0c0285679e59e00d1010a7ee2a910e`
- **Runtime ARN:** `arn:aws:bedrock-agentcore:us-east-1:023392223961:runtime/harness_team_security_reviewer-Lpq9zN5Ve7/runtime-endpoint/DEFAULT:DEFAULT`

### Timeline (Workflow `wf_1779171742404_3w0j7t`)

| Time (UTC) | Event |
|---|---|
| 06:28:37.417Z | Attempt 1 — `ReadTimeoutError` in `event_loop_cycle` |
| 06:28:37.420Z | `Error in sync streaming` — session `wf_...-team-security-reviewer-1779171974006` |
| 06:28:39.872Z | Retry starts — `Creating AgentCoreBrowser` logged |
| 06:28:40.248Z | Tool provider filter: `wildcard — all tools permitted` |
| 06:30:56.557Z | Attempt 2 (retry) — `ReadTimeoutError` in `event_loop_cycle` |
| 06:30:56.561Z | `Error in sync streaming` — session `...-retry1` |

**Duration:** Retry attempt ran for ~139 seconds total, timeout occurred after model call following tool execution.

### Repeated Failures (56 timeout events in 24h)

The same harness has failed with `ReadTimeoutError` across 7 separate workflow invocations over 24 hours. Every single invocation of `team-security-reviewer` hits this timeout. Timestamps of all observed failures:

- 2026-05-19T02:31:18Z
- 2026-05-19T03:04:35Z
- 2026-05-19T03:10:52Z
- 2026-05-19T03:29:10Z
- 2026-05-19T04:19:39Z
- 2026-05-19T04:42:47Z
- 2026-05-19T06:28:37Z (+ retry at 06:30:56Z)

## Reproduction Steps

1. Create an AgentCore Harness with:
   - Model: `global.anthropic.claude-sonnet-4-5-20250929-v1:0` (Sonnet 4.5) — confirmed via OTel `gen_ai.request.model` metric
   - 8+ gateway tools (S3, DynamoDB, Jira, Slack, BuilderTools, WorkflowOutput, SkillLoader, Browser)
   - System prompt ~2000 tokens
2. Invoke the harness with a prompt that requires 4+ tool calls in sequence
3. Agent will execute first 2-3 tool calls successfully
4. On the 4th+ model invocation (with accumulated tool results in context), the connection times out at exactly 120s

## Workaround

**No viable workaround exists.** The failed agent is already using Sonnet 4.5 (confirmed via OTel metrics). The timeout is purely a function of accumulated context size after multiple tool call rounds — any model will hit it once the conversation grows large enough.

Potential mitigations (all have downsides):
- Reduce number of tools available to agent (limits capability)
- Split complex agents into multiple simpler agents (increases orchestration complexity)
- Truncate tool results before appending to context (loses information)

## Requested Fix

1. **Increase `read_timeout`** on the internal botocore client to at least 300 seconds (5 min). Opus 4 can legitimately exceed 120s for first token on large context windows.
2. **Expose `read_timeout` as a configurable parameter** on the Harness/Runtime resource so customers can tune it per-agent.
3. **Add internal retry with exponential backoff** for `ReadTimeoutError` within the event loop (the current behavior is single-attempt → crash).

## Attached Logs

- `cloudwatch-logs-security-reviewer-timeout.txt` — Full CloudWatch log export (554 events, 415KB) covering the 2026-05-19T06:25-06:35Z timeout window
- Raw JSON export available at `/tmp/agentcore-harness-logs-security-reviewer.json` (13MB, full 24h)

## Software Versions (from CloudWatch metadata)

| Component | Version |
|---|---|
| Strands Agents SDK | (via event_loop.py, agent.py) |
| OpenTelemetry SDK | 1.40.0 |
| OTel Auto-instrumentation | 0.17.0-aws |
| Python | 3.10 |
| Runtime platform | `aws_bedrock_agentcore` |
| urllib3 | (bundled with botocore) |

## Contact

- **Harness Name:** `harness_team_security_reviewer`
- **Runtime ID:** `harness_team_security_reviewer-Lpq9zN5Ve7`
- **Gateway:** `datesparkiamgw-vjme4fyj6k`
