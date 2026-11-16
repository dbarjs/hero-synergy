---
'hero-synergy': minor
---

On a local tracker, the Cockpit now reads a ticket's state from the first word of its `Status:` line, so your closed tickets read as closed. `closed`, `done`, `resolved` and `wontfix` close a ticket, in any case and with or without `**` around them. `open`, `claimed` and the triage roles `needs-triage`, `needs-info`, `ready-for-agent` and `ready-for-human` leave it open, as does no Status line at all. What follows the first word (a date, a note in parentheses, a dash clause) never changes the state, so `closed 2026-10-01 (reopened and re-closed)` stays closed.

After `open`, one more word is read: `open — needs-triage (blocked)` and `open (ready-for-human — …)` set the triage role, and `open — claimed <date>` or `open (claimed …)` claim the ticket. An `Assignee:` line that names someone also claims an open ticket, and the Focus pane says who holds it; `—`, an empty value and `(unclaimed)` name nobody. A claim that names nobody, like `Status: claimed` on its own, now shows as "claimed" instead of an empty value. A closed ticket is never claimed, whatever its Assignee line still says. Claimed tickets leave the frontier.

Each ticket's triage role is read from its Status line, or else from its `Labels:` line. The role never changes the frontier: a `ready-for-human` ticket can still be next. With `heroSynergy.sessions.bypassPermissions` set to `afkTickets`, a local `ready-for-human` ticket keeps its prompts, and a `ready-for-agent` one runs without them, whatever its type.

A Status line that starts with any other word reads as open, can still be claimed through `Assignee:`, and gets a loud warning whose hint lists the words that are read. A second Status line is ignored and gets the same warning. Nothing changes on GitHub.
