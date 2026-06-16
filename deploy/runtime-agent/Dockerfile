FROM --platform=linux/arm64 public.ecr.aws/docker/library/python:3.13-slim
WORKDIR /app

# System deps — git for repo operations, Node.js for Playwright only
# (Claude Code CLI is now on its own dedicated runtime)
RUN apt-get update && apt-get install -y gcc g++ git curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Playwright for validation (Strands agent validates Claude Code's output)
RUN npx playwright install --with-deps chromium

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
EXPOSE 8080
CMD ["python", "main.py"]
