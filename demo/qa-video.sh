#!/bin/bash
#
# QA Script — Verify the final demo video
#
# Extracts sample frames at key timestamps and reports video metadata.
# Run after post-process.sh to verify quality before sharing.
#
# Usage: ./demo/qa-video.sh

set -e

DEMO_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$DEMO_DIR/output"
QA_DIR="$DEMO_DIR/qa-frames"
VIDEO="$OUTPUT_DIR/final-demo.mp4"

if [ ! -f "$VIDEO" ]; then
  echo "ERROR: $VIDEO not found. Run post-process.sh first."
  exit 1
fi

mkdir -p "$QA_DIR"

echo "=== QA: Video Inspection ==="
echo ""

# Video metadata
echo "--- Metadata ---"
echo "File: $VIDEO"
echo "Size: $(du -h "$VIDEO" | cut -f1)"
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")
echo "Duration: ${DURATION}s ($(echo "scale=1; $DURATION / 60" | bc)m)"
echo "Resolution: $(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$VIDEO")"
echo "FPS: $(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$VIDEO")"
echo "Video codec: $(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO")"
echo "Audio codec: $(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$VIDEO")"
echo "Audio sample rate: $(ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of csv=p=0 "$VIDEO")"
echo ""

# Extract frames at key timestamps
echo "--- Extracting sample frames ---"
TOTAL_SECS=$(echo "$DURATION" | cut -d. -f1)

# Sample at 10%, 25%, 50%, 75%, 90% of video
TIMESTAMPS=(
  "00:00:03"
  "$(printf '%02d:%02d:%02d' $((TOTAL_SECS*10/100/3600)) $((TOTAL_SECS*10/100%3600/60)) $((TOTAL_SECS*10/100%60)))"
  "$(printf '%02d:%02d:%02d' $((TOTAL_SECS*25/100/3600)) $((TOTAL_SECS*25/100%3600/60)) $((TOTAL_SECS*25/100%60)))"
  "$(printf '%02d:%02d:%02d' $((TOTAL_SECS*50/100/3600)) $((TOTAL_SECS*50/100%3600/60)) $((TOTAL_SECS*50/100%60)))"
  "$(printf '%02d:%02d:%02d' $((TOTAL_SECS*75/100/3600)) $((TOTAL_SECS*75/100%3600/60)) $((TOTAL_SECS*75/100%60)))"
  "$(printf '%02d:%02d:%02d' $((TOTAL_SECS*90/100/3600)) $((TOTAL_SECS*90/100%3600/60)) $((TOTAL_SECS*90/100%60)))"
)

LABELS=("opening" "10pct" "25pct" "50pct" "75pct" "90pct")

for i in "${!TIMESTAMPS[@]}"; do
  ts="${TIMESTAMPS[$i]}"
  label="${LABELS[$i]}"
  outfile="$QA_DIR/frame-${label}-${ts}.png"
  ffmpeg -y -ss "$ts" -i "$VIDEO" -frames:v 1 -q:v 2 "$outfile" -loglevel error 2>/dev/null || true
  if [ -f "$outfile" ]; then
    echo "  Extracted: frame-${label}-${ts}.png ($(du -h "$outfile" | cut -f1))"
  fi
done

echo ""
echo "--- Audio check ---"
# Check if audio is present and not silent
AUDIO_VOLUME=$(ffmpeg -i "$VIDEO" -af "volumedetect" -vn -f null /dev/null 2>&1 | grep "mean_volume" | awk '{print $5}')
if [ -z "$AUDIO_VOLUME" ]; then
  echo "  WARNING: No audio detected!"
else
  echo "  Mean volume: ${AUDIO_VOLUME} dB"
  # Check if audio is too quiet
  VOLUME_NUM=$(echo "$AUDIO_VOLUME" | tr -d '-')
  if (( $(echo "$VOLUME_NUM > 40" | bc -l) )); then
    echo "  WARNING: Audio may be too quiet (below -40dB)"
  else
    echo "  Audio levels: OK"
  fi
fi

echo ""
echo "--- Summary ---"
echo "QA frames saved to: $QA_DIR/"
echo "Inspect frames visually to verify:"
echo "  1. Dashboard is visible in opening frame"
echo "  2. Workflow board visible in middle frames"
echo "  3. PR or completion visible in later frames"
echo "  4. Resolution is crisp (no blur/artifacts)"
echo ""
echo "To view frames: open $QA_DIR/"
