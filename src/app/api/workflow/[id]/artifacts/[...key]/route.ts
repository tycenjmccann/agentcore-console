import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const s3 = new S3Client({ region: "us-east-1" });
const BUCKET = "agentcore-artifacts-023392223961-us-east-1";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; key: string[] } }
) {
  const workflowId = params.id;
  const keySegments = params.key;

  if (!keySegments || keySegments.length === 0) {
    return NextResponse.json(
      { error: "Artifact key is required" },
      { status: 400 }
    );
  }

  const s3Key = keySegments.join("/");
  const expectedPrefix = `workflows/${workflowId}/`;

  // Security: ensure the key belongs to this workflow
  if (!s3Key.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: "Invalid artifact key" },
      { status: 400 }
    );
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 300 });

    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Failed to generate presigned URL:", error);
    return NextResponse.json(
      { error: "Failed to download artifact" },
      { status: 500 }
    );
  }
}
