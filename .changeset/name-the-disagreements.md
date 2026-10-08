---
'hero-synergy': minor
---

When a ticket's tracker and its Claude Code session disagree, the Tree now says so instead of picking a side. Each situation lasts until the next refresh.

- A ticket you just started, whose claim has not reached the tracker yet, leaves the takeable list at once, so the ▶ moves on to the next ticket, and reads "live · claim not on tracker yet". If the first read after the session started still shows no claim, it becomes the warning "not claimed on the tracker".
- A ticket closed on the tracker while its session is still running moves to the map's Decisions as "wrapping up", with its status, its focus terminal button and its place in the badge count.
- A ticket someone else claimed, with a session running on your machine, reads "claimed by <login> on the tracker, session live here". Hero Synergy asks `gh api user` once, only when a claim and a session meet, to tell your claim from someone else's.
- A running session whose `#number` matches no ticket in view appears under one "Sessions without a ticket in view" row, counts for the badge when it waits for you, and keeps its ended record after it ends.

Hero Synergy also reads the tracker again when a ticket's session starts, when one ends, and when Claude Code stops listing one. These follow the same 60 second gap as every automatic refresh.
