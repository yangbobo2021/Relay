#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
media_dir="$repo_root/docs/media"
input="${1:-$repo_root/.artifacts/dsh-plugin-demo/dsh-plugin-suite-raw.webm}"
video="$media_dir/dsh-plugin-suite-demo.mp4"
gif="$media_dir/dsh-plugin-suite-demo.gif"
palette="$media_dir/.dsh-plugin-suite-palette.png"

command -v ffmpeg >/dev/null 2>&1 || {
  echo "ffmpeg is required to render the DSH plugin demo" >&2
  exit 1
}

test -f "$input" || {
  echo "missing real DSH screen recording: $input" >&2
  exit 1
}

mkdir -p "$media_dir"

ffmpeg -hide_banner -loglevel error -y -i "$input" \
  -an -vf "fps=30,scale=1440:900:force_original_aspect_ratio=decrease,pad=1440:900:(ow-iw)/2:(oh-ih)/2:white,setsar=1" \
  -c:v libx264 -profile:v high -level:v 4.0 -pix_fmt yuv420p -crf 19 -preset medium \
  -movflags +faststart "$video"

ffmpeg -hide_banner -loglevel error -y -i "$video" \
  -vf "setpts=0.45*PTS,fps=12,scale=960:-1:flags=lanczos,palettegen=max_colors=192:stats_mode=diff" "$palette"
ffmpeg -hide_banner -loglevel error -y -i "$video" -i "$palette" \
  -lavfi "setpts=0.45*PTS,fps=12,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle" "$gif"

rm -f "$palette"
echo "Rendered $video"
echo "Rendered $gif"
