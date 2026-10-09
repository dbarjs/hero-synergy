---
'hero-synergy': minor
---

On a local tracker, the Cockpit now finds an effort's map whatever its file name's casing: `MAP.md` shows on Linux too, not only `map.md`. A map whose own `Status:` line starts with `DONE` or `destination reached` is hidden with all its tickets, as a closed map is on GitHub, and the other maps keep their numbers. Any other Status line, or none, leaves the map open; one that starts with a word the Cockpit doesn't read shows a quiet warning, and the map stays visible. A header line with a bold key (`**Status:** closed`) is read like a plain one, with a quiet warning. An effort holding two casings of its map file side by side gets a warning naming both and the one read.
