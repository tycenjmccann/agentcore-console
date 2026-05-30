/**
 * GET /api/evaluations — Fetch evaluation scorecard + per-agent metrics
 *
 * Sources:
 * - Eval log groups: OTEL scores + session counts per agent
 * - Runtime log groups: gen_ai.client.token.usage per agent (input/output tokens)
 *
 * Uses raw HTTPS + SigV4 signing to bypass AWS SDK bundling issues in Next.js.
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { fetchAgentTokens, cwLogsRequest, type AgentTokenResult } from "./fetch-tokens";
import agentsConfig from "@/config/agents.json";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Map raw CW Logs evaluator names to UI display names
function normalizeEvaluatorName(raw: string): string {
  // Built-ins: "Builtin.ToolSelectionAccuracy" → "ToolSelectionAccuracy"
  if (raw.startsWith("Builtin.")) return raw.slice(8);
  // Custom: "dependency_chain_compliance_online" → "DependencyChainCompliance"
  if (raw.includes("dependency_chain_compliance")) return "DependencyChainCompliance";
  return raw;
}

// Derive agent fleet from agents.json config — no hardcoded values.
// evalConfigName and harnessName are first-class fields in agents.json
// (populated from the actual deployed CW log group / AgentCore runtime names).
const AGENTS: Record<string, { name: string; runtimeLogGroupPrefix: string }> = Object.fromEntries(
  agentsConfig.agents
    .filter((a) => a.evaluationsEnabled && a.harnessName && a.evalConfigName)
    .map((a) => [
      a.evalConfigName,
      {
        name: a.name,
        runtimeLogGroupPrefix: `/aws/bedrock-agentcore/runtimes/${a.harnessName}-`,
      },
    ])
);

// Per-model pricing (per 1M tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "us.anthropic.claude-opus-4-6-v1": { input: 15, output: 75 },
  "us.anthropic.claude-opus-4-7": { input: 15, output: 75 },
  "us.anthropic.claude-sonnet-4-6": { input: 3, output: 15 },
  "us.anthropic.claude-sonnet-4-5-20250929-v1:0": { input: 3, output: 15 },
  "us.anthropic.claude-haiku-4-5-20251001-v1:0": { input: 0.80, output: 4 },
};
const DEFAULT_PRICING = { input: 15, output: 75 }; // fallback to Opus if unknown

// In-memory cache: evaluations data changes slowly (7-day window), no need to re-fetch every request
let cachedResponse: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

// Timeout wrapper — prevents one slow agent from stalling the entire response
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function GET() {
  await headers();

  // Return cached data if fresh
  if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cachedResponse.data);
  }

  try {
    const endTime = Date.now();
    const startTime = endTime - 7 * 24 * 60 * 60 * 1000; // Last 7 days

    // 1. Fetch eval scores + token usage ALL IN PARALLEL (no AWS SDK)
    const agentEntries = Object.entries(AGENTS);

    const AGENT_TIMEOUT_MS = 15000; // 15s max per agent fetch
    const emptyEval = { name: "", scores: {} as Record<string, { scores: number[] }>, sessionCount: 0 };
    const emptyTokens: AgentTokenResult = { input: 0, output: 0, byModel: [] };

    const [evalResults, tokenResults] = await Promise.all([
      // Eval scores: describe log groups + filter events per agent (parallel)
      Promise.all(
        agentEntries.map(([configName, agentDef]) =>
          withTimeout(
            (async () => {
              const logGroupPrefix = `/aws/bedrock-agentcore/evaluations/results/${configName}`;
              const sessions = new Set<string>();
              const agentScores: Record<string, { scores: number[] }> = {};

              const groupsResp = await cwLogsRequest("DescribeLogGroups", {
                logGroupNamePrefix: logGroupPrefix,
              });
              const logGroups = groupsResp.logGroups || [];

              const groupResults = await Promise.all(
                logGroups.map((group: { logGroupName: string }) =>
                  cwLogsRequest("FilterLogEvents", {
                    logGroupName: group.logGroupName,
                    startTime, endTime, limit: 500,
                  }).catch(() => ({ events: [] }))
                )
              );

              for (const result of groupResults) {
                for (const event of result.events || []) {
                  try {
                    const parsed = JSON.parse(event.message || "{}");
                    const attrs = parsed.attributes || {};
                    const rawEvaluator = attrs["gen_ai.evaluation.name"] || "";
                    const evaluator = normalizeEvaluatorName(rawEvaluator);
                    const score = attrs["gen_ai.evaluation.score.value"];
                    const sessionId = attrs["session.id"] || "";
                    if (sessionId) sessions.add(sessionId);
                    if (evaluator && score !== undefined && score !== null) {
                      if (!agentScores[evaluator]) agentScores[evaluator] = { scores: [] };
                      agentScores[evaluator].scores.push(Number(score));
                    }
                  } catch {}
                }
              }
              return { name: agentDef.name, scores: agentScores, sessionCount: sessions.size };
            })(),
            AGENT_TIMEOUT_MS,
            { ...emptyEval, name: agentDef.name }
          )
        )
      ),
      // Token usage: discover log group by prefix, then fetch tokens (parallel)
      Promise.all(
        agentEntries.map(([, agentDef]) =>
          withTimeout(
            (async () => {
              const groupsResp = await cwLogsRequest("DescribeLogGroups", {
                logGroupNamePrefix: agentDef.runtimeLogGroupPrefix,
                limit: 5,
              });
              const logGroups = (groupsResp.logGroups || []) as { logGroupName: string }[];
              if (logGroups.length === 0) return emptyTokens;
              const logGroupName = logGroups[logGroups.length - 1].logGroupName;
              return await fetchAgentTokens(logGroupName, startTime, endTime);
            })(),
            AGENT_TIMEOUT_MS,
            emptyTokens
          )
        )
      ),
    ]);

    // 2. Aggregate eval scores
    const scorecard: Record<string, Record<string, { scores: number[] }>> = {};
    const sessionCounts: Record<string, number> = {};
    for (const { name, scores, sessionCount } of evalResults) {
      if (Object.keys(scores).length > 0) scorecard[name] = scores;
      sessionCounts[name] = sessionCount;
    }

    // 3. Compute scorecard averages
    const scorecardSummary: Record<string, Record<string, { avg: number; count: number; passing: number }>> = {};
    for (const [agent, evaluators] of Object.entries(scorecard)) {
      scorecardSummary[agent] = {};
      for (const [evaluator, data] of Object.entries(evaluators)) {
        const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        const passing = data.scores.filter(s => s >= 0.7).length / data.scores.length;
        scorecardSummary[agent][evaluator] = {
          avg: Math.round(avg * 100) / 100,
          count: data.scores.length,
          passing: Math.round(passing * 100),
        };
      }
    }

    // 4. Compute per-agent metrics with per-model cost breakdown
    const computeCost = (tokenResult: AgentTokenResult): { cost: number; byModel: Array<{ model: string; input: number; output: number; cost: number }> } => {
      let totalCost = 0;
      const byModel: Array<{ model: string; input: number; output: number; cost: number }> = [];
      for (const m of tokenResult.byModel) {
        const pricing = MODEL_PRICING[m.model] || DEFAULT_PRICING;
        const modelCost = (m.input / 1_000_000 * pricing.input) + (m.output / 1_000_000 * pricing.output);
        totalCost += modelCost;
        byModel.push({ model: m.model, input: Math.round(m.input), output: Math.round(m.output), cost: Math.round(modelCost * 100) / 100 });
      }
      return { cost: totalCost, byModel };
    };

    const metrics: Record<string, { sessions: number; tokensIn: number; tokensOut: number; cost: number; costPerSession: number; models: Array<{ model: string; input: number; output: number; cost: number }> }> = {};
    for (let i = 0; i < agentEntries.length; i++) {
      const agentDef = agentEntries[i][1];
      const tokenResult = tokenResults[i];
      const sessions = sessionCounts[agentDef.name] || 0;
      const { cost, byModel } = computeCost(tokenResult);
      const costPerSession = sessions > 0 ? cost / sessions : 0;

      metrics[agentDef.name] = {
        sessions,
        tokensIn: Math.round(tokenResult.input),
        tokensOut: Math.round(tokenResult.output),
        cost: Math.round(cost * 100) / 100,
        costPerSession: Math.round(costPerSession * 100) / 100,
        models: byModel,
      };
    }

    // 5. Return
    const debugTokens: Record<string, { input: number; output: number }> = {};
    for (let i = 0; i < agentEntries.length; i++) {
      debugTokens[agentEntries[i][1].name] = tokenResults[i];
    }

    const responseData = {
      agents: Object.values(AGENTS).map(a => a.name),
      scorecard: scorecardSummary,
      metrics,
      _debug: { tokenResults: debugTokens, version: "v14-no-sdk" },
      evaluators: [
        "ToolSelectionAccuracy",
        "ToolParameterAccuracy",
        "InstructionFollowing",
        "GoalSuccessRate",
        "Correctness",
        "Coherence",
        "Faithfulness",
        "Helpfulness",
        "Conciseness",
        "ResponseRelevance",
        "DependencyChainCompliance",
      ],
      lastUpdated: new Date().toISOString(),
    };

    // Cache the response
    cachedResponse = { data: responseData, timestamp: Date.now() };

    return NextResponse.json(responseData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
