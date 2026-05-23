/**
 * GET /api/evaluations — Fetch evaluation scorecard + metrics for all agents
 *
 * Queries:
 * - CloudWatch Logs for evaluation results (OTEL format)
 * - CloudWatch Metrics for latency, tokens, invocations
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const REGION = process.env.AWS_REGION || "us-east-1";

// Agent fleet config
const EVAL_CONFIGS: Record<string, string> = {
  "eval_analytics_designer": "Analytics Designer",
  "eval_android_designer": "Android Designer",
  "eval_api_dev": "API Developer",
  "eval_backend_designer": "Backend Designer",
  "eval_backend_dev": "Backend Developer",
  "eval_ci_agent": "CI Agent",
  "eval_frontend_designer": "Frontend Designer",
  "eval_frontend_dev": "Frontend Developer",
  "eval_ios_designer": "iOS Designer",
  "eval_legal_compliance": "Legal & Compliance",
  "eval_localization": "Localization",
  "eval_qa_verifier": "QA Verifier",
  "eval_requirements_analyst": "Requirements Analyst",
  "eval_security_reviewer": "Security Reviewer",
};

export async function GET() {
  try {
    const { CloudWatchLogsClient, FilterLogEventsCommand, DescribeLogGroupsCommand } = await import("@aws-sdk/client-cloudwatch-logs");
    const { CloudWatchClient, GetMetricDataCommand } = await import("@aws-sdk/client-cloudwatch");

    const cwLogs = new CloudWatchLogsClient({ region: REGION });
    const cw = new CloudWatchClient({ region: REGION });

    const endTime = Date.now();
    const startTime = endTime - 24 * 60 * 60 * 1000; // Last 24 hours

    // 1. Fetch evaluation results from CloudWatch log groups
    const scorecard: Record<string, Record<string, { scores: number[]; labels: string[] }>> = {};

    for (const [configName, agentLabel] of Object.entries(EVAL_CONFIGS)) {
      const logGroup = `/aws/bedrock-agentcore/evaluations/results/${configName}`;

      try {
        const groups = await cwLogs.send(new DescribeLogGroupsCommand({
          logGroupNamePrefix: logGroup,
        }));

        for (const group of groups.logGroups || []) {
          const result = await cwLogs.send(new FilterLogEventsCommand({
            logGroupName: group.logGroupName,
            startTime,
            endTime,
            limit: 100,
          }));

          for (const event of result.events || []) {
            try {
              const parsed = JSON.parse(event.message || "{}");
              const attrs = parsed.attributes || {};
              const evaluator = attrs["gen_ai.evaluation.name"] || parsed.evaluator_id || parsed.evaluatorId || parsed.evaluator;
              const score = attrs["gen_ai.evaluation.score.value"] ?? parsed.score ?? parsed.result?.score;

              if (evaluator && score !== undefined && score !== null) {
                if (!scorecard[agentLabel]) scorecard[agentLabel] = {};
                if (!scorecard[agentLabel][evaluator]) scorecard[agentLabel][evaluator] = { scores: [], labels: [] };
                scorecard[agentLabel][evaluator].scores.push(Number(score));
              }
            } catch {}
          }
        }
      } catch {}
    }

    // 2. Compute averages for scorecard
    const scorecardSummary: Record<string, Record<string, { avg: number; count: number; passing: number }>> = {};
    for (const [agent, evaluators] of Object.entries(scorecard)) {
      scorecardSummary[agent] = {};
      for (const [evaluator, data] of Object.entries(evaluators)) {
        const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        const passing = data.scores.filter(s => s >= 0.8).length / data.scores.length;
        scorecardSummary[agent][evaluator] = {
          avg: Math.round(avg * 100) / 100,
          count: data.scores.length,
          passing: Math.round(passing * 100),
        };
      }
    }

    // 3. Fetch metrics from CloudWatch (latency, tokens, invocations)
    const agentNames = Object.keys(EVAL_CONFIGS).map(k => k.replace("eval_", "agentis_"));
    const metrics: Record<string, { latency?: number; tokensIn?: number; tokensOut?: number; invocations?: number; cost?: number }> = {};

    try {
      const metricQueries = [];
      let idx = 0;

      for (const agentName of agentNames) {
        // Latency
        metricQueries.push({
          Id: `lat${idx}`,
          MetricStat: {
            Metric: {
              Namespace: "AWS/Bedrock/AgentCore",
              MetricName: "InvocationLatency",
              Dimensions: [{ Name: "AgentRuntimeName", Value: agentName }],
            },
            Period: 86400,
            Stat: "Average",
          },
        });
        // Input tokens
        metricQueries.push({
          Id: `tin${idx}`,
          MetricStat: {
            Metric: {
              Namespace: "AWS/Bedrock/AgentCore",
              MetricName: "InputTokenCount",
              Dimensions: [{ Name: "AgentRuntimeName", Value: agentName }],
            },
            Period: 86400,
            Stat: "Sum",
          },
        });
        // Output tokens
        metricQueries.push({
          Id: `tout${idx}`,
          MetricStat: {
            Metric: {
              Namespace: "AWS/Bedrock/AgentCore",
              MetricName: "OutputTokenCount",
              Dimensions: [{ Name: "AgentRuntimeName", Value: agentName }],
            },
            Period: 86400,
            Stat: "Sum",
          },
        });
        // Invocation count
        metricQueries.push({
          Id: `inv${idx}`,
          MetricStat: {
            Metric: {
              Namespace: "AWS/Bedrock/AgentCore",
              MetricName: "Invocations",
              Dimensions: [{ Name: "AgentRuntimeName", Value: agentName }],
            },
            Period: 86400,
            Stat: "Sum",
          },
        });
        idx++;
      }

      // CW GetMetricData allows max 500 queries per call
      if (metricQueries.length > 0) {
        const metricsResult = await cw.send(new GetMetricDataCommand({
          MetricDataQueries: metricQueries,
          StartTime: new Date(startTime),
          EndTime: new Date(endTime),
        }));

        for (const result of metricsResult.MetricDataResults || []) {
          const id = result.Id || "";
          const prefix = id.replace(/\d+$/, "");
          const agentIdx = parseInt(id.replace(/^[a-z]+/, ""));
          const configName = Object.keys(EVAL_CONFIGS)[agentIdx];
          const agentLabel = EVAL_CONFIGS[configName];
          if (!agentLabel) continue;
          if (!metrics[agentLabel]) metrics[agentLabel] = {};

          const val = result.Values && result.Values.length > 0 ? result.Values[0] : undefined;
          if (val === undefined) continue;

          if (prefix === "lat") metrics[agentLabel].latency = Math.round(val / 1000 * 10) / 10; // ms→s
          else if (prefix === "tin") metrics[agentLabel].tokensIn = Math.round(val);
          else if (prefix === "tout") metrics[agentLabel].tokensOut = Math.round(val);
          else if (prefix === "inv") metrics[agentLabel].invocations = Math.round(val);
        }
      }
    } catch {}

    // 4. Estimate costs (Opus 4.6 pricing: $15/MTok input, $75/MTok output)
    for (const [agent, m] of Object.entries(metrics)) {
      const inputCost = ((m.tokensIn || 0) / 1_000_000) * 15;
      const outputCost = ((m.tokensOut || 0) / 1_000_000) * 75;
      metrics[agent].cost = Math.round((inputCost + outputCost) * 100) / 100;
    }

    // 5. Return combined data
    return NextResponse.json({
      agents: Object.values(EVAL_CONFIGS),
      scorecard: scorecardSummary,
      metrics,
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
        "DependencyChainCompliance",
      ],
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
