---
'hero-synergy': minor
---

On a local tracker, issues that belong to no map now show as what they are: open work outside every map, grouped by effort in the Unmapped fold. An issue file is a ticket of its effort's map unless the effort has no map file, or its `Parent:` line names another file, such as the PRD a `/to-tickets` issue comes from. Those issues no longer count toward the map beside them: its frontier, its decided-of-total and whether it is finished count its own tickets only. They are never on a frontier and never "next", whatever their triage role.

The Unmapped fold, above Finished and collapsed until you open it, counts the open unmapped issues. Inside, each effort is a plain row with its map's title (open or closed), or its directory name when it has no map, and its count, with its issues one level deeper. Closed unmapped issues are hidden, and an open issue beside a closed map stays, under that map's title. Two efforts' `#1` no longer select, reveal or dismiss each other. A warning you dismissed on an unmapped issue shows once more, since each issue is now kept under its effort.

An unmapped issue no longer warns that it has no map, no type or no `## Question`: that is a normal local form. A `Map:` or `Parent:` line that names the effort's own map raises nothing. One that names another effort's map, or a file that isn't there, gets a loud warning naming the target, and so does a `Map:` line naming a PRD; the directory still decides where the ticket belongs. Nothing changes on GitHub.
