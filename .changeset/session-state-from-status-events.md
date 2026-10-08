---
'hero-synergy': minor
---

See what each session is doing without opening its terminal. A ticket you launched now goes from "starting" to "live" the moment Claude Code reports the session has started, and to "ended" with the reason when it stops: "exited", "logout", "other", or, if Claude Code never said, how the terminal ended ("terminal closed", "window closed", "exited with code N", "process gone"). A session that hits an API error shows "failed". Every row and its Focus pane show the time since the last status event, so a session that looks stuck has an age. If a terminal reports nothing for 15 seconds, the row says "no status yet" and the pane explains that the session may be waiting at the trust dialog and that you should open the terminal.

The Hero Synergy icon in the Activity Bar carries a badge counting the sessions that need you; for now that is the failed ones. Clearing the conversation with `/clear` or resuming one doesn't end the ticket, and a session's end is final even when its start is read late.

The events the status plugin writes now live in a file per repository under the extension's storage, so they survive a restart. The Cockpit reads it once when it starts, then only what was added since, shortens it to each ticket's last event when it grows past 256 KB, and re-reads it every five seconds while a session is running in case the system dropped a change. After you reload the window, a session the file says was running shows as ended, "window closed", until the Cockpit can tell otherwise.
