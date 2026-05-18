#!/bin/bash
#
# V2 Post-Processing Script — Agentis Hub Demo
#
# Combines: before mockup + trimmed raw recording + after mockup + narration
#
# Usage: ./demo/post-process-v2.sh

set -e

DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
RECORDINGS_DIR="$DEMO_DIR/recordings"
AUDIO_DIR="$DEMO_DIR/audio-v2"
MOCKUPS_DIR="$DEMO_DIR/mockups"
OUTPUT_DIR="$DEMO_DIR/output"
TEMP_DIR="$DEMO_DIR/temp-v2"

RAW_VIDEO="$RECORDINGS_DIR/raw-demo-v2.webm"
BEFORE_IMG="$MOCKUPS_DIR/before.png"
AFTER_IMG="$MOCKUPS_DIR/after.png"

mkdir -p "$OUTPUT_DIR" "$TEMP_DIR"

echo "=== V2 Post-Processing: Agentis Hub Demo ==="
echo ""

# ─── Step 1: Create video segments from mockups ──────────────────────
echo "Step 1: Creating mockup video segments..."

# Before mockup: 5 seconds
ffmpeg -y -loop 1 -i "$BEFORE_IMG" -c:v libx264 -t 5 -pix_fmt yuv420p -vf "scale=1920:1080" \
  -r 30 "$TEMP_DIR/before.mp4" -loglevel warning
echo "  before.mp4: 5s"

# After mockup: 14 seconds (holds for before-after + closing narration)
ffmpeg -y -loop 1 -i "$AFTER_IMG" -c:v libx264 -t 14 -pix_fmt yuv420p -vf "scale=1920:1080" \
  -r 30 "$TEMP_DIR/after.mp4" -loglevel warning
echo "  after.mp4: 14s"

# ─── Step 2: Trim raw recording (skip first 8s of loading) ──────────
echo ""
echo "Step 2: Trimming raw recording (skip loading)..."

RAW_DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$RAW_VIDEO")
echo "  Raw duration: ${RAW_DURATION}s"

# Trim from 8s onwards and transcode to mp4
TRIM_START=8
ffmpeg -y -ss $TRIM_START -i "$RAW_VIDEO" \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
  -vf "scale=1920:1080" -r 30 -an \
  "$TEMP_DIR/main.mp4" -loglevel warning

MAIN_DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TEMP_DIR/main.mp4")
echo "  Trimmed main: ${MAIN_DURATION}s (skipped first ${TRIM_START}s)"

# ─── Step 3: Concatenate: before + main + after ──────────────────────
echo ""
echo "Step 3: Concatenating video segments..."

cat > "$TEMP_DIR/concat-list.txt" << EOF
file 'before.mp4'
file 'main.mp4'
file 'after.mp4'
EOF

ffmpeg -y -f concat -safe 0 -i "$TEMP_DIR/concat-list.txt" \
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \
  "$TEMP_DIR/video-combined.mp4" -loglevel warning

COMBINED_DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TEMP_DIR/video-combined.mp4")
echo "  Combined video: ${COMBINED_DURATION}s (before:5s + main:${MAIN_DURATION}s + after:8s)"

# ─── Step 4: Build narration track ──────────────────────────────────
echo ""
echo "Step 4: Building narration track..."

# Gaps between segments (target durations for visual pacing)
# These create brief pauses between narration segments
GAP_AFTER_INTRO=1        # Brief before dashboard context
GAP_AFTER_DASHBOARD=1    # Before ticket history
GAP_AFTER_TICKETS=1      # Before workflow intro
GAP_AFTER_WORKFLOW=1     # Before submit narration
GAP_AFTER_SUBMIT=2       # Watch requirements start
GAP_AFTER_DESIGN=1       # Design to dev transition
GAP_AFTER_DEV=1          # Dev finishing
GAP_AFTER_COMPLETE=2     # Before showing before/after
GAP_AFTER_BEFOREAFTER=1  # Before closing

# Generate silence files (0.5s each — tight pacing to fit narration in video)
for i in 1 2 3 4 5 6 7 8 9; do
  ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t 0.5 "$TEMP_DIR/gap${i}.mp3" -loglevel error
done

# Slightly longer gap before the before/after reveal (1.5s)
ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t 1.5 "$TEMP_DIR/gap8.mp3" -loglevel error

# Create concat list for narration
cat > "$TEMP_DIR/audio-list.txt" << EOF
file '../audio-v2/01-intro.mp3'
file 'gap1.mp3'
file '../audio-v2/02-dashboard-context.mp3'
file 'gap2.mp3'
file '../audio-v2/03-ticket-history.mp3'
file 'gap3.mp3'
file '../audio-v2/04-workflow-intro.mp3'
file 'gap4.mp3'
file '../audio-v2/05-submit.mp3'
file 'gap5.mp3'
file '../audio-v2/06-design.mp3'
file 'gap6.mp3'
file '../audio-v2/07-development.mp3'
file 'gap7.mp3'
file '../audio-v2/08-complete.mp3'
file 'gap8.mp3'
file '../audio-v2/09-before-after.mp3'
file 'gap9.mp3'
file '../audio-v2/10-closing.mp3'
EOF

ffmpeg -y -f concat -safe 0 -i "$TEMP_DIR/audio-list.txt" \
  -c:a libmp3lame -q:a 2 "$TEMP_DIR/full-narration.mp3" -loglevel error

NARRATION_DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TEMP_DIR/full-narration.mp3")
echo "  Narration track: ${NARRATION_DURATION}s"
echo "  Video track: ${COMBINED_DURATION}s"

# ─── Step 5: Merge video + audio ────────────────────────────────────
echo ""
echo "Step 5: Merging video + narration..."

ffmpeg -y \
  -i "$TEMP_DIR/video-combined.mp4" \
  -i "$TEMP_DIR/full-narration.mp3" \
  -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 192k \
  -shortest \
  "$OUTPUT_DIR/final-demo-v2.mp4" -loglevel warning

FINAL_DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUTPUT_DIR/final-demo-v2.mp4")
FINAL_SIZE=$(du -h "$OUTPUT_DIR/final-demo-v2.mp4" | cut -f1)

echo ""
echo "=== Done ==="
echo "Output: $OUTPUT_DIR/final-demo-v2.mp4"
echo "Duration: ${FINAL_DURATION}s ($(python3 -c "print(f'{$FINAL_DURATION/60:.1f}')" 2>/dev/null || echo "~2") min)"
echo "Size: $FINAL_SIZE"
echo "Resolution: 1920x1080"
