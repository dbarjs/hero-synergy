#!/bin/sh
# PROTOTYPE, throwaway. The README cut of the trailer: its problem beats and the Seal (0 to 9.9 s),
# then its outro (24 to 30 s) with the "VS Code extension + CLI" footer painted out. The stylized
# board and the typed command, which differ from the product, are cut out.
#
#   prototype-readme/cut-trailer.sh [trailer] [out]
#
# 15.5 s of 1920 x 1080 at 60 fps with stereo sound, about 9.2 MB: under the 10 MB upload cap.
set -eu
in="${1:-/tmp/hero-synergy-30s.mp4}"
out="${2:-/tmp/hero-synergy-readme-cut.mp4}"

ffmpeg -y -i "$in" -filter_complex "\
[0:v]trim=0:9.9,setpts=PTS-STARTPTS,fps=60[a];\
[0:v]trim=24.0:30,setpts=PTS-STARTPTS,delogo=x=590:y=985:w=740:h=48,fps=60[b];\
[a][b]xfade=transition=fade:duration=0.4:offset=9.5,format=yuv420p[v];\
[0:a]atrim=0:9.9,asetpts=PTS-STARTPTS[aa];\
[0:a]atrim=24.0:30,asetpts=PTS-STARTPTS[ab];\
[aa][ab]acrossfade=d=0.4[au]" \
  -map "[v]" -map "[au]" \
  -c:v libx264 -preset slow -crf 20 -tune animation -profile:v high \
  -c:a aac -b:a 128k -movflags +faststart "$out"
