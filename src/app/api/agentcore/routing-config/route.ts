import { NextResponse } from "next/server";
import { getActiveRegion } from "@/lib/agentcore-sdk";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

let cachedAccountId: string | null = null;

/**
 * GET /api/agentcore/routing-config
 * Returns routing agent IDs + ARN prefix from env vars (set after deployment).
 */
export async function GET() {
  const region = getActiveRegion();

  // Get account ID (cached)
  if (!cachedAccountId) {
    try {
      const sts = new STSClient({ region });
      const identity = await sts.send(new GetCallerIdentityCommand({}));
      cachedAccountId = identity.Account || "";
    } catch {
      cachedAccountId = "";
    }
  }

  return NextResponse.json({
    designAgentId: process.env.DESIGN_AGENT_ID || "",
    devAgentId: process.env.DEV_AGENT_ID || "",
    region,
    accountId: cachedAccountId,
  });
}
