/**
 * Fetch per-agent token usage via raw HTTPS + AWS SigV4 signing.
 * Bypasses the AWS SDK entirely to avoid any Next.js bundling/caching interference.
 */
import { createHash, createHmac } from "crypto";
import https from "https";

const REGION = process.env.AWS_REGION || "us-east-1";
const SERVICE = "logs";

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function getSignatureKey(key: string, date: string, region: string, service: string): Buffer {
  const kDate = hmacSha256("AWS4" + key, date);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

async function getCredentials(): Promise<Credentials> {
  // Try ECS/App Runner container credentials endpoint first
  const relativeUri = process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI;
  if (relativeUri) {
    const resp = await new Promise<string>((resolve, reject) => {
      const req = require("http").get(`http://169.254.170.2${relativeUri}`, (res: any) => {
        let data = "";
        res.on("data", (chunk: string) => data += chunk);
        res.on("end", () => resolve(data));
      });
      req.on("error", reject);
      req.setTimeout(2000, () => { req.destroy(); reject(new Error("timeout")); });
    });
    const creds = JSON.parse(resp);
    return {
      accessKeyId: creds.AccessKeyId,
      secretAccessKey: creds.SecretAccessKey,
      sessionToken: creds.Token,
    };
  }
  // Try env vars
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    };
  }
  // Fallback: resolve via AWS CLI credential_process / shared credentials
  try {
    const { execSync } = require("child_process");
    const profile = process.env.AWS_PROFILE || "default";
    const output = execSync(
      `aws configure export-credentials --profile ${profile} --format process 2>/dev/null`,
      { timeout: 5000, encoding: "utf-8" }
    );
    const creds = JSON.parse(output);
    return {
      accessKeyId: creds.AccessKeyId,
      secretAccessKey: creds.SecretAccessKey,
      sessionToken: creds.SessionToken,
    };
  } catch {
    return { accessKeyId: "", secretAccessKey: "", sessionToken: undefined };
  }
}

export async function cwLogsRequest(action: string, payload: object): Promise<any> {
  const creds = await getCredentials();
  const host = `logs.${REGION}.amazonaws.com`;
  const body = JSON.stringify(payload);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaders = [
    `content-type:application/x-amz-json-1.1`,
    `host:${host}`,
    `x-amz-date:${amzDate}`,
    `x-amz-target:Logs_20140328.${action}`,
    ...(creds.sessionToken ? [`x-amz-security-token:${creds.sessionToken}`] : []),
  ].sort().join("\n") + "\n";

  const signedHeadersList = [
    "content-type",
    "host",
    "x-amz-date",
    "x-amz-target",
    ...(creds.sessionToken ? ["x-amz-security-token"] : []),
  ].sort();
  const signedHeaders = signedHeadersList.join(";");

  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    sha256(body),
  ].join("\n");

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const signingKey = getSignatureKey(creds.secretAccessKey, dateStamp, REGION, SERVICE);
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/x-amz-json-1.1",
    "X-Amz-Date": amzDate,
    "X-Amz-Target": `Logs_20140328.${action}`,
    Authorization: authorization,
  };
  if (creds.sessionToken) {
    headers["X-Amz-Security-Token"] = creds.sessionToken;
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: host, port: 443, path: "/", method: "POST", headers },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`CW Logs ${action} failed: ${res.statusCode} ${data.slice(0, 200)}`));
          } else {
            resolve(JSON.parse(data));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("timeout")); });
    req.write(body);
    req.end();
  });
}

export interface ModelTokenUsage {
  model: string;
  input: number;
  output: number;
}

export interface AgentTokenResult {
  input: number;
  output: number;
  byModel: ModelTokenUsage[];
}

export async function fetchAgentTokens(
  logGroup: string,
  startTime: number,
  endTime: number
): Promise<AgentTokenResult> {
  // Accumulate tokens grouped by model
  const modelMap: Record<string, { input: number; output: number }> = {};
  let nextToken: string | undefined = undefined;

  try {
    while (true) {
      const payload: any = {
        logGroupName: logGroup,
        startTime,
        endTime,
        filterPattern: "gen_ai.client.token.usage",
        limit: 10000,
      };
      if (nextToken) payload.nextToken = nextToken;

      const resp = await cwLogsRequest("FilterLogEvents", payload);
      const events = resp.events || [];

      for (let i = 0; i < events.length; i++) {
        const message = events[i].message || "";
        const braceIndex = message.indexOf("{");
        if (braceIndex < 0) continue;
        try {
          const parsed = JSON.parse(message.slice(braceIndex));
          const tokenType = parsed["gen_ai.token.type"];
          const usageSum = Number(parsed["gen_ai.client.token.usage"]?.Sum) || 0;
          const model = parsed["gen_ai.request.model"] || "unknown";

          if (!modelMap[model]) modelMap[model] = { input: 0, output: 0 };
          if (tokenType === "input") modelMap[model].input += usageSum;
          else if (tokenType === "output") modelMap[model].output += usageSum;
        } catch {
          // skip malformed
        }
      }

      nextToken = resp.nextToken;
      if (!nextToken) break;
    }
  } catch {
    // log group may not exist or credentials unavailable
  }

  // Compute totals
  let totalInput = 0;
  let totalOutput = 0;
  const byModel: ModelTokenUsage[] = [];
  for (const [model, usage] of Object.entries(modelMap)) {
    totalInput += usage.input;
    totalOutput += usage.output;
    byModel.push({ model, input: usage.input, output: usage.output });
  }

  return { input: totalInput, output: totalOutput, byModel };
}
