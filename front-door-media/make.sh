#!/usr/bin/env bash
# Cuts the 30-second trailer into the files the front door can show.
#
#   front-door-media/make.sh [trailer.mp4] [video-out.mp4]
#
# The images land next to this script. The README video stays out of git.
set -euo pipefail

trailer=${1:-/tmp/hero-synergy-30s.mp4}
video=${2:-/tmp/hero-synergy-readme.mp4}
here=$(cd "$(dirname "$0")" && pwd)
passlog=$(mktemp -d)/x264

# The frames, in seconds: the Seal lit gold, the title card once its letters
# settle, and the outro once everything has faded in.
seal=8.2
title=9.2
outro=29.9

frame() { # <time> <filter> <out> [encoder options...]
  local time=$1 filter=$2 out=$3
  shift 3
  ffmpeg -v error -y -ss "$time" -i "$trailer" -frames:v 1 -vf "$filter" "$@" "$out"
}

# README video. A free plan caps an uploaded video at 10 MB, so two passes aim
# the whole file at 9.5 MB: 2,400 kb/s of video and 128 kb/s of audio over
# 30 seconds, plus the container. 1080p and 60 fps are kept.
x264=(-c:v libx264 -preset veryslow -tune animation -profile:v high -pix_fmt yuv420p -b:v 2400k -maxrate 4800k -bufsize 4800k -passlogfile "$passlog")
ffmpeg -v error -y -i "$trailer" "${x264[@]}" -pass 1 -an -f mp4 /dev/null
ffmpeg -v error -y -i "$trailer" "${x264[@]}" -pass 2 -c:a aac -b:a 128k -movflags +faststart "$video"

# Poster: the title card, for a link to the video and wherever it cannot play.
frame "$title" "scale=1280:720:flags=lanczos" "$here/poster.png"
frame "$title" "scale=1280:720:flags=lanczos" "$here/poster.jpg" -q:v 3

# Social preview cards: 1280 x 640, a 2:1 slice of the frame scaled by 2/3.
# The outro's slice stops above its footer, which reads "VS Code extension + CLI".
frame "$seal" "crop=1920:960:0:60,scale=1280:640:flags=lanczos" "$here/card-seal.png"
frame "$title" "crop=1920:960:0:60,scale=1280:640:flags=lanczos" "$here/card-title.png"
frame "$outro" "crop=1920:960:0:20,scale=1280:640:flags=lanczos" "$here/card-outro.png"

# README banners from the title card, at device scale 2: shown at 960 px wide.
frame "$title" "crop=1920:480:0:300" "$here/banner-4x1.png"
frame "$title" "crop=1920:640:0:220" "$here/banner-3x1.png"
# The starfield's grain makes the PNGs heavy, so each banner also comes as a JPG.
frame "$title" "crop=1920:480:0:300" "$here/banner-4x1.jpg" -q:v 3
frame "$title" "crop=1920:640:0:220" "$here/banner-3x1.jpg" -q:v 3
