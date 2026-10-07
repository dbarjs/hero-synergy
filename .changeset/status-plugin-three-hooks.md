---
'hero-synergy': minor
---

Ship the status plugin inside the extension. A ticket session launched by the Cockpit loads it with `--plugin-dir`, no install step. It hooks `SessionStart`, `SessionEnd` and `StopFailure` and appends one line per event to the Cockpit's events file: the ticket, the hook, the session id, the detail (`startup`/`resume`/`clear`/`compact` for a start, the exit reason for an end, the error for a failure), the time, and the whole hook payload. Outside a Cockpit session it does nothing.
