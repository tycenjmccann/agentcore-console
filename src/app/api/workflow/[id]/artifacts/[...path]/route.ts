/**
 * GET /api/workflow/[id]/artifacts/[...path]
 * Fetch the content of a specific artifact file from S3.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

const S3_BUCKET = process.env.TEAM_WORKFLOW_S3_BUCKET || "";
const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; path: string[] } }
) {
  const workflowId = params.id;
  const pathSegments = params.path;

  if (!workflowId || !pathSegments || pathSegments.length === 0) {
    return NextResponse.json(
      { error: "Missing workflow ID or path" },
      { status: 400 }
    );
  }

  if (!S3_BUCKET) {
    return NextResponse.json(
      { error: "S3 bucket not configured" },
      { status: 500 }
    );
  }

  const filePath = pathSegments.join("/");
  const s3Key = `workflows/${workflowId}/${filePath}`;

  try {
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
      })
    );

    const body = await res.Body?.transformToString();

    if (!body && body !== "") {
      return NextResponse.json(
        { error: "Empty file or not found" },
        { status: 404 }
      );
    }

    // Determine content type from file extension
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const contentType = getContentType(ext);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err: unknown) {
    const error = err as { name?: string; message?: string };
    if (error.name === "NoSuchKey" || error.name === "NotFound") {
      return NextResponse.json(
        { error: "Artifact not found" },
        { status: 404 }
      );
    }
    console.error("[artifacts] Failed to fetch content:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch artifact" },
      { status: 500 }
    );
  }
}

function getContentType(ext: string): string {
  switch (ext) {
    case "json":
      return "application/json";
    case "md":
      return "text/markdown";
    case "ts":
    case "tsx":
      return "text/typescript";
    case "js":
    case "jsx":
      return "text/javascript";
    case "css":
      return "text/css";
    case "html":
      return "text/html";
    default:
      return "text/plain";
  }
}
