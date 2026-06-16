"""
Amazon Bedrock AgentCore Runtime — Claude Code Worker

Health server for the Claude Code runtime. Claude Code is NOT invoked through
this server — it is launched via InvokeAgentRuntimeCommand (shell execution)
from the orchestrating Strands agent.

This server provides:
  - Health check endpoints (/ping, /health) for AgentCore lifecycle management
  - HealthyBusy status while Claude Code is actively running (prevents idle timeout)
  - Healthy status when idle (allows normal session idle-out)
  - OTel collector sidecar startup for telemetry forwarding to CloudWatch

Architecture (matches aws-samples/sample-agent-assisted-sdlc):
  - Strands agent calls InvokeAgentRuntimeCommand with session_id
  - AgentCore shells into this microVM and runs the claude CLI command
  - Claude Code's built-in telemetry sends spans to the local OTel collector
  - OTel collector signs with SigV4 and forwards to CloudWatch
  - /mnt/workspace persists repos, deps, and Claude config across invocations
"""

import os
import socket
import subprocess
import time
import logging

import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("claude-code-runtime")

# Process names that indicate Claude Code is actively working
_CLAUDE_PROC_NAMES = ("claude", "node")

COLLECTOR_BIN = "/usr/bin/otelcol-contrib"
COLLECTOR_CFG = "/app/otel-collector-config.yaml"


def _wire_log_headers() -> None:
    """Parse OTEL_EXPORTER_OTLP_LOGS_HEADERS (AgentCore-injected) and re-export
    the values the collector config references."""
    raw = os.environ.get("OTEL_EXPORTER_OTLP_LOGS_HEADERS", "")
    for kv in raw.split(","):
        if "=" not in kv:
            continue
        k, v = kv.split("=", 1)
        if k.strip() == "x-aws-log-group":
            os.environ["AWS_OTEL_LOG_GROUP"] = v.strip()
        elif k.strip() == "x-aws-log-stream":
            os.environ["AWS_OTEL_LOG_STREAM"] = v.strip()


def _wait_for_collector(
    host: str = "127.0.0.1", port: int = 4318, timeout: float = 10.0
) -> bool:
    """Wait for the OTel collector to be ready on its OTLP HTTP endpoint."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with socket.create_connection((host, port), timeout=1):
                return True
        except OSError:
            time.sleep(0.2)
    return False


def _start_collector() -> subprocess.Popen | None:
    """Start the OTel collector sidecar if the config and binary exist."""
    if not os.path.exists(COLLECTOR_BIN):
        logger.warning("OTel collector binary not found — telemetry will not be forwarded")
        return None
    if not os.path.exists(COLLECTOR_CFG):
        logger.warning("OTel collector config not found — telemetry will not be forwarded")
        return None

    logger.info(f"Starting OTel collector: {COLLECTOR_BIN} --config {COLLECTOR_CFG}")
    return subprocess.Popen(
        [COLLECTOR_BIN, "--config", COLLECTOR_CFG],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )


def _bootstrap_collector() -> None:
    """Wire log headers and start the OTel collector sidecar."""
    _wire_log_headers()
    collector_proc = _start_collector()
    if collector_proc is None:
        return
    if _wait_for_collector():
        logger.info("OTel collector ready on 127.0.0.1:4318")
    else:
        logger.warning("OTel collector failed to bind within 10s")
        if collector_proc.poll() is not None:
            out = (
                collector_proc.stdout.read().decode(errors="replace")
                if collector_proc.stdout
                else ""
            )
            logger.error(f"OTel collector exited: rc={collector_proc.returncode}, output={out[:2000]}")


# --- FastAPI health server ---
app = FastAPI()


def _claude_is_running(proc_root: str = "/proc") -> bool:
    """True if a claude process is alive in this microVM.

    Walks /proc and matches the executable name (argv[0]) against known
    Claude Code process names.
    """
    try:
        pids = os.listdir(proc_root)
    except OSError:
        return False
    for pid in pids:
        if not pid.isdigit():
            continue
        try:
            with open(os.path.join(proc_root, pid, "cmdline"), "rb") as f:
                raw = f.read()
        except OSError:
            continue  # process exited between listdir and open
        if not raw:
            continue
        argv0 = raw.split(b"\x00", 1)[0].decode(errors="replace")
        exe = argv0.rsplit("/", 1)[-1]
        if exe in _CLAUDE_PROC_NAMES:
            return True
    return False


@app.get("/ping")
@app.get("/health")
async def health():
    """AgentCore Runtime health endpoint.

    Reports HealthyBusy while Claude Code is running so AgentCore does NOT
    reap the session at the idle timeout mid-run. Reports Healthy when idle
    so normal idle-out behavior applies.

    The time_of_last_update field is REQUIRED — without it AgentCore fires
    the idle timeout even when status is HealthyBusy.
    """
    status = "HealthyBusy" if _claude_is_running() else "Healthy"
    return JSONResponse({"status": status, "time_of_last_update": int(time.time())})


@app.post("/invocations")
async def invocations():
    """Placeholder — Claude Code is invoked via InvokeAgentRuntimeCommand, not here."""
    return JSONResponse({"status": "ok"})


if __name__ == "__main__":
    _bootstrap_collector()
    logger.info("Claude Code runtime health server starting on port 8080")
    uvicorn.run(app, host="0.0.0.0", port=8080)
