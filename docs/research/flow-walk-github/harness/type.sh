#!/bin/bash
# Types one line into a tmux window of the walk, as a person at the terminal would, and logs it.
# Usage: type.sh <a|b> <tmux window> <text…>.
O="$(cd "$(dirname "$0")" && pwd)"
clone="$1"; win="$2"; shift 2
echo "$(date -u +%H:%M:%S) typed[$clone] in $win: $*" >> "$O/launches.log"
tmux send-keys -t "walk:$win" -l "$*"
sleep 1
tmux send-keys -t "walk:$win" Enter
