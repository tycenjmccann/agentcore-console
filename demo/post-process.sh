#!/bin/bash
#
# Post-Processing Script
#
# Takes the raw recording + TTS audio segments and produces the final demo video.
# Strategy: Split raw video into segments, speed up the "waiting" parts, then
# concatenate and overlay audio.
#
# Usage: ./demo/post-process.sh
#
# Inputs:
#   demo/recordings/raw-demo.webm  — Full recording
#   demo/audio/*.mp3               — TTS narration segments
#   demo/audio/manifest.json       — Timing manifest
#
# Output:
#   demo/output/final-demo.mp4     — Final video with narration

set -e

DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
RECORDINGS_DIR="$DEMO_DIR/recordings"
AUDIO_DIR="$DEMO_DIR/audio"
OUTPUT_DIR="$DEMO_DIR/output"
TEMP_DIR="$DEMO_DIR/temp"

RAW_VIDEO="$RECORDINGS_DIR/raw-demo.webm"

mkdir -p "$OUTPUT_DIR" "$TEMP_DIR"

echo "=== Post-Processing Demo Video ==="
echo ""

# Step 1: Get raw video duration
RAW_DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$RAW_VIDEO")
echo "Raw video duration: ${RAW_DURATION}s"

# Step 2: Concatenate all audio segments into one track with gaps
echo ""
echo "Step 2: Building narration track..."

# Read manifest and create a combined audio with gaps between segments
# The gaps correspond to speedup sections
MANIFEST="$AUDIO_DIR/manifest.json"

if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: manifest.json not found. Run generate-tts.ts first."
  exit 1
fi

# Create combined narration with silence gaps for agent-working sections
# Gap durations (these are the target durations AFTER speedup for each waiting section)
GAP_AFTER_INTRO=2        # Brief pause before showing form
GAP_AFTER_NAVIGATE=1     # Brief pause
GAP_AFTER_SUBMIT=2       # Watch the submit animation
GAP_AFTER_REQUIREMENTS=3 # Sped-up requirements phase
GAP_AFTER_DESIGN=3       # Sped-up design phase
GAP_AFTER_DEVELOPMENT=5  # Sped-up dev phase (show more)
GAP_AFTER_PR=2           # Pause on PR
GAP_AFTER_MERGE=2        # Watch deployment
GAP_AFTER_RESULT=1       # Brief before closing

# Build the audio filter complex for concatenation with gaps
echo "  Concatenating audio segments with gaps..."

# Generate silence files for gaps
ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t $GAP_AFTER_INTRO "$TEMP_DIR/gap1.mp3" -loglevel error
ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t $GAP_AFTER_NAVIGATE "$TEMP_DIR/gap2.mp3" -loglevel error
ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t $GAP_AFTER_SUBMIT "$TEMP_DIR/gap3.mp3" -loglevel error
ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t $GAP_AFTER_REQUIREMENTS "$TEMP_DIR/gap4.mp3" -loglevel error
ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t $GAP_AFTER_DESIGN "$TEMP_DIR/gap5.mp3" -loglevel error
ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t $GAP_AFTER_DEVELOPMENT "$TEMP_DIR/gap6.mp3" -loglevel error
ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t $GAP_AFTER_PR "$TEMP_DIR/gap7.mp3" -loglevel error
ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t $GAP_AFTER_MERGE "$TEMP_DIR/gap8.mp3" -loglevel error
ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t $GAP_AFTER_RESULT "$TEMP_DIR/gap9.mp3" -loglevel error

# Create file list for concat
cat > "$TEMP_DIR/audio-list.txt" << EOF
file '../audio/01-intro.mp3'
file 'gap1.mp3'
file '../audio/02-navigate.mp3'
file 'gap2.mp3'
file '../audio/03-submit.mp3'
file 'gap3.mp3'
file '../audio/04-requirements.mp3'
file 'gap4.mp3'
file '../audio/05-design.mp3'
file 'gap5.mp3'
file '../audio/06-development.mp3'
file 'gap6.mp3'
file '../audio/07-pr-created.mp3'
file 'gap7.mp3'
file '../audio/08-merge.mp3'
file 'gap8.mp3'
file '../audio/09-result.mp3'
file 'gap9.mp3'
file '../audio/10-closing.mp3'
EOF

