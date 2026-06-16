FROM --platform=linux/arm64 public.ecr.aws/docker/library/python:3.13-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    CLAUDE_CODE_USE_BEDROCK=1 \
    CLAUDE_CODE_ENABLE_TELEMETRY=1 \
    CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1 \
    OTEL_LOG_TOOL_DETAILS=1

# System deps: git, Node.js (Claude Code is Node-based), build essentials
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates bash nodejs npm openssh-client jq \
    && rm -rf /var/lib/apt/lists/*

# OpenTelemetry Collector Contrib — sidecar that forwards Claude Code's
# telemetry to CloudWatch via SigV4-signed OTLP. Includes sigv4auth +
# transform (OTTL) processors that ADOT lacks.
ARG OTELCOL_VERSION=0.104.0
RUN curl -fsSL -o /tmp/otelcol-contrib.deb \
      "https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v${OTELCOL_VERSION}/otelcol-contrib_${OTELCOL_VERSION}_linux_$(dpkg --print-architecture).deb" \
    && dpkg -i /tmp/otelcol-contrib.deb \
    && rm /tmp/otelcol-contrib.deb

# Non-root user (matches AgentCore convention)
RUN useradd -m -u 1000 bedrock_agentcore

# Install Claude Code CLI
USER bedrock_agentcore
RUN curl -fsSL -o /tmp/claude-install.sh https://claude.ai/install.sh && \
    bash /tmp/claude-install.sh && \
    rm /tmp/claude-install.sh
USER root

# Playwright (for validation/testing — both Strands agent and Claude Code use it)
RUN npx playwright install --with-deps chromium

# Python deps (health server + OTel SDK)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# OTel collector config + health server
COPY otel-collector-config.yaml .
COPY --chown=bedrock_agentcore:bedrock_agentcore main.py .

USER bedrock_agentcore

# AgentCore Runtime service contract ports
EXPOSE 8080 8000 9000

CMD ["python", "main.py"]
