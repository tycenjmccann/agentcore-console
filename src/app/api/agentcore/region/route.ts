import { NextRequest } from "next/server";

// Server-side region state — mutable at runtime via POST
let currentRegion = process.env.AWS_REGION || "us-east-1";

// Regions where Bedrock AgentCore is available
const AGENTCORE_REGIONS = [
  "us-east-1",
  "us-west-2",
  "eu-west-1",
  "eu-central-1",
  "ap-southeast-1",
  "ap-northeast-1",
];

/**
 * GET /api/agentcore/region
 * Returns current region and available regions
 */
export async function GET() {
  return Response.json({
    current: currentRegion,
    available: AGENTCORE_REGIONS,
  });
}

/**
 * POST /api/agentcore/region
 * Switch the active region (clears caches)
 */
export async function POST(req: NextRequest) {
  const { region } = await req.json();

  if (!region || !AGENTCORE_REGIONS.includes(region)) {
    return Response.json(
      { error: `Invalid region. Available: ${AGENTCORE_REGIONS.join(", ")}` },
      { status: 400 }
    );
  }

  currentRegion = region;

  // Clear SDK singleton clients so they reconnect to new region
  // Dynamic import to avoid circular deps
  const { resetClients } = await import("@/lib/agentcore-sdk");
  resetClients(region);

  return Response.json({ current: currentRegion });
}

