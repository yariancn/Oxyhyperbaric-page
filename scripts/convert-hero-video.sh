#!/bin/bash
# Convert assets/videos/hero-bg.mov → hero-bg.mp4 (no system ffmpeg required)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOV="$ROOT/assets/videos/hero-bg.mov"
MP4="$ROOT/assets/videos/hero-bg.mp4"

if [ ! -f "$MOV" ]; then
  echo "Missing $MOV — run ./download-images.sh first."
  exit 1
fi

if command -v ffmpeg >/dev/null 2>&1; then
  FFMPEG=ffmpeg
else
  echo "→ Using bundled ffmpeg (no install required)..."
  PACK_DIR="$ROOT/.tmp-ffmpeg"
  rm -rf "$PACK_DIR"
  mkdir -p "$PACK_DIR"
  cd "$PACK_DIR"
  npm pack @ffmpeg-installer/darwin-arm64 >/dev/null 2>&1
  tar -xzf ffmpeg-installer-darwin-arm64-*.tgz
  FFMPEG="$PACK_DIR/package/ffmpeg"
  chmod +x "$FFMPEG"
  cd "$ROOT"
fi

echo "→ Converting to MP4 for Chrome/Edge/Firefox..."
"$FFMPEG" -y -i "$MOV" -an -c:v libx264 -crf 23 -movflags +faststart "$MP4"
ls -lh "$MP4"
echo "Done. MP4 ready for /assets/videos/hero-bg.mp4"
