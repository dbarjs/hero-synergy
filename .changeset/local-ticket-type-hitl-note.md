---
'hero-synergy': minor
---

On a local tracker, the Cockpit now reads a ticket's type from its `Type:`, `Label:` or `Labels:` line, with or without the `wayfinder:` prefix, so your tickets show their type. `Labels: wayfinder:task, ready-for-agent` gives both the type and the triage role. Only the first word counts: whatever follows it in parentheses is a note, and a type or a ticket number written there is never read. A `# Task: …` title is never a type, and the title shows as written. Lines that name two different types give no type and get a loud warning naming both. A type on a `Label:` or `Labels:` line, or with the `wayfinder:` prefix, gets a quiet warning pointing to the template's `Type: <type>`.

A leading `HITL` in that note, as in `Type: task (HITL — …)`, marks the ticket for you. It shows as HITL on its row and in the Detail. Under `heroSynergy.sessions.bypassPermissions` set to `afkTickets`, it keeps its prompts even when it is marked `ready-for-agent`. A leading `AFK` makes a task ticket show as AFK. On a prototype or grilling ticket, `AFK` leaves it HITL and gets a loud warning: a note can take a ticket out of AFK, never put one in. When several lines carry a note, `Type:` wins over `Label:`, and `Label:` over `Labels:`. An unknown `wayfinder:` label on a ticket now gets the same quiet warning it gets on GitHub. Nothing changes on GitHub.
