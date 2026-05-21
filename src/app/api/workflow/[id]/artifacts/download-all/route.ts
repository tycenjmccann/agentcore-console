import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const s3 = new S3Client({ region: "us-east-1" });
const BUCKET = "agentcore-artifacts-023392223961-us-east-1";

async function streamToBuffer(stream: ReadableStream | NodeJS.ReadableStream | null): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);

  // Handle Web ReadableStream
  if ("getReader" in stream) {
    const reader = (stream as ReadableStream).getReader();
    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) chunks.push(result.value);
    }
    return Buffer.concat(chunks);
  }

  // Handle Node.js Readable
  const chunks: Buffer[] = [];
  for await (const chunk of stream as NodeJS.ReadableStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string | Uint8Array));
  }
  return Buffer.concat(chunks);
}

/**
 * Minimal ZIP file creation without external dependencies.
 * Produces a valid ZIP archive using the STORE method (no compression).
 * This avoids adding JSZip as a dependency for a single endpoint.
 */
function createZipArchive(
  entries: { path: string; data: Buffer }[]
): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const pathBuf = Buffer.from(entry.path, "utf-8");
    const data = entry.data;

    // CRC-32 calculation
    const crc = crc32(data);

    // Local file header (30 bytes + path + data)
    const local = Buffer.alloc(30 + pathBuf.length + data.length);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // compression: STORE
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(crc, 14); // crc-32
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(pathBuf.length, 26); // file name length
    local.writeUInt16LE(0, 28); // extra field length
    pathBuf.copy(local, 30);
    data.copy(local, 30 + pathBuf.length);

    localHeaders.push(local);

    // Central directory header (46 bytes + path)
    const central = Buffer.alloc(46 + pathBuf.length);
    central.writeUInt32LE(0x02014b50, 0); // signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // compression: STORE
    central.writeUInt16LE(0, 12); // mod time
    central.writeUInt16LE(0, 14); // mod date
    central.writeUInt32LE(crc, 16); // crc-32
    central.writeUInt32LE(data.length, 20); // compressed size
    central.writeUInt32LE(data.length, 24); // uncompressed size
    central.writeUInt16LE(pathBuf.length, 28); // file name length
    central.writeUInt16LE(0, 30); // extra field length
    central.writeUInt16LE(0, 32); // file comment length
    central.writeUInt16LE(0, 34); // disk number start
    central.writeUInt16LE(0, 36); // internal file attributes
    central.writeUInt32LE(0, 38); // external file attributes
    central.writeUInt32LE(offset, 42); // relative offset of local header
    pathBuf.copy(central, 46);

    centralHeaders.push(central);
    offset += local.length;
  }

  // End of central directory
  const centralDirSize = centralHeaders.reduce((s, b) => s + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // central dir disk
  eocd.writeUInt16LE(entries.length, 8); // entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralDirSize, 12); // central dir size
  eocd.writeUInt32LE(offset, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

/** CRC-32 lookup table */
const CRC_TABLE: number[] = [];
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const workflowId = params.id;
  const prefix = `workflows/${workflowId}/`;

  try {
    // Collect all object keys
    const objectKeys: string[] = [];
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
        // Skip folder markers
        if (obj.Key.endsWith("/")) continue;
        objectKeys.push(obj.Key);
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    if (objectKeys.length === 0) {
      return NextResponse.json(
        { error: "No artifacts found for this workflow" },
        { status: 404 }
      );
    }

    // Fetch all objects and build ZIP entries
    const entries: { path: string; data: Buffer }[] = [];

    await Promise.all(
      objectKeys.map(async (key) => {
        const response = await s3.send(
          new GetObjectCommand({ Bucket: BUCKET, Key: key })
        );

        const relativePath = key.slice(prefix.length);
        const data = await streamToBuffer(
          response.Body as ReadableStream | NodeJS.ReadableStream | null
        );

        entries.push({ path: relativePath, data });
      })
    );

    // Sort entries by path for consistent output
    entries.sort((a, b) => a.path.localeCompare(b.path));

    const zipBuffer = createZipArchive(entries);

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="workflow-${workflowId}-artifacts.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to create artifacts ZIP:", error);
    return NextResponse.json(
      { error: "Failed to download artifacts" },
      { status: 500 }
    );
  }
}
