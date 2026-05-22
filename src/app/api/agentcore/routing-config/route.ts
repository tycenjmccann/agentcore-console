import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_REGION } from "@/lib/agentcore-sdk";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

// Per-region account ID cache
const accountIdCache = new Map<string, string>();

/**
 * GET /api/agentcore/routing-config
 * Returns routing agent IDs + ARN prefix from env vars (set after deployment).
 */
export async function GET(req: NextRequest) {
  const region = req.headers.get("x-aws-region") || DEFAULT_REGION;

  // Get account ID (cached per region)
  if (!accountIdCache.has(region)) {
    try {
      const sts = new STSClient({ region });
      const identity = await sts.send(new GetCallerIdentityCommand({}));
      accountIdCache.set(region, identity.Account || "");
    } catch {
      accountIdCache.set(region, "");
    }
  }

  return NextResponse.json({
    designAgentId: process.env.DESIGN_AGENT_ID || "",
    devAgentId: process.env.DEV_AGENT_ID || "",
    region,
    accountId: accountIdCache.get(region) || "",
  });
}
