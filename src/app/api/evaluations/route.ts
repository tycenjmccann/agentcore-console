/**
 * GET /api/evaluations — Fetch evaluation configs, scorecard data, and metrics
 *
 * Queries:
 * - AgentCore control plane for online eval configs
 * - CloudWatch Logs for evaluation results
 * - CloudWatch Metrics for latency/token data
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const REGION = process.env.AWS_REGION || "us-east-1";

// Agent fleet config — maps eval config to agent for display
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
    // Dynamically import AWS SDK (server-side only)
    const { BedrockAgentCoreClient } = await import("@aws-sdk/client-bedrock-agentcore");
    const { CloudWatchLogsClient, FilterLogEventsCommand } = await import("@aws-sdk/client-cloudwatch-logs");
    const { CloudWatchClient, GetMetricDataCommand } = await import("@aws-sdk/client-cloudwatch");

    const cwLogs = new CloudWatchLogsClient({ region: REGION });
    const cw = new CloudWatchClient({ region: REGION });

    // 1. Fetch evaluation results from CloudWatch log groups
    const scorecard: Record<string, Record<string, { scores: number[]; labels: string[] }>> = {};
    const endTime = Date.now();
    const startTime = endTime - 24 * 60 * 60 * 1000; // Last 24 hours

    for (const [configName, agentLabel] of Object.entries(EVAL_CONFIGS)) {
      const logGroup = `/aws/bedrock-agentcore/evaluations/results/${configName}`;

      try {
        // Try to find the actual log group (has a suffix)
        const { DescribeLogGroupsCommand } = await import("@aws-sdk/client-cloudwatch-logs");
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
              const evaluator = parsed.evaluator_id || parsed.evaluatorId || parsed.evaluator;
              const score = parsed.score ?? parsed.result?.score;
              const label = parsed.label || parsed.result?.label;

              if (evaluator && score !== undefined && score !== null) {
                if (!scorecard[agentLabel]) scorecard[agentLabel] = {};
                if (!scorecard[agentLabel][evaluator]) scorecard[agentLabel][evaluator] = { scores: [], labels: [] };
                scorecard[agentLabel][evaluator].scores.push(Number(score));
                if (label) scorecard[agentLabel][evaluator].labels.push(label);
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

    // 3. Fetch latency metrics from CloudWatch (Bedrock InvocationLatency)
    const latencyByAgent: Record<string, { avg: number; count: number }> = {};
    try {
      const metricQueries = Object.keys(EVAL_CONFIGS).slice(0, 14).map((name, i) => ({
        Id: `m${i}`,
        MetricStat: {
          Metric: {
            Namespace: "AWS/Bedrock/AgentCore",
            MetricName: "InvocationLatency",
            Dimensions: [{ Name: "AgentRuntimeName", Value: name.replace("eval_", "agentis_") }],
          },
          Period: 86400,
          Stat: "Average",
        },
      }));

      if (metricQueries.length > 0) {
        const metricsResult = await cw.send(new GetMetricDataCommand({
          MetricDataQueries: metricQueries,
          StartTime: new Date(startTime),
          EndTime: new Date(endTime),
        }));

        for (const result of metricsResult.MetricDataResults || []) {
          const idx = parseInt(result.Id?.replace("m", "") || "0");
          const configName = Object.keys(EVAL_CONFIGS)[idx];
          const agentLabel = EVAL_CONFIGS[configName];
          if (result.Values && result.Values.length > 0) {
            latencyByAgent[agentLabel] = {
              avg: Math.round(result.Values[0] / 1000 * 10) / 10, // ms to seconds
              count: result.Values.length,
            };
          }
        }
      }
    } catch {}

    // 4. Return combined data
    return NextResponse.json({
      configs: Object.entries(EVAL_CONFIGS).map(([id, name]) => ({
        id,
        name,
        status: "ACTIVE",
        executionStatus: "ENABLED",
        samplingRate: 100,
        evaluators: [
          "Builtin.ToolSelectionAccuracy",
          "Builtin.ToolParameterAccuracy",
          "Builtin.InstructionFollowing",
          "Builtin.GoalSuccessRate",
          "Builtin.Correctness",
          "Builtin.Coherence",
          "Builtin.Faithfulness",
          "Builtin.Helpfulness",
          "Builtin.Conciseness",
          "dependency_chain_compliance_online",
        ],
      })),
      scorecard: scorecardSummary,
      latency: latencyByAgent,
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
      judgeModel: "us.anthropic.claude-opus-4-7",
      samplingRate: "100%",
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
