#!/bin/bash
#
# V2 Post-Processing — SYNCED Audio (v3 - concat approach)
#
# Uses sequential concat with silence gaps to place narration at precise timestamps.
# This avoids the amix volume-division bug and prevents audio overlap.
#
# Usage: ./demo/post-process-v2-synced.sh

set -e

DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
RECORDINGS_DIR="$DEMO_DIR/recordings"
AUDIO_DIR="$DEMO_DIR/audio-v2"
MOCKUPS_DIR="$DEMO_DIR/mockups"
OUTPUT_DIR="$DEMO_DIR/output"
TEMP_DIR="$DEMO_DIR/temp-v2-sync"

RAW_VIDEO="$RECORDINGS_DIR/raw-demo-v2.webm"
BEFORE_IMG="$MOCKUPS_DIR/before.png"
AFTER_IMG="$MOCKUPS_DIR/after.png"

mkdir -p "$OUTPUT_DIR" "$TEMP_DIR"

echo "=== V2 Synced Post-Processing: Agentis Hub Demo (v3) ==="
echo ""

# ─── Step 1: Build the video track ───────────────────────────────────
echo "Step 1: Building video track..."

# Before mockup: 18 seconds (fits entire intro narration ~16.4s)
ffmpeg -y -loop 1 -i "$BEFORE_IMG" -c:v libx264 -t 18 -pix_fmt yuv420p -vf "scale=1920:1080" \
  -r 30 "$TEMP_DIR/before.mp4" -loglevel warning

# Trim raw recording (skip first 8s of loading)
ffmpeg -y -ss 8 -i "$RAW_VIDEO" \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
  -vf "scale=1920:1080" -r 30 -an \
  "$TEMP_DIR/main.mp4" -loglevel warning

MAIN_DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TEMP_DIR/main.mp4")

# After mockup: 25s (fits before-after + closing narration from ~119s)
ffmpeg -y -loop 1 -i "$AFTER_IMG" -c:v libx264 -t 25 -pix_fmt yuv420p -vf "scale=1920:1080" \
  -r 30 "$TEMP_DIR/after.mp4" -loglevel warning

# Concatenate video segments
cat > "$TEMP_DIR/concat-list.txt" << EOF
file 'before.mp4'
file 'main.mp4'
file 'after.mp4'
EOF

ffmpeg -y -f concat -safe 0 -i "$TEMP_DIR/concat-list.txt" \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
  "$TEMP_DIR/video-combined.mp4" -loglevel warning

VIDEO_DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TEMP_DIR/video-combined.mp4")
echo "  Video: ${VIDEO_DURATION}s (before:18s + main:${MAIN_DURATION}s + after:25s)"
echo ""

# ─── Step 2: Build narration with concat + silence gaps ──────────────
echo "Step 2: Building synced narration track (concat method)..."

# Video scenes in FINAL timeline (before=18s offset):
#   0-18s: Before still (frame from recording)
#   18-120s: Main recording (raw recording trimmed from 8s)
#   120-145s: After still (light mode screenshot)

# Audio durations (from ElevenLabs v3 manifest):
# 01: 16.431, 02: 17.554, 03: 9.247, 04: 12.748
# 05: 12.121, 06: 15.882, 07: 17.711, 08: 13.714
# 09: 14.916, 10: 7.001

# Target start times (no overlap — each starts after previous ends):
# T01=0     ends@16.4  → before still ✓
# T02=17    ends@34.6  → dashboard ✓
# T03=35    ends@44.2  → ticket history ✓
# T04=45    ends@57.7  → workflow form ✓
# T05=58    ends@70.1  → submit + requirements ✓
# T06=71    ends@86.9  → design phase ✓
# T07=87    ends@104.7 → dev phase ✓
# T08=105   ends@118.7 → completion ✓
# T09=119   ends@133.9 → after still (before-after) ✓
# T10=135   ends@142.0 → closing ✓

