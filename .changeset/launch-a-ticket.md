---
'hero-synergy': minor
---

Take a ticket in one click. A ticket on the frontier now has a ▶ button; hover it to see the exact command, or select the ticket and the Focus pane shows the Work ticket command whole, with a copy button and the environment on a muted line underneath. ▶ starts `claude` as a terminal of its own, named `#<number> <title>`, with an icon for the ticket's type, in the Panel or, if you set `heroSynergy.sessions.terminalLocation` to `editor`, in an editor tab. On GitHub the session gets its own worktree; on a local tracker it shares your checkout and the pane says so. While a session is starting the row offers "focus terminal" instead of ▶, so a ticket never gets a second session by accident, and when you close the terminal the row says why it ended ("terminal closed", "window closed" or "exited with code N").

The Cockpit finds `claude` on your `PATH` (preferring `claude.exe` on Windows) and logs where in the Hero Synergy output channel. If yours lives elsewhere, set `heroSynergy.claude.path` in your user settings; the setting is read only from user settings, so a repository can't point the Cockpit at a program of its own. When `claude` or the wayfinder skill can't be found, ▶ is greyed out and says why.
