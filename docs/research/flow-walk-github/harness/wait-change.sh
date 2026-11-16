#!/bin/bash
# Waits until GitHub's reading changes, or a session of the walk stops reading busy for 3 polls in a row,
# or the timeout passes; then prints the status. Usage: wait-change.sh [timeout seconds] [screen lines].
O="$(cd "$(dirname "$0")" && pwd)"
W="$(dirname "$O")"
timeout="${1:-540}"; start=$(date +%s); calm=0
lines=$(wc -l < "$O/github.jsonl")
until [ "$(wc -l < "$O/github.jsonl")" -gt "$lines" ] || [ "$calm" -ge 3 ] || [ $(( $(date +%s) - start )) -ge "$timeout" ]; do
  if claude agents --json 2>/dev/null | jq -e --arg w "$W/" '[.[] | select(.cwd | startswith($w)) | select(.status != "busy")] | length > 0' >/dev/null; then calm=$((calm+1)); else calm=0; fi
  sleep 5
done
echo "waited $(( $(date +%s) - start ))s"
"$O/status.sh" "${2:-10}"