declare -a STARTS=(0 17 35 45 58 71 87 105 119 135)
declare -a DURATIONS=(16.431 17.554 9.247 12.748 12.121 15.882 17.711 13.714 14.916 7.001)
declare -a FILES=(
  "$AUDIO_DIR/01-intro.mp3"
  "$AUDIO_DIR/02-dashboard-context.mp3"
  "$AUDIO_DIR/03-ticket-history.mp3"
  "$AUDIO_DIR/04-workflow-intro.mp3"
  "$AUDIO_DIR/05-submit.mp3"
  "$AUDIO_DIR/06-design.mp3"
  "$AUDIO_DIR/07-development.mp3"
  "$AUDIO_DIR/08-complete.mp3"
  "$AUDIO_DIR/09-before-after.mp3"
  "$AUDIO_DIR/10-closing.mp3"
)

# Build concat list: silence_gap + audio_segment for each entry
AUDIO_CONCAT="$TEMP_DIR/audio-concat-list.txt"
> "$AUDIO_CONCAT"

CURRENT_POS=0
for i in "${!STARTS[@]}"; do
  TARGET_START=${STARTS[$i]}

  # Calculate gap needed before this segment
  GAP=$(python3 -c "print(max(0, $TARGET_START - $CURRENT_POS))")

  if (( $(python3 -c "print(1 if $GAP > 0.01 else 0)") )); then
    # Generate silence file for this gap
    ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t "$GAP" \
      -c:a libmp3lame -q:a 2 "$TEMP_DIR/silence_${i}.mp3" -loglevel error
    echo "file 'silence_${i}.mp3'" >> "$AUDIO_CONCAT"
  fi

  echo "file '${FILES[$i]}'" >> "$AUDIO_CONCAT"

  # Update position
  CURRENT_POS=$(python3 -c "print($TARGET_START + ${DURATIONS[$i]})")

  echo "  Segment $((i+1)): starts@${TARGET_START}s (gap=${GAP}s)"
done

# Concatenate all audio segments with gaps
ffmpeg -y -f concat -safe 0 -i "$AUDIO_CONCAT" \
  -c:a libmp3lame -q:a 2 "$TEMP_DIR/synced-narration.mp3" -loglevel warning

NARRATION_DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TEMP_DIR/synced-narration.mp3")
echo ""
echo "  Total narration track: ${NARRATION_DURATION}s"

# ─── Step 3: Merge video + audio ─────────────────────────────────────
echo ""
echo "Step 3: Merging video + narration..."

ffmpeg -y \
  -i "$TEMP_DIR/video-combined.mp4" \
  -i "$TEMP_DIR/synced-narration.mp3" \
  -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 192k \
  -shortest \
  "$OUTPUT_DIR/final-demo-v2.mp4" -loglevel warning

FINAL_DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUTPUT_DIR/final-demo-v2.mp4")
FINAL_SIZE=$(du -h "$OUTPUT_DIR/final-demo-v2.mp4" | cut -f1)

echo ""
echo "=== Done ==="
echo "Output: $OUTPUT_DIR/final-demo-v2.mp4"
echo "Duration: ${FINAL_DURATION}s (~$(python3 -c "print(f'{float($FINAL_DURATION)/60:.1f}')" 2>/dev/null || echo "2") min)"
echo "Size: $FINAL_SIZE"
echo "Resolution: 1920x1080"
echo ""
echo "Audio sync points:"
echo "  Before still (0s) ← 01-intro"
echo "  Dashboard (17s) ← 02-dashboard-context"
echo "  Ticket Hist (35s) ← 03-ticket-history"
echo "  Workflow (45s) ← 04-workflow-intro"
echo "  Submit (58s) ← 05-submit"
echo "  Design (71s) ← 06-design"
echo "  Dev (87s) ← 07-development"
echo "  Complete (105s) ← 08-complete"
echo "  Before/After (119s) ← 09-before-after"
echo "  Closing (135s) ← 10-closing"
