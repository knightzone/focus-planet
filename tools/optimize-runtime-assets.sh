#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STATIC_DIR="$PROJECT_DIR/static/images"
AUDIO_DIR="$PROJECT_DIR/static/audio"
ARCHIVE_DIR="$PROJECT_DIR/content/ai-assets/archive"

command -v cwebp >/dev/null 2>&1 || {
  echo "缺少 cwebp，请先安装 WebP 工具。" >&2
  exit 1
}
command -v ffmpeg >/dev/null 2>&1 || {
  echo "缺少 ffmpeg，请先安装音频压缩工具。" >&2
  exit 1
}

mkdir -p "$ARCHIVE_DIR/shadow-match" "$ARCHIVE_DIR/drafts"

if [ -d "$STATIC_DIR/runtime/illustrations/shadow-match/source-sheets-v2" ]; then
  mv "$STATIC_DIR/runtime/illustrations/shadow-match/source-sheets-v2" \
    "$ARCHIVE_DIR/shadow-match/source-sheets-v2"
fi

if [ -f "$STATIC_DIR/runtime/illustrations/shadow-match/generated-groups-v2-preview.jpg" ]; then
  mv "$STATIC_DIR/runtime/illustrations/shadow-match/generated-groups-v2-preview.jpg" \
    "$ARCHIVE_DIR/shadow-match/generated-groups-v2-preview.jpg"
fi

if [ -d "$STATIC_DIR/drafts" ]; then
  find "$STATIC_DIR/drafts" -type f -maxdepth 1 -exec mv {} "$ARCHIVE_DIR/drafts/" \;
  rmdir "$STATIC_DIR/drafts" 2>/dev/null || true
fi

convert_image() {
  local source="$1"
  local output="${source%.*}.webp"
  local quality="88"

  case "$source" in
    */backgrounds/*) quality="82" ;;
    */illustrations/*) quality="84" ;;
  esac

  cwebp -quiet -mt -m 6 -q "$quality" -alpha_q 100 -metadata none \
    "$source" -o "$output"

  if [ ! -s "$output" ]; then
    echo "WebP 转换失败：$source" >&2
    exit 1
  fi

  rm "$source"
}

export -f convert_image
find "$STATIC_DIR/runtime" -type f \( -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' \) \
  -not -path '*/tabbar/*' -print0 |
  while IFS= read -r -d '' image; do
    convert_image "$image"
  done

find "$AUDIO_DIR" -type f -name '*.wav' -print0 |
  while IFS= read -r -d '' audio; do
    output="${audio%.wav}.mp3"
    ffmpeg -loglevel error -y -i "$audio" -ac 1 -ar 44100 -b:a 64k "$output"
    if [ ! -s "$output" ]; then
      echo "MP3 转换失败：$audio" >&2
      exit 1
    fi
    rm "$audio"
  done

echo "运行时图片和音频优化完成。"