ffmpeg -y -f concat -safe 0 -i "$TEMP_DIR/audio-list.txt" -c:a libmp3lame -q:a 2 "$TEMP_DIR/full-narration.mp3" -loglevel error
NARRATION_DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TEMP_DIR/full-narration.mp3")
echo "  Narration track: ${NARRATION_DURATION}s"

# Step 3: Speed up the raw video to match narration duration
echo ""
echo "Step 3: Processing video..."

# Calculate speedup factor
# We want the video to be roughly the same duration as narration (or slightly longer)
SPEED_FACTOR=$(echo "$RAW_DURATION / $NARRATION_DURATION" | bc -l)
echo "  Raw: ${RAW_DURATION}s, Target: ${NARRATION_DURATION}s"
echo "  Overall speed factor: ${SPEED_FACTOR}x"

# If video is much longer than narration, do a uniform speedup
# (A more sophisticated version would speed up only the waiting sections)
if (( $(echo "$SPEED_FACTOR > 1.5" | bc -l) )); then
  echo "  Applying uniform ${SPEED_FACTOR}x speedup to video..."
  # PTS = 1/speed (speed up), atempo chains for >2x
  PTS_FACTOR=$(echo "1 / $SPEED_FACTOR" | bc -l)

  # For video speeds > 2x, we need to chain atempo filters
  if (( $(echo "$SPEED_FACTOR > 4" | bc -l) )); then
    # Chain: 2x * 2x * remainder
    REMAINING=$(echo "$SPEED_FACTOR / 4" | bc -l)
    ATEMPO="atempo=2.0,atempo=2.0,atempo=$REMAINING"
  elif (( $(echo "$SPEED_FACTOR > 2" | bc -l) )); then
    REMAINING=$(echo "$SPEED_FACTOR / 2" | bc -l)
    ATEMPO="atempo=2.0,atempo=$REMAINING"
  else
    ATEMPO="atempo=$SPEED_FACTOR"
  fi

  ffmpeg -y -i "$RAW_VIDEO" \
    -filter:v "setpts=${PTS_FACTOR}*PTS" \
    -an \
    -c:v libx264 -preset fast -crf 23 \
    "$TEMP_DIR/video-sped.mp4" -loglevel warning

  VIDEO_FOR_MERGE="$TEMP_DIR/video-sped.mp4"
else
  echo "  Video length is close to narration, using as-is."
  # Just transcode to mp4
  ffmpeg -y -i "$RAW_VIDEO" -c:v libx264 -preset fast -crf 23 -an "$TEMP_DIR/video-sped.mp4" -loglevel warning
  VIDEO_FOR_MERGE="$TEMP_DIR/video-sped.mp4"
fi

PROCESSED_DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO_FOR_MERGE")
echo "  Processed video: ${PROCESSED_DURATION}s"

# Step 4: Merge video + audio
echo ""
echo "Step 4: Merging video + narration..."

ffmpeg -y \
  -i "$VIDEO_FOR_MERGE" \
  -i "$TEMP_DIR/full-narration.mp3" \
  -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 192k \
  -shortest \
  "$OUTPUT_DIR/final-demo.mp4" -loglevel warning

FINAL_DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUTPUT_DIR/final-demo.mp4")

echo ""
echo "=== Done ==="
echo "Output: $OUTPUT_DIR/final-demo.mp4"
echo "Duration: ${FINAL_DURATION}s ($(echo "$FINAL_DURATION / 60" | bc -l | cut -c1-4) min)"
echo "Resolution: $(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$OUTPUT_DIR/final-demo.mp4")"

# Cleanup temp
# rm -rf "$TEMP_DIR"  # Uncomment after verifying output
