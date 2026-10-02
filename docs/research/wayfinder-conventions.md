# Which wayfinder conventions exist in the wild?

Research for the ticket [Which wayfinder conventions exist in the wild?](https://github.com/dbarjs/hero-synergy/issues/10), done on 2026-10-02.

Everything below comes from the git history of `mattpocock/skills` (`main` at [d81f3a1], 2026-09-29) and from the installed plugin copy, version 1.2.3. Times are the commit times, in +01:00. "Released in" means the first tagged release that contains the commit.

## Answer

Upstream has shipped three generations of wayfinder state, and the tracker templates lag behind `SKILL.md` to this day:

1. **A single Markdown file** (the `decision-mapping` skill, 2026-06-15 to 2026-07-01): tickets are sections of one file, with `Blocked by:`, `Status:` and `Type:` lines.
2. **A tracker map, early form** (2026-07-01 to 2026-07-05, never in a tagged release): a `wayfinder:map` issue with a Notes / Decisions so far / Fog body, and for the first 39 hours a `wayfinder:claimed` label.
3. **A tracker map, current form** (since 2026-07-05, released in v1.1.0 on 2026-07-08): Destination, Notes, Decisions so far, Not yet specified, Out of scope; the assignee is the claim.

The four ticket types and their `wayfinder:<type>` labels have not changed since labels exist. The `task` type is older than the labels.

| # | Convention | Applied | Released in | How a program recognizes it |
| --- | --- | --- | --- | --- |
| F1 | Map is one Markdown file; ticket = `## 1. <question>` section, `blocked_by: []`, `**Question.**` / `**Answer.**` / `**Reasoning.**` | [ab7196a] 2026-06-15 to [bc4cf90] 2026-06-17 | none (in the plugin manifest for two days, before v1.0.0) | H2 matching `^\d+\. `, a `blocked_by:` line |
| F2 | Same file; ticket = `## #1: Title`, `Blocked by: #n, #n`, `Type: Research \| Prototype \| Discuss`, `### Question`, `### Answer` | [bc4cf90] 2026-06-17 to [850873c] 2026-06-29 (`Discuss` became `Grilling` in [42396a5], 2026-06-22) | v1.0.0, v1.0.1 (as `skills/in-progress/decision-mapping`, outside the plugin) | H2 matching `^#\d+: `, a `Type:` line, no `Status:` line |
| F3 | Same, plus `Status: open \| in-progress \| resolved`; claim = `Status: in-progress` | [850873c] 2026-06-29 to [5c3c49d] 2026-07-01 | none | a `Status:` line with one of the three values |
| F4 | Same, ticket keyed by slug: `## relational-db: Title`, `Blocked by: <slug>, <slug>`; optional `## Notes` block at the end of the file | [a116824] 2026-06-29 to [5c3c49d] 2026-07-01 | none | H2 matching `^[a-z0-9-]+: `, `Blocked by:` holding slugs |
| F5 | Same, `Type:` gains `Task` | [64d9f3d] 2026-07-01 10:41 to [5c3c49d] 2026-07-01 20:28 | none | `Type: Task` |
| M1 | Map is an issue labelled `wayfinder:map`; tickets are child issues | [5c3c49d] 2026-07-01, to date | v1.1.0 | label `wayfinder:map` |
| M2 | Map body: Notes, Decisions so far, Fog | [5c3c49d] 2026-07-01 to [53c6219] 2026-07-05 14:57 (explicit `##` template from [46be3d6], 2026-07-02) | none in `SKILL.md`; **still named by all three tracker templates today** | H2 `Fog` present, no H2 `Destination` |
| M3 | Map body: Destination, Notes, Decisions so far, Fog | [53c6219] to [299eb0c], 2026-07-05 14:57 to 15:08 | none | H2 `Destination` and `Fog`, no `Deferred` |
| M4 | Map body: Destination, Notes, Decisions so far, Fog, Deferred | [299eb0c] to [3ea0131], 2026-07-05 15:08 to 17:35 | none | H2 `Deferred` |
| M5 | Map body: Destination, Notes, Decisions so far, Not yet specified, Out of scope | [3ea0131] 2026-07-05, to date | v1.1.0 | H2 `Not yet specified` |
| D1 | Decisions entry: `- [title](link) — gist` (em dash) | [46be3d6] 2026-07-02 to [3216582] 2026-08-19 | v1.1.0 to v1.2.3 | list item, link, then `—` |
| D2 | Decisions entry: `- [title](link): gist` | [3216582] 2026-08-19, to date | unreleased (on `main`, waiting as a changeset) | list item, link, then `:` |
| Q1 | Ticket body is a `## Question` section; the answer is a comment, not part of the body | [46be3d6] 2026-07-02, to date | v1.1.0 | H2 `Question` |
| T1 | Type label `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, `wayfinder:task` | [5c3c49d] 2026-07-01, to date | v1.1.0 | label prefix `wayfinder:`, value not `map` and not `claimed` |
| C1 | Claim = label `wayfinder:claimed` | [5c3c49d] 2026-07-01 20:28 to [6f9e995] 2026-07-03 11:34 | none | label `wayfinder:claimed` on an open ticket |
| C2 | Claim = the ticket has an assignee | [6f9e995] 2026-07-03, to date | v1.1.0 | open ticket with one or more assignees |
| P1 | Child = native GitHub sub-issue | [5c3c49d] 2026-07-01, to date | v1.1.0 | the issue's parent is the map |
| P2 | Child fallback on GitHub: task list in the map body plus `Part of #<map>` at the top of the child body | [5c3c49d] 2026-07-01, to date | v1.1.0 | first body line matches `^Part of #\d+` |
| P3 | Child on GitLab: `Part of #<map>` at the top of the description, always | [5c3c49d] 2026-07-01, to date | v1.1.0 | same regex |
| B1 | Blocker = native dependency (GitHub issue dependencies, GitLab blocking link) | named loosely in [5c3c49d]; exact recipe from [8c2a4c5] 2026-07-03, to date | v1.1.0 | GitHub `issue_dependencies_summary.blocked_by`; GitLab a `blocked_by` link from `projects/:id/issues/:iid/links` |
| B2 | Blocker fallback: `Blocked by: #<n>, #<n>` at the top of the child body | [5c3c49d] 2026-07-01, to date | v1.1.0 | `^Blocked by:\s*(#\d+(,\s*#\d+)*)` |
| R1 | Resolve = answer as a comment, close the issue, append a pointer to the map's Decisions so far | [5c3c49d] 2026-07-01, to date | v1.1.0 | closed ticket whose link is under Decisions so far |
| R2 | Ruled out of scope = close the ticket, one line under Out of scope (first: Deferred) | [299eb0c] 2026-07-05, to date | v1.1.0 | closed ticket whose link is under Out of scope |
| R3 | Research findings live on a throwaway `research/<name>` branch, with a pointer from the ticket | [2602257] 2026-07-13, to date | v1.2.0 | `research/` branch name in a ticket comment |
| L1 | Local tracker: `.scratch/<effort>/map.md` and `.scratch/<effort>/issues/NN-<slug>.md` with `Type:`, `Status: claimed \| resolved`, `Blocked by: NN, NN`, answer under `## Answer` | [5c3c49d] 2026-07-01, to date (wording unchanged) | v1.1.0 | the file layout plus the three lines |

## Details per convention

### Where the tracker conventions come from

Wayfinder state is written by an agent that reads two documents, and they can disagree:

- `skills/engineering/wayfinder/SKILL.md`, which holds the map and ticket body templates, the labels and the claim rule.
- The repo's tracker doc, which `/setup-matt-pocock-skills` writes once from a seed template (`issue-tracker-github.md`, `issue-tracker-gitlab.md` or `issue-tracker-local.md`). Its "Wayfinding operations" section holds the tracker commands.

The tracker doc is a frozen copy. Upgrading the skills does not touch it, so a repo keeps the conventions of the day it was set up. This repo's `docs/agents/issue-tracker.md` is byte-identical to the GitHub template of the installed plugin.

Until [d869d45] (2026-07-08, v1.1.0) `SKILL.md` read the literal path `docs/agents/issue-tracker.md`. Since then it follows the pointer in the `### Issue tracker` block of `CLAUDE.md` or `AGENTS.md`, so the doc can live anywhere. With no tracker doc, wayfinder falls back to the local tracker.

For an "Other" tracker (Jira, Linear), setup writes free prose from the user's description. Upstream ships no wayfinding conventions for it.

### The single-file decision map (F1 to F5)

Before wayfinder there was `decision-mapping`: "a single compact Markdown file, one per planning effort, git-tracked alongside the project". No path is prescribed. Each ticket is an H2 section of that file.

| Commit | Ticket heading | Edges | Other lines | Body |
| --- | --- | --- | --- | --- |
| [ab7196a] 2026-06-15 | `## 1. Should we use ...?` | `blocked_by: []` | none; tickets tagged discuss, spike or defer in prose | `**Question.**`, `**Answer.**`, `**Reasoning.**` |
| [bc4cf90] 2026-06-17 | `## #1: Title` | `Blocked by: #n, #n` | `Type: Research \| Prototype \| Discuss` | `### Question`, `### Answer` |
| [42396a5] 2026-06-22 | same | same | `Type: Research \| Prototype \| Grilling` | same |
| [850873c] 2026-06-29 | same | same | adds `Status: open \| in-progress \| resolved` | same |
| [a116824] 2026-06-29 | `## relational-db: Title` (the title is optional) | `Blocked by: <slug>, <slug>` | same | same |
| [3dc6800], [79a5c9c] 2026-06-30 | same | same | `Type:` read `Research \| Sketch \| Grilling` for two minutes; an optional `## Notes` block lands at the end of the file | same |
| [64d9f3d] 2026-07-01 | same | same | `Type: Research \| Prototype \| Grilling \| Task` | same |

From [850873c] a claim is `Status: in-progress`, a ticket is unblocked when every ticket it lists is `resolved`, and the next ticket is the lowest open number (from [a116824]: the first in document order). Before that the user picked the ticket.

The skill was renamed to `wayfinding` ([4027ea6]) and then `wayfinder` ([01f0b7e]) on 2026-07-01, 40 minutes before it moved to the tracker, so `/wayfinding` and `/wayfinder` also produced single-file maps for a short while.

Recognition: a Markdown file whose H2 sections each hold a `Blocked by:` (or `blocked_by:`) line and a `### Question` or `**Question.**`. A program cannot find these files by path.

### The map (M1 to M5)

The label `wayfinder:map` has been the only marker of a map issue since [5c3c49d]. Setup does not create it. The upstream docs page says `gh issue create --label <missing>` fails and tells the user to create the wayfinder labels by hand.

Five H2 headings changed over four days, all before the first release that shipped wayfinder:

| Body | Headings in order | From | Until |
| --- | --- | --- | --- |
| M2 | Notes, Decisions so far, Fog | [5c3c49d] 2026-07-01 20:28 | [53c6219] 2026-07-05 14:57 |
| M3 | Destination, Notes, Decisions so far, Fog | [53c6219] | [299eb0c] 2026-07-05 15:08 |
| M4 | Destination, Notes, Decisions so far, Fog, Deferred | [299eb0c] | [3ea0131] 2026-07-05 17:35 |
| M5 | Destination, Notes, Decisions so far, Not yet specified, Out of scope | [3ea0131] | today |

In [5c3c49d] the three zones were a bullet list in the skill, not a template. The fenced `##` template arrived in [46be3d6] the next morning.

Recognition rules:

- Match H2 headings case-insensitively. Treat `Fog` as `Not yet specified` and `Deferred` as `Out of scope`. Accept `Decisions-so-far` for `Decisions so far`: the hyphenated form is how the skill's prose and all three templates spell it.
- `Fog` without `Destination` is M2. `Deferred` is M4. `Not yet specified` is M5. A map with none of the five headings is free-form.
- "Open tickets are **not** listed" in the body since [46be3d6], so an M2 to M5 body holds no ticket list, except under P2 below.
- Each Decisions so far line is one closed ticket: `- [<title>](link) — <gist>` until [3216582] (2026-08-19), `- [<title>](link): <gist>` after. The installed 1.2.3 copy still writes the em dash. Parse with `^- \[(.+?)\]\((.+?)\)\s*(—|:|-)\s*(.*)$`. The skill's "Refer by name" rule ([ee014fa], 2026-07-02) means entries link by title, not by bare `#42`.
- Each Out of scope line is "the gist plus why it's out of scope, linking the closed ticket". A closed ticket linked there was ruled out, not resolved.
- The `## Notes` section can override "plan, don't do" ([7be28cf], 2026-07-06). A map whose Notes say it carries execution will hold task tickets that build the destination.

### Ticket types and labels (T1)

- `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling` and `wayfinder:task` all arrived together in [5c3c49d]. No label has been renamed or removed on `main` since.
- The names behind them changed earlier, in the single-file generation: `discuss`, `spike`, `defer` (prose only, [ab7196a]), then `Research`, `Prototype`, `Discuss` ([bc4cf90]), `Discuss` to `Grilling` ([42396a5]), and `Task` ([64d9f3d], ten hours before the labels).
- HITL and AFK ([e5932a7], 2026-07-06) are properties of the type, not labels: research is AFK, prototype and grilling are HITL, task is either.
- Since [7d694b7] (2026-07-13, v1.2.0) upstream calls the unit a "decision ticket". The labels did not change.
- An unmerged upstream branch, `wayfinder/research-inline` ([0d54032], 2026-07-13), drops `research` as a ticket type. `main` took [2602257] instead, which keeps it. If that branch ever lands, `wayfinder:research` becomes a legacy label.
- Local tracker: a `Type:` line with the lowercase type.

### Claims (C1, C2)

| Form | Applied | Command in the template |
| --- | --- | --- |
| `Status: in-progress` in the single file | [850873c] to [5c3c49d] | none |
| Label `wayfinder:claimed` | [5c3c49d] 2026-07-01 20:28 to [6f9e995] 2026-07-03 11:34 | `gh issue edit <n> --add-label wayfinder:claimed`; `glab issue update <n> --label wayfinder:claimed` |
| Assignee | [6f9e995], to date | `gh issue edit <n> --add-assignee @me`; `glab issue update <n> --assignee @me` |
| `Status: claimed` in a local file | [5c3c49d], to date | none |

The label claim lived 39 hours on `main`. The skill sat in `skills/in-progress/` then, which its README describes as "excluded from the plugin". The templates that carried the label were in a shipped skill folder, but no release was tagged in that window.

Recognition: a ticket is claimed when it is open and has any assignee, or carries `wayfinder:claimed`, or (local) reads `Status: claimed`. The frontier query drops a ticket with "an assignee", so any assignee counts, not only the developer driving the map. Report the label as drift.

### Children when sub-issues are off (P1 to P3)

- GitHub, native: the ticket is a sub-issue of the map.
- GitHub, fallback: "add the child to a task list in the map body and put `Part of #<map>` at the top of the child body". Upstream never shows the task list syntax or names the section it goes in.
- GitLab: `Part of #<map>` at the top of the description is the only link. The template uses no native parent link and no task list.
- Order: "first in map order wins" on GitHub and GitLab, "first by number wins" on the local tracker. On GitLab nothing defines a map order.

Recognition: read the native parent first. Otherwise match `^Part of #(\d+)` on the first non-empty body line, and read task list items (`- [ ] #n`, `- [x] #n`) in the map body for membership and order.

### Blockers when dependencies are off (B1, B2)

| Tracker | Native | Text fallback |
| --- | --- | --- |
| GitHub | Issue dependencies: `POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by`, read back as `issue_dependencies_summary.blocked_by` (open blockers only). Exact recipe since [8c2a4c5]; [5c3c49d] said only "native issue relationships where available". | `Blocked by: #<n>, #<n>` at the top of the child body |
| GitLab | `/blocked_by #<n>` quick action posted as a note, read back through `projects/:id/issues/:iid/links`. Premium and Ultimate only. | `Blocked by: #<n>, #<n>` at the top of the description |
| Local | none | `Blocked by: NN, NN` near the top; unblocked when every listed file is `resolved` |
| Single file | none | `blocked_by: [1, 2]`, then `Blocked by: #1, #2`, then `Blocked by: slug, slug` |

Recognition: `^(Blocked by|blocked_by):\s*(.*)$`, case-insensitive, within the first lines of the body. Tokens are `#?\d+` or slugs. An empty value or `[]` means no blockers. A blocker counts only while it is open.

Do not confuse this with `/to-tickets`, whose implementation issues use a `## Blocked by` section (tracker) or a `**Blocked by:**` line (local file). Those issues carry no `wayfinder:` label and no `Type:` line.

### Resolution (R1 to R3)

- Tracker: the answer is a comment, never part of the body. The session closes the issue and appends one line to the map's Decisions so far.
- Local: the answer goes under an `## Answer` heading in the ticket file, and the file gets `Status: resolved`.
- Out of scope: the ticket is closed and gets one line under Out of scope, and stays out of Decisions so far.
- Research, since [2602257]: the charting session fires a subagent per research ticket, which leaves the findings on a throwaway `research/<name>` branch and a pointer on the ticket. Research tickets can therefore close during charting, several per session.

### The local `.scratch` layout (L1)

The "Wayfinding operations" section of `issue-tracker-local.md` has kept its meaning since [5c3c49d]. Only punctuation changed, in [3216582].

- Map: `.scratch/<effort>/map.md`.
- Ticket: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, "with the question in the body". No `## Question` heading is asked for.
- `Type:` line: `research`, `prototype`, `grilling` or `task`.
- `Status:` line: `claimed` or `resolved`. An open ticket has neither value; the template does not say whether the line is absent or holds something else.
- `Blocked by: NN, NN` near the top.
- Frontier: files that are "open, unblocked, and unclaimed; first by number wins".
- Resolve: `## Answer` heading, `Status: resolved`, pointer in `map.md`.

Two collisions to handle:

- The same template uses the `Status:` line for triage roles (`needs-triage`, `ready-for-agent` and so on), so `Status:` is not wayfinder-specific.
- `/to-tickets` writes implementation tickets to the same `issues/NN-<slug>.md` path next to `spec.md` (`PRD.md` before [44eed54], 2026-07-10). A wayfinder effort is the directory that holds `map.md`; a wayfinder ticket has a `Type:` line.

### The GitLab template

| Concept | GitLab form |
| --- | --- |
| Map | Issue labelled `wayfinder:map`. "On GitLab tiers with native epics, an epic may hold the map instead". |
| Ticket | Issue with `Part of #<map>` at the top of the description and a `wayfinder:<type>` label |
| Claim | `glab issue update <n> --assignee @me` (the label form until [6f9e995]) |
| Blocker | Native blocking link through `/blocked_by #<n>`, or the `Blocked by:` line on the free tier |
| Frontier | `glab issue list -F json` scoped to the map's children, minus tickets with an open blocker or an assignee |
| Resolve | `glab issue note <n> --message "<answer>"`, `glab issue close <n>`, pointer on the map |

A map held by an epic has no `wayfinder:map` issue, so a label query misses it.

### Do `SKILL.md` and the templates disagree today?

Yes. At [d81f3a1] (`main`, 2026-09-29), and equally in the installed 1.2.3 copy:

1. **Map body.** All three templates say the map holds "the Notes / Decisions-so-far / Fog body". `SKILL.md` has used five sections since [3ea0131] (2026-07-05). The templates' map line has not changed since [5c3c49d], so every release that shipped wayfinder (v1.1.0 to v1.2.3) shipped this mismatch.
2. **Children in the map body.** `SKILL.md`: "Open tickets are **not** listed: they are open child issues, found by query." GitHub template: where sub-issues are off, "add the child to a task list in the map body".
3. **Local claim.** `SKILL.md`: "That assignee _is_ the claim". Local template: `Status: claimed`, with no assignee anywhere.
4. **Local answer.** `SKILL.md`: "The answer isn't part of the body". Local template: append it under `## Answer` in the ticket file.
5. **Ticket body.** `SKILL.md` gives a `## Question` template. No tracker template mentions the heading.
6. **Research.** `SKILL.md` puts findings on a `research/<name>` branch. No template's Resolve step mentions it.

One observation of what an agent does with mismatch 1: this repo's map, [hero-synergy v0.1.0, fully decided](https://github.com/dbarjs/hero-synergy/issues/1), lives in a repo whose tracker doc is the 1.2.3 template and names the three-section body. Its headings are Destination, Notes, Decisions so far, Not yet specified, Out of scope. The explicit template in `SKILL.md` won.

### Version numbers do not identify a convention

- The installed plugin reports 1.2.3 but sits at [84fdeff] (2026-08-06 20:49), a `main` commit after the `v1.2.3` tag ([6acc160], 15:05 the same day). The wayfinder files are identical in both.
- `main` still reports 1.2.3 at [d81f3a1], almost eight weeks later, with D2 and other changes waiting as changesets.
- The last change to `SKILL.md` on `main` is [3216582] (2026-08-19). No `issue-tracker-*.md` template has changed since that commit either.

## Differences from the seed

1. **"An earlier wayfinder version claimed tickets with a `wayfinder:claimed` label."** True of `main` for 39 hours (2026-07-01 20:28 to 2026-07-03 11:34), while the skill was in `skills/in-progress/` and outside the plugin. No tagged release contains it: v1.0.1 has no wayfinding section in the templates, and v1.1.0 already uses the assignee. It is a legacy form to tolerate, not a version users installed from a release.
2. **"Ticket types gained `task`."** `task` was added in [64d9f3d], ten hours before the `wayfinder:<type>` labels existed ([5c3c49d]). No tracker ever had a three-label set. A ticket set without `task` exists only in the single-file decision map, as a `Type:` line.
3. **"Matt's GitHub tracker template still describes the older ... body."** Correct, and wider than stated: the GitLab and local templates say the same, and there were two more bodies in between (M3 and M4). The body the templates describe was never the body of `SKILL.md` in any release.
4. **"The assignee is the claim"** (reconcile step). Not on a local tracker, where the claim is `Status: claimed` and names nobody.
5. **"Read `docs/agents/issue-tracker.md`"** (collect step). Since [d869d45] the skill finds the tracker doc through the pointer in `CLAUDE.md` or `AGENTS.md`. The path in the seed is the default that setup writes, not a guarantee.
6. **"Labels decide what the scout sees at all."** Three gaps: setup never creates the labels, a GitLab map may be an epic, and local trackers have no labels.

`CONTEXT.md` agrees with upstream. Its Fog entry names the "Not yet specified" section; a scout that reads older maps must also accept `Fog`.

## What could not be verified

- How common each legacy form is on real trackers. This research read upstream history and one map (this repo's). It surveyed no other repos.
- Whether anyone could install the 2026-07-01 to 2026-07-08 state: whether the plugin marketplace or `npx skills add` served `main` snapshots or `in-progress` skills in that window.
- The task list syntax and position for P2. Upstream never writes it out.
- The GitHub and GitLab API details quoted from the templates. They were not tested, apart from this repo's issue #10, where the parent and `issue_dependencies_summary` fields are populated.
- Where single-file decision maps were stored.
- What v1.3 will contain when tagged.

## Sources

Upstream files, read at [d81f3a1] and through `git log -p --follow`:

- `skills/engineering/wayfinder/SKILL.md` (earlier `skills/in-progress/wayfinder/`, `skills/in-progress/wayfinding/`, `skills/in-progress/decision-mapping/`, `skills/engineering/decision-mapping/`)
- `skills/engineering/setup-matt-pocock-skills/SKILL.md`, `issue-tracker-github.md`, `issue-tracker-gitlab.md`, `issue-tracker-local.md`
- `skills/engineering/to-tickets/SKILL.md`, `skills/engineering/research/SKILL.md`
- `skills/in-progress/README.md` at [5c3c49d] and at `v1.0.0`
- `docs/engineering/wayfinder.md`, `docs/engineering/setup-matt-pocock-skills.md`
- `CHANGELOG.md`, sections 1.1.0 and 1.2.0
- `.claude-plugin/plugin.json` at [ab7196a], `v1.0.0`, [5c3c49d] and `v1.1.0`

Release tags: `v1.0.0` and `v1.0.1` (2026-06-17), `v1.1.0` ([d574778], 2026-07-08), `v1.2.0` and `v1.2.2` (2026-08-05), `v1.2.3` ([6acc160], 2026-08-06).

Installed copy: `~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.2.3/`, at [84fdeff].

Commits cited:

[ab7196a]: https://github.com/mattpocock/skills/commit/ab7196a1584ac60688aeb63cf0b56a5114c4a6f3
[bc4cf90]: https://github.com/mattpocock/skills/commit/bc4cf903ff4855ce23199a8dd3bf98b3dbd7ad71
[42396a5]: https://github.com/mattpocock/skills/commit/42396a51d66f07d2f521d728108e7a6c0a1b32c2
[850873c]: https://github.com/mattpocock/skills/commit/850873cd73d5f81826ebf512ad35d2b1e113001f
[a116824]: https://github.com/mattpocock/skills/commit/a116824938b4f1171d6ff9af536671485d28b5f1
[3dc6800]: https://github.com/mattpocock/skills/commit/3dc68005505bbcb9eb8317132eb50231df53a457
[79a5c9c]: https://github.com/mattpocock/skills/commit/79a5c9cc5563c19e303dce8c3308988bcfb007ed
[64d9f3d]: https://github.com/mattpocock/skills/commit/64d9f3d49ec04c30d60e57df39225808c2dbfae3
[4027ea6]: https://github.com/mattpocock/skills/commit/4027ea6afdd329aefb6671ab9f2bc12482fb6d76
[01f0b7e]: https://github.com/mattpocock/skills/commit/01f0b7e11ac48b40dda92a5497e8d8ada33d39c5
[5c3c49d]: https://github.com/mattpocock/skills/commit/5c3c49df1a6c24019ea56690088810961cd3370c
[46be3d6]: https://github.com/mattpocock/skills/commit/46be3d60a0fca970f615ccced239803c759335df
[ee014fa]: https://github.com/mattpocock/skills/commit/ee014fa8b13939195e0fe4f4c6310b5737569338
[8c2a4c5]: https://github.com/mattpocock/skills/commit/8c2a4c554afaa5ec6efecc98258058ba69b72c48
[6f9e995]: https://github.com/mattpocock/skills/commit/6f9e9956fd01235599cdba40f5b8ca3a92fc0045
[53c6219]: https://github.com/mattpocock/skills/commit/53c6219cd2a1d2746d6ee59705862f171ea09451
[299eb0c]: https://github.com/mattpocock/skills/commit/299eb0c0171c06ee1d9a16a9235912ba6893fd57
[3ea0131]: https://github.com/mattpocock/skills/commit/3ea01314c16e374230be29cd8b067924f000ea6e
[7be28cf]: https://github.com/mattpocock/skills/commit/7be28cf5e64a7c990e42db44ea97665df2adfa75
[e5932a7]: https://github.com/mattpocock/skills/commit/e5932a7a47e5cae312c1b814ce6194b09aa27be1
[d869d45]: https://github.com/mattpocock/skills/commit/d869d45afc32beab1c2d1350f8de5e81589512cd
[d574778]: https://github.com/mattpocock/skills/commit/d574778f94cf620fcc8ce741584093bc650a61d3
[44eed54]: https://github.com/mattpocock/skills/commit/44eed545186ffd0263e8004867750b80cfddd215
[7d694b7]: https://github.com/mattpocock/skills/commit/7d694b7ae981ca221a8f759b15273fe7b5dc393e
[0d54032]: https://github.com/mattpocock/skills/commit/0d540325264ec1f816636ae0c6494bec044754a2
[2602257]: https://github.com/mattpocock/skills/commit/260225724133c4a204489599f04642aa089259a0
[6acc160]: https://github.com/mattpocock/skills/commit/6acc160e4e0cd062dbbbd7a1b26ae92855edf07e
[84fdeff]: https://github.com/mattpocock/skills/commit/84fdeffd12f2ee307994d1eb6feb48173b6e0502
[3216582]: https://github.com/mattpocock/skills/commit/321658273cb1d20b76026717d027d505790106d4
[d81f3a1]: https://github.com/mattpocock/skills/commit/d81f3a183412e71a5b1e84ca21bc1a35eea03a60
