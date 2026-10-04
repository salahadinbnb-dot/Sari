#!/usr/bin/env bash
# Mux the synthesized audio onto the rendered video.  usage: tools/mux.sh [silent.mp4 audio.wav out.mp4]
set -euo pipefail
cd "$(dirname "$0")/.."
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
IN=${1:-out/ball_screen_pov_silent.mp4}; AU=${2:-out/audio.wav}; OUT=${3:-out/ball_screen_pov.mp4}
"$FF" -y -loglevel error -i "$IN" -i "$AU" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"
echo "wrote $OUT"
