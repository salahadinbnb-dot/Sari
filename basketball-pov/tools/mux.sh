#!/usr/bin/env bash
# Mux the synthesized audio onto the rendered video.
set -euo pipefail
cd "$(dirname "$0")/.."
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
"$FF" -y -loglevel error -i out/ball_screen_pov_silent.mp4 -i out/audio.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart out/ball_screen_pov.mp4
echo "wrote out/ball_screen_pov.mp4"
