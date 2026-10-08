---
'hero-synergy': minor
---

See every Claude Code session on your machine, not only the ones you launched here. A session you started by hand, in another window, or before reloading VS Code now shows up under its ticket when its name starts with the ticket's number (`#12 …`), with what it is doing: working, waiting for you, or needs approval. The Hero Synergy badge now counts the sessions waiting for you and needing approval as well as the failed ones.

Hero Synergy asks Claude Code (`claude agents --json`) while the Tree or the Detail is on screen, once when you show it and again about a second after Claude Code's sessions change, and not at all while both are hidden. If a second live session carries the same ticket number, the ticket shows a warning; Hero Synergy never stops a session. When Claude Code stops listing a session you launched here, the ticket falls back to the last status the session reported, with its age. A session only Claude Code knew about disappears from the ticket once it is no longer listed.
