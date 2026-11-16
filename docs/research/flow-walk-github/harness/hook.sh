#!/bin/sh
# Passive observer: appends every hook payload it is given, with a timestamp, and allows everything.
jq -c --arg ts "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" '{ts: $ts} + .' >> "$(dirname "$0")/hooks.jsonl" 2>/dev/null
exit 0
