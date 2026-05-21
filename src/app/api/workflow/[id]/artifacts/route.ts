import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const s3 = new S3Client({ region: "us-east-1" });
const BUCKET = "agentcore-artifacts-023392223961-us-east-1";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const workflowId = params.id;
  const prefix = `workflows/${workflowId}/`;

  try {
    const files: { key: string; size: number; lastModified: string; name: string }[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await s3.send(
        new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );

      for (const obj of response.Contents || []) {
        if (!obj.Key || obj.Key === prefix) continue;

        const segments = obj.Key.split("/");
        const name = segments[segments.length - 1];

        // Skip "folder" markers (keys ending with /)
        if (!name) continue;

        files.push({
          key: obj.Key,
          size: obj.Size ?? 0,
          lastModified: obj.LastModified?.toISOString() ?? "",
          name,
        });
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return NextResponse.json(
      { files },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Failed to list artifacts:", error);
    return NextResponse.json(
      { error: "Failed to list artifacts" },
      { status: 500 }
    );
  }
}
