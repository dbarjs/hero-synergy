---
'hero-synergy': minor
---

Pick a ticket's session back up after it ends. An ended ticket now offers **Resume**, which reopens that exact conversation in a fresh terminal (`claude --resume <session id>`, with the status plugin and its settings attached again), and **Launch fresh**, the ordinary Work ticket command, which reuses the ticket's worktree if it still exists. When Hero Synergy never learned the session's id, the first choice is **Resume by name** instead, and says so. Both show the exact command before you run them, and neither asks for confirmation.

Reloading VS Code no longer loses track of running sessions. A terminal whose name starts with `#12` becomes ticket 12's terminal again, so **focus terminal** still works and the ticket keeps its last known status until Claude Code confirms it. A ticket whose last event said it was running but whose terminal is gone shows as ended, "window closed".

On a GitHub tracker the Focus pane and the Detail now show each ticket's worktree: that it exists, how many files in it are uncommitted, and how many of its commits are not on `main` yet. Hero Synergy only reads this from git. It never creates, merges or removes a worktree, so a worktree with unpushed commits stays listed until you deal with it.
