/**
 * GET /api/workflow/[id]/artifacts
 * List all artifacts (S3 objects) for a workflow, grouped by agent.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

const S3_BUCKET = process.env.TEAM_WORKFLOW_S3_BUCKET || "";
const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const workflowId = params.id;

  if (!workflowId) {
    return NextResponse.json(
      { error: "Missing workflow ID" },
      { status: 400 }
    );
  }

  if (!S3_BUCKET) {
    return NextResponse.json(
      { error: "S3 bucket not configured" },
      { status: 500 }
    );
  }

  try {
    const prefix = `workflows/${workflowId}/`;
    const allObjects: {
      key: string;
      size: number;
      lastModified: string;
      agent: string;
    }[] = [];

    let continuationToken: string | undefined;

    do {
      const listRes = await s3.send(
        new ListObjectsV2Command({
          Bucket: S3_BUCKET,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        })
      );

      for (const obj of listRes.Contents || []) {
        if (!obj.Key || obj.Size === 0) continue;

        // Skip workflow state files
        if (obj.Key.includes("workflow-state/")) continue;

        const agent = parseAgentFromKey(obj.Key, workflowId);

        allObjects.push({
          key: obj.Key,
          size: obj.Size || 0,
          lastModified: obj.LastModified?.toISOString() || "",
          agent,
        });
      }

      continuationToken = listRes.NextContinuationToken;
    } while (continuationToken);

    return NextResponse.json(allObjects);
  } catch (err) {
    console.error("[artifacts] Failed to list:", err);
    return NextResponse.json(
      { error: "Failed to list artifacts" },
      { status: 500 }
    );
  }
}

/**
 * Extract agent name from S3 key.
 * Patterns:
 *   workflows/{id}/agents/{agentName}/...
 *   workflows/{id}/shared/...
 */
function parseAgentFromKey(key: string, workflowId: string): string {
  const relativePath = key.replace(`workflows/${workflowId}/`, "");
  const parts = relativePath.split("/");

  if (parts[0] === "agents" && parts.length > 1) {
    return parts[1];
  }
  if (parts[0] === "shared") {
    return "shared";
  }
  return "other";
}
