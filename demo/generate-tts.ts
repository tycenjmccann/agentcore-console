/**
 * TTS Generation Script
 *
 * Generates narration audio segments using AWS Polly neural voices.
 * Each scene gets its own MP3 file with precise duration tracking.
 *
 * Run: npx tsx demo/generate-tts.ts
 * Output: demo/audio/*.mp3 + demo/audio/manifest.json
 */

import { PollyClient, SynthesizeSpeechCommand, Engine } from "@aws-sdk/client-polly";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const AUDIO_DIR = path.join(__dirname, "audio");
const VOICE_ID = "Matthew"; // Professional male neural voice
const ENGINE: Engine = "neural";

// Scene narrations — each becomes one audio file
const SCENES = [
  {
    id: "01-intro",
    text: `This is AgentCore Console. An orchestration platform that turns feature requests into production-ready pull requests, using a team of AI agents. Let me show you what happens when I submit a real feature request.`,
  },
  {
    id: "02-navigate",
    text: `The workflow system accepts any feature description. A PRD, mockup URL, or just plain text. Each submission kicks off a team of specialized agents: requirements analysis, design, development, and code review.`,
  },
  {
    id: "03-submit",
    text: `I'm submitting a request to add light and dark mode with a theme toggle. The system will figure out the requirements, design the implementation, write the code, and open a pull request. All autonomously.`,
  },
  {
    id: "04-requirements",
    text: `First, the requirements agent analyzes the request and breaks it into tickets. It decides which specialists are needed. For a frontend-only change like this, it won't spin up backend or mobile agents.`,
  },
  {
    id: "05-design",
    text: `Design agents work in parallel. Each one produces specifications for their domain. They can query each other directly using agent-to-agent communication if they need clarification.`,
  },
  {
    id: "06-development",
    text: `Now the development agent takes over. It clones the repo, creates a feature branch, writes the implementation, and commits working code. It has access to a code interpreter sandbox for testing, and the full git toolkit.`,
  },
  {
    id: "07-pr-created",
    text: `The workflow is complete. A pull request has been created with the full implementation. CSS variables for theming, a toggle component in the header, and localStorage persistence. Let's merge it.`,
  },
  {
    id: "08-merge",
    text: `One click to merge. The code is production-ready. Written by an AI agent team that understands the codebase, follows existing patterns, and produces clean, reviewable pull requests.`,
  },
  {
    id: "09-result",
    text: `And there it is. Light and dark mode, built entirely by AI agents. From a one-sentence feature request to a merged pull request. This is the future of software development.`,
  },
  {
    id: "10-closing",
    text: `AgentCore Console. From idea to production in minutes, not days.`,
  },
];

async function generateAudio() {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  const polly = new PollyClient({ region: "us-east-1" });
  const manifest: Array<{ id: string; file: string; duration: number }> = [];

  console.log("Generating TTS audio segments...\n");

  for (const scene of SCENES) {
    const filename = `${scene.id}.mp3`;
    const filepath = path.join(AUDIO_DIR, filename);

    console.log(`  Generating: ${filename}`);

    const command = new SynthesizeSpeechCommand({
      Text: scene.text,
      OutputFormat: "mp3",
      VoiceId: VOICE_ID,
      Engine: ENGINE,
      SampleRate: "24000",
    });

    const result = await polly.send(command);

    if (!result.AudioStream) {
      console.error(`  ERROR: No audio stream for ${scene.id}`);
      continue;
    }

    // Write audio to file
    const audioBytes = await result.AudioStream.transformToByteArray();
    fs.writeFileSync(filepath, Buffer.from(audioBytes));

    // Get duration using ffprobe
    const duration = parseFloat(
      execSync(
        `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filepath}"`,
        { encoding: "utf-8" }
      ).trim()
    );

    manifest.push({ id: scene.id, file: filename, duration });
    console.log(`    Duration: ${duration.toFixed(2)}s`);
  }

  // Write manifest
  const manifestPath = path.join(AUDIO_DIR, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written to: ${manifestPath}`);

  // Calculate total narration time
  const totalDuration = manifest.reduce((sum, s) => sum + s.duration, 0);
  console.log(`Total narration: ${totalDuration.toFixed(1)}s (${(totalDuration / 60).toFixed(1)} min)`);
}

generateAudio().catch(console.error);
