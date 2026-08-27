#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VIDEO="$ROOT/docs/media/dsh-plugin-manager-codex-install-demo.en.mp4"

command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null

ffmpeg -v error -i "$VIDEO" -f null -

FRAMES=$(ffprobe -v error -count_frames -select_streams v:0 \
  -show_entries stream=nb_read_frames -of default=nokey=1:noprint_wrappers=1 "$VIDEO")
[ "$FRAMES" = "1201" ] || {
  echo "Expected 1201 video frames, got $FRAMES" >&2
  exit 1
}

AUDIO_STREAMS=$(ffprobe -v error -select_streams a -show_entries stream=index \
  -of csv=p=0 "$VIDEO" | wc -l | tr -d ' ')
[ "$AUDIO_STREAMS" = "0" ] || {
  echo "Expected no audio stream, got $AUDIO_STREAMS" >&2
  exit 1
}

FIRST_YAVG=$(ffmpeg -hide_banner -loglevel error -i "$VIDEO" -frames:v 1 \
  -vf signalstats,metadata=print:file=- -f null - | sed -n 's/.*YAVG=//p' | head -1)
awk -v value="$FIRST_YAVG" 'BEGIN { exit !(value >= 220) }' || {
  echo "First frame is incomplete or too dark: YAVG=$FIRST_YAVG" >&2
  exit 1
}

BLACK_INTERVALS=$(ffmpeg -hide_banner -i "$VIDEO" \
  -vf "blackdetect=d=0.5:pix_th=0.10" -an -f null - 2>&1 \
  | grep -E 'black_start|black_end' || true)
[ -z "$BLACK_INTERVALS" ] || {
  echo "Unexpected black interval: $BLACK_INTERVALS" >&2
  exit 1
}

node -e '
  const fs = require("node:fs");
  const video = fs.readFileSync(process.argv[1]);
  if (video.subarray(4, 8).toString() !== "ftyp") process.exit(1);
  if (video.indexOf(Buffer.from("moov")) >= video.indexOf(Buffer.from("mdat"))) process.exit(1);
' "$VIDEO"

printf 'English Plugin Manager demo accepted: frames=%s firstYAVG=%s\n' "$FRAMES" "$FIRST_YAVG"
