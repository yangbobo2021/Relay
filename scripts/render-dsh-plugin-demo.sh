#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
media_dir="$repo_root/docs/media"
video="$media_dir/dsh-plugin-suite-demo.mp4"
gif="$media_dir/dsh-plugin-suite-demo.gif"
palette="$media_dir/.dsh-plugin-suite-palette.png"

command -v ffmpeg >/dev/null 2>&1 || {
  echo "ffmpeg is required to render the DSH plugin demo" >&2
  exit 1
}

sources=(
  "$repo_root/integrations/codex/docs/images/dsh-new-session-backends.jpg"
  "$repo_root/integrations/dsh-workbench/docs/images/dsh-workbench-files-panel.png"
  "$repo_root/integrations/dsh-files/docs/images/dsh-files-preview.png"
  "$repo_root/integrations/dsh-terminal/docs/images/dsh-terminal-panel.png"
)

for source in "${sources[@]}"; do
  test -f "$source" || {
    echo "missing demo source: $source" >&2
    exit 1
  }
done

mkdir -p "$media_dir"

ffmpeg -hide_banner -loglevel error -y \
  -loop 1 -t 7 -i "${sources[0]}" \
  -loop 1 -t 7 -i "${sources[1]}" \
  -loop 1 -t 7 -i "${sources[2]}" \
  -loop 1 -t 7 -i "${sources[3]}" \
  -filter_complex "\
    [0:v]scale=1200:800:force_original_aspect_ratio=decrease,pad=1200:800:(ow-iw)/2:(oh-ih)/2:white,setsar=1,format=yuv420p[v0];\
    [1:v]scale=1200:800:force_original_aspect_ratio=decrease,pad=1200:800:(ow-iw)/2:(oh-ih)/2:white,setsar=1,format=yuv420p[v1];\
    [2:v]scale=1200:800:force_original_aspect_ratio=decrease,pad=1200:800:(ow-iw)/2:(oh-ih)/2:white,setsar=1,format=yuv420p[v2];\
    [3:v]scale=1200:800:force_original_aspect_ratio=decrease,pad=1200:800:(ow-iw)/2:(oh-ih)/2:white,setsar=1,format=yuv420p[v3];\
    [v0][v1]xfade=transition=fade:duration=1:offset=6[x1];\
    [x1][v2]xfade=transition=fade:duration=1:offset=12[x2];\
    [x2][v3]xfade=transition=fade:duration=1:offset=18,trim=duration=25,setpts=PTS-STARTPTS[out]" \
  -map "[out]" -an -r 24 -c:v libx264 -crf 20 -preset medium -movflags +faststart "$video"

ffmpeg -hide_banner -loglevel error -y -i "$video" \
  -vf "fps=8,scale=900:-1:flags=lanczos,palettegen=max_colors=128:stats_mode=diff" "$palette"
ffmpeg -hide_banner -loglevel error -y -i "$video" -i "$palette" \
  -lavfi "fps=8,scale=900:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle" "$gif"

rm -f "$palette"
echo "Rendered $video"
echo "Rendered $gif"
