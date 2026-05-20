import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
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
 * Determine the Content-Type based on file extension.
 */
function getContentType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";

  const mimeMap: Record<string, string> = {
    // Text / Code
    ts: "text/typescript",
    tsx: "text/typescript",
    js: "application/javascript",
    jsx: "application/javascript",
    json: "application/json",
    md: "text/markdown",
    css: "text/css",
    html: "text/html",
    xml: "application/xml",
    yaml: "text/yaml",
    yml: "text/yaml",
    txt: "text/plain",
    py: "text/x-python",
    rs: "text/x-rust",
    go: "text/x-go",
    java: "text/x-java",
    sh: "text/x-shellscript",
    sql: "text/x-sql",
    csv: "text/csv",
    svg: "image/svg+xml",
    // Images
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
  };

  return mimeMap[ext] || "text/plain";
}

/**
 * GET /api/workflow/[id]/artifacts/[...path]
 *
 * Returns the content of a specific artifact from S3.
 * The path segments are joined to construct the full S3 key.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; path: string[] } }
) {
  const { id, path } = params;

  if (!isValidWorkflowId(id)) {
    return NextResponse.json(
      { error: "Invalid workflow ID" },
      { status: 400 }
    );
  }

  if (!path || path.length === 0) {
    return NextResponse.json(
      { error: "File path is required" },
      { status: 400 }
    );
  }

  if (!ARTIFACT_BUCKET) {
    return NextResponse.json(
      { error: "S3 bucket not configured" },
      { status: 500 }
    );
  }

  // Construct full S3 key: workflows/{id}/{path segments joined}
  const filePath = path.join("/");
  const s3Key = `workflows/${id}/${filePath}`;

  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: ARTIFACT_BUCKET,
        Key: s3Key,
      })
    );

    const body = await response.Body?.transformToString();

    if (body === undefined || body === null) {
      return NextResponse.json(
        { error: "Artifact not found" },
        { status: 404 }
      );
    }

    const contentType = getContentType(filePath);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const errName = (err as { name?: string })?.name || "";

    if (errName === "NoSuchKey" || errName === "NotFound") {
      return NextResponse.json(
        { error: "Artifact not found" },
        { status: 404 }
      );
    }

    console.error(
      `[artifacts] Failed to get artifact ${s3Key} for workflow ${id}:`,
      err
    );
    return NextResponse.json(
      { error: "Failed to retrieve artifact" },
      { status: 500 }
    );
  }
}
