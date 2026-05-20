import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { ARTIFACT_BUCKET } from "@/lib/workflow/agent-setup";

export const dynamic = "force-dynamic";

const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

/**
 * Validate workflow ID format.
 * Allows alphanumeric characters, underscores, and hyphens.
 */
function isValidWorkflowId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0 && id.length <= 128;
}

/**
 * Parse agent name from an S3 key path.
 *
 * Patterns:
 *   workflows/{id}/agents/{agent}/... → agent = "{agent}"
 *   workflows/{id}/shared/...         → agent = "shared"
 *   workflows/{id}/other/...          → agent = "unknown"
 */
function parseAgentFromKey(key: string, workflowId: string): string {
  const prefix = `workflows/${workflowId}/`;
  const relativePath = key.slice(prefix.length);

  if (relativePath.startsWith("agents/")) {
    // Extract agent name: agents/{agentName}/...
    const afterAgents = relativePath.slice("agents/".length);
    const slashIdx = afterAgents.indexOf("/");
    if (slashIdx > 0) {
      return afterAgents.slice(0, slashIdx);
    }
  }

  if (relativePath.startsWith("shared/")) {
    return "shared";
  }

  return "unknown";
}

/**
 * GET /api/workflow/[id]/artifacts
 *
 * Lists all S3 objects under the workflow prefix `workflows/{id}/`.
 * Returns artifact metadata including key, size, lastModified, and agent.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  if (!isValidWorkflowId(id)) {
    return NextResponse.json(
      { error: "Invalid workflow ID" },
      { status: 400 }
    );
  }

  if (!ARTIFACT_BUCKET) {
    return NextResponse.json(
      { error: "S3 bucket not configured" },
      { status: 500 }
    );
  }

  const prefix = `workflows/${id}/`;

  try {
    const artifacts: Array<{
      key: string;
      size: number;
      lastModified: string;
      agent: string;
    }> = [];

    let continuationToken: string | undefined;

    // Paginate through all objects under the prefix
    do {
      const response = await s3.send(
        new ListObjectsV2Command({
          Bucket: ARTIFACT_BUCKET,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );

      for (const obj of response.Contents || []) {
        if (!obj.Key || obj.Size === 0) continue; // Skip empty/directory markers

        artifacts.push({
          key: obj.Key,
          size: obj.Size || 0,
          lastModified: obj.LastModified?.toISOString() || "",
          agent: parseAgentFromKey(obj.Key, id),
        });
      }

      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return NextResponse.json(artifacts, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: unknown) {
    console.error(`[artifacts] Failed to list artifacts for workflow ${id}:`, err);
    return NextResponse.json(
      { error: "Failed to list artifacts" },
      { status: 500 }
    );
  }
}
