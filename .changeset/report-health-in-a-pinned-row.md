---
'hero-synergy': minor
---

See what is wrong with your setup, in one place. A pinned **Health** row now sits at the top of the Tree whenever something about Claude Code or the skills is off, labelled "Health · 2 warnings" (or "Health · 1 note" when nothing needs fixing). A ⚠ means what the Cockpit shows may be wrong or missing, and hovering the row lists those messages; click it and the pane lists every entry with the one thing to do about it and a Dismiss. The row is gone when there is nothing to report.

Hero Synergy checks `claude --version` when it starts, when you press Refresh and when the `claude` it finds changes. Below 2.1.212 is a warning that tells you to run `claude update` or upgrade through your package manager; a newer Claude Code says nothing. If `claude` is not found, or the wayfinder skill is not installed, the row says so, and so does it for a plugin or skill file it cannot read.

If a Claude Code update changes what `claude agents --json` prints so that Hero Synergy can no longer read it, you get one warning naming the Claude Code version, and every session whose status came from it shows "status unknown" instead of a stale word. Those sessions stop counting toward the badge, but "focus terminal" and the ended record stay. Unreadable status hooks are reported the same way.

A dismissed entry stays hidden in every workspace until what it found changes. Health never raises a notification, never changes the badge or the order of anything, and never adds an Action.

When you report a bug, the **Hero Synergy** output channel now starts with your editor's name, host, version and platform and where `claude` was found, and logs each health entry once with what was seen: the version line, the first 2 KB of the output that failed, the parse error.
