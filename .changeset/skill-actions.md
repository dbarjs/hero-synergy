---
'hero-synergy': minor
---

Run any skill from the Cockpit, and start from an empty Tree. A finished map (open, every ticket closed) now has a ▶ on its ⚑ Map row and a **To spec** button in its pane and Detail, running your `to-spec` skill with the map's URL on GitHub or its path on a local tracker. A ticket claimed by someone else offers **Launch fresh**, and one whose session ended offers **Launch fresh** and **Resume by name**, each showing its exact command.

The Tree's title bar gains **Chart a map**, which runs the wayfinder skill with no input so the session asks you for the loose idea, and **Run skill…**, a QuickPick of every user-invoked skill the Cockpit found (the command, where it came from — `plugin 1.2.3`, `project` or `personal` — and what it does); both are in the Command Palette too. They, To spec, Setup and the install commands open plain terminals: no plugin, no env, no status, no badge.

An empty Tree now tells you what to do next. With no user-invoked skill installed it leads with both install commands, `claude plugins install mattpocock-skills` and `npx skills@latest add mattpocock/skills`, each with ▶ and a note to pick one, never both. With skills but no tracker doc it leads with **Setup**, and with a tracker doc but no map it leads with **Chart a map**. An Action whose skill isn't installed is greyed out with the reason, never hidden, and skills are looked for again on every refresh.
