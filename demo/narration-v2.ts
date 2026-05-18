/**
 * V2 Narration Script — Agentis Hub Demo
 *
 * Generates TTS audio via AWS Polly for each scene segment.
 * Run: npx ts-node demo/narration-v2.ts
 */

import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = path.join(__dirname, "audio-v2");
const polly = new PollyClient({ region: "us-east-1" });

interface Segment {
  id: string;
  text: string;
}

const SEGMENTS: Segment[] = [
  {
    id: "01-intro",
    text: `This is Agentis Hub — our AI agent orchestration console powered by Amazon Bedrock AgentCore. It manages a team of specialized agents that collaborate on real product work, from requirements to implementation.`,
  },
  {
    id: "02-dashboard-context",
    text: `Here on the dashboard you can see our agent fleet has handled over 500 invocations across 26 active agents. Notice something — the entire console is locked into dark mode. There's no theme toggle anywhere. That's exactly what we're about to fix.`,
  },
  {
    id: "03-ticket-history",
    text: `Let's look at the ticket history. You can see past sessions where agents have completed real work — each one tied to a Jira ticket, with full trace visibility showing which agent handled what.`,
  },
  {
    id: "04-workflow-intro",
    text: `Now let's submit a new feature. We go to the Workflow page and describe what we want: add a light slash dark mode theme toggle. We provide the requirements, the target repository, and select Claude Opus 4 as the model.`,
  },
  {
    id: "05-submit",
    text: `We hit submit. The system creates a Jira epic and kicks off the pipeline. First up — the Requirements Analyst agent parses our input and produces structured requirements with acceptance criteria.`,
  },
  {
    id: "06-design",
    text: `Requirements are done. The engine automatically creates child tickets and assigns them to the next agents. The Backend Designer picks up its ticket and produces a complete theme architecture — CSS custom properties, provider pattern, anti-flash strategy.`,
  },
  {
    id: "07-development",
    text: `Design is complete. The development ticket was blocked on design — now it auto-unblocks and the Frontend Developer agent takes over. It clones the repo, creates a feature branch, implements the full theme system, runs tests, and pushes.`,
  },
  {
    id: "08-complete",
    text: `And just like that — workflow complete. Three agents collaborated autonomously: requirements, design, and implementation. A feature branch is ready with a commit hash. All tickets are resolved.`,
  },
  {
    id: "09-before-after",
    text: `Here's the result. Before — the console was dark-mode only. After — a working theme toggle in the header. Light mode, dark mode, respects system preferences, and persists across reloads. Built entirely by the agent team in under a minute.`,
  },
  {
    id: "10-closing",
    text: `That's Agentis Hub. Real agents, real code, real collaboration — orchestrated end to end.`,
  },
];

async function generateSegment(segment: Segment): Promise<number> {
  const command = new SynthesizeSpeechCommand({
    Text: segment.text,
    OutputFormat: "mp3",
    VoiceId: "Matthew", // Neural male voice
    Engine: "neural",
    TextType: "text",
  });

  const response = await polly.send(command);
  if (!response.AudioStream) throw new Error(`No audio for ${segment.id}`);

  const chunks: Uint8Array[] = [];
  const reader = response.AudioStream as AsyncIterable<Uint8Array>;
  for await (const chunk of reader) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  const outPath = path.join(OUTPUT_DIR, `${segment.id}.mp3`);
  fs.writeFileSync(outPath, buffer);

  // Get duration via file size estimate (rough: MP3 at ~48kbps neural = ~6KB/s)
  // We'll get exact durations from ffprobe after
  const approxDuration = buffer.length / 6000;
  console.log(`  ${segment.id}: ${(buffer.length / 1024).toFixed(1)}KB (~${approxDuration.toFixed(1)}s)`);
  return approxDuration;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log("Generating v2 narration segments...\n");

  const manifest: { id: string; file: string; duration: number }[] = [];

  for (const segment of SEGMENTS) {
    const duration = await generateSegment(segment);
    manifest.push({ id: segment.id, file: `${segment.id}.mp3`, duration });
  }

  // Write manifest (durations will be updated by ffprobe pass)
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  console.log("\nDone! Run ffprobe to get exact durations:");
  console.log(`  for f in ${OUTPUT_DIR}/*.mp3; do echo "$f: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")s"; done`);
}

main().catch(console.error);
