---
'hero-synergy': minor
---

Add the Cockpit's Tree. A Hero Synergy icon appears in the Activity Bar of a repo that has `docs/agents/issue-tracker.md`; open it and the Tree lists every open map on a local markdown tracker (`.scratch/`) as `#number title`, with how many tickets are takeable and how many are decided out of the total. The most urgent map comes first, and finished maps fold into one node at the bottom. A map opens into its open tickets (claimed, then the frontier with the first marked `next`, then blocked with `waits on #n`), each with its type icon and HITL or AFK, and folds for its Fog and its Decisions with each decision's gist. The Refresh button in the Tree's title bar reads the tracker again. Nothing is read or started until you open the view, and GitHub trackers show a note instead of maps for now. You can drag the view to the secondary side bar or the Panel.
