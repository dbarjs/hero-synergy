---
'hero-synergy': minor
---

On a local tracker, the Cockpit now reads every way a `Blocked by:` line names its blockers, so a ticket's frontier is right in both directions. Each item names the ticket at its start: a link to a ticket file, a bare `NN-<slug>.md`, or a number such as `03` or `#03`. A note after it (`(closed <date>)`, `**UNBLOCKED**`, `— <prose>`) and a link's title are never read, so a number in a note no longer blocks a ticket, and a blocker's state always comes from its own file. Items split on commas, and on a semicolon only before another ticket. `—`, `none`, `nothing`, `(none …` or an empty value mean no blockers.

A `Blocks:` line now gates too: when ticket A says it blocks B, B waits on A even if B's own line doesn't name it, and A clears the way for B in the Detail. A blocker that points at a missing file, or outside the effort, gets a quiet warning and doesn't block. A line off the template's `Blocked by: NN, NN` and a `Blocks:` line each get a quiet warning, and an item that names no ticket gets a loud one, so a dependency the Cockpit can't follow never goes unnoticed. Nothing changes on GitHub.
