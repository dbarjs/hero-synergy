# Which forms do specs and build tickets take, upstream and in the wild?

Research for [#197 Which forms do specs and build tickets take, upstream and in the wild?](https://github.com/dbarjs/hero-synergy/issues/197), on the map [#195 Specs and build tickets in the Cockpit](https://github.com/dbarjs/hero-synergy/issues/195), done on 2026-11-16. The method is the one of [`wayfinder-conventions.md`](https://github.com/dbarjs/hero-synergy/blob/research/wayfinder-conventions/docs/research/wayfinder-conventions.md) ([#10 Which wayfinder conventions exist in the wild?](https://github.com/dbarjs/hero-synergy/issues/10)) and [`local-tracker-state-forms.md`](https://github.com/dbarjs/hero-synergy/blob/research/local-tracker-state-forms/docs/research/local-tracker-state-forms.md) ([#131 State forms on a real local tracker](https://github.com/dbarjs/hero-synergy/issues/131)).

Three sources, all primary:

- **Upstream**: the git history of `mattpocock/skills`, every tag from `v1.0.0` to `v1.3.2` and `main` at [5863806] (2026-11-12), read with `git log -p --follow`, `git show <rev>:<file>` and `git grep <tag>`. A date is the commit's author date. Where a commit reached `main` later than it was written, both dates are given. "Released in" is the first tag that contains the commit.
- **This repo's tracker**: all 147 issues of `dbarjs/hero-synergy`, read once through `gh api graphql` on 2026-11-16 between 19:02 and 19:30 UTC (`parent`, `subIssues`, `blockedBy`, `closedByPullRequestsReferences`, labels, assignees, body, last comment). Every count below is a count of issues in that one read. One thing has moved since: [#173 Read every Blocked by and Blocks form a local tracker holds](https://github.com/dbarjs/hero-synergy/issues/173) closed at 19:30 through its pull request, so one build ticket counted open here, the one with an open pull request, is now closed.
- **Local trackers**: the three committed fixtures under `packages/core/fixtures/` at `main` [`1f61899`](https://github.com/dbarjs/hero-synergy/commit/1f61899): `scratch-mirror` (a sanitized mirror of a private tracker: shapes and counts only, its words are replaced), `local-forms` and `local-tracker` (invented text), with the two `truth.json` files. Every count is a count of files.

The words are the map's, and the glossary's since [`0976622`](https://github.com/dbarjs/hero-synergy/commit/0976622) (2026-11-16): a **spec** is the issue `/to-spec` publishes or the local `spec.md`; a **build ticket** is a child of a spec; a **decision ticket** is a child of a map.

## Answer

- **Upstream has never given a spec a mark of its own.** It is one issue with seven H2 headings that have not changed since the first commit (2026-02-03), carrying the same `ready-for-agent` label as its build tickets since 2026-05-06. No title rule, no link to a map, no label that says "spec".
- **A build ticket's body has kept two headings since 2026-02-20**: `## What to build` and `## Acceptance criteria`. `## Parent` and `## Blocked by` come and go: `## Parent` is left out when the source was not an issue, and `## Blocked by` is left out since 1.3.2 when the blockers are native edges.
- **The parent link was optional until 1.3.2.** From 1.1.0 to 1.3.1 the skill said to use native sub-issues "where it has one"; upstream's own docs call the missing sub-issue link a reported failure across a dozen runs. Since 1.3.2 each ticket is a sub-issue of its source issue.
- **On this repo's tracker the forms separate cleanly.** 3 specs, 37 build tickets, 7 maps, 91 decision tickets and 9 other issues. The headings alone sort all 147: the seven spec headings sit on the 3 specs and nowhere else, `## What to build` with `## Acceptance criteria` on the 37 build tickets and nowhere else, `## Question` on the 91 decision tickets and nowhere else.
- **All 37 build tickets say everything twice.** Each is a native sub-issue and has a `## Parent` section naming the same spec; each has native blocked-by edges and a `## Blocked by` section listing the same numbers (57 edges, 37 of 37 agree).
- **A spec is not always a parent.** [#155 Launch AFK sessions with permissions bypassed in isolated environments](https://github.com/dbarjs/hero-synergy/issues/155) has the seven headings and the label, no build ticket, and was built and closed by one pull request. It also has the same title as its map, word for word.
- **A spec names its map in prose only, in the same place each time**: the paragraph before `## Problem Statement` links the map (3 of 3). Upstream's template has no such paragraph.
- **Locally, the mirror holds no `spec.md`.** It holds two `PRD.md` files. One sits in an effort that also has a map, with 12 issue files that point at it with a bold `**Parent:**` line, numbered 11 to 22 between the map's own tickets. The other sits in an effort with no map, and its 10 issue files point at nothing: the PRD lists them in a table.
- **The checkboxes say nothing about state.** 26 of the 28 closed build tickets on GitHub still have every acceptance box empty; on the mirror, 8 open issue files have every box ticked. Upstream's `/implement` never ticks them and never closes the ticket.
- **The scout reads none of this today.** On GitHub it collects open `wayfinder:map` issues and their sub-issues, so it never fetches a spec or a build ticket. Locally it reads no `spec.md` or `PRD.md` and no `Parent:` line.

## The catalogue

| #   | Form                                                                                                                                                                                                                                                                         | Applied                                                              | Released in              | What code could key on                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| S1  | Spec is a GitHub issue with seven H2s: `Problem Statement`, `Solution`, `User Stories`, `Implementation Decisions`, `Testing Decisions`, `Out of Scope`, `Further Notes`. No label. Skill named `write-a-prd`, then `to-prd`                                                 | [985d8fc] 2026-02-03 to [7afa86d] 2026-04-28                         | none                     | the seven H2s, in order                                                                   |
| S1a | Same with an eighth H2, `'Polishing' Requirements`, after `User Stories`                                                                                                                                                                                                     | [4458b65] 2026-02-10 to [8e51ff7] 2026-02-20                         | none                     | H2 `'Polishing' Requirements`                                                             |
| S2  | Same seven H2s, published "to the project backlog" (the "issue tracker" from [179a14e]) with the `needs-triage` label                                                                                                                                                        | [7afa86d] 2026-04-28 to [7014111] 2026-05-06                         | none                     | the seven H2s; label `needs-triage`                                                       |
| S3  | Same, with the `ready-for-agent` label; still called a PRD                                                                                                                                                                                                                   | [7014111] 2026-05-06 to [386d4ff] (on `main` 2026-07-08)             | v1.0.0, v1.0.1           | the seven H2s; label `ready-for-agent`                                                    |
| S4  | Same seven H2s and label, called a spec; skill named `to-spec`                                                                                                                                                                                                               | [386d4ff] written 2026-07-02, on `main` 2026-07-08, to date          | v1.1.0 to v1.3.2, `main` | the seven H2s; label `ready-for-agent`                                                    |
| SL1 | Local spec is `.scratch/<feature-slug>/PRD.md`                                                                                                                                                                                                                               | [179a14e] 2026-04-28 to [44eed54] 2026-07-10                         | v1.0.0 to v1.1.0         | the file name                                                                             |
| SL2 | Local spec is `.scratch/<feature-slug>/spec.md`                                                                                                                                                                                                                              | [44eed54] 2026-07-10, to date                                        | v1.2.0 to v1.3.2, `main` | the file name                                                                             |
| T1  | Build ticket is a GitHub issue: `## Parent PRD` holding `#<n>`, `## What to build`, `## Acceptance criteria`, `## Blocked by` holding `- Blocked by #<n>` or "None - can start immediately", `## User stories addressed`. No label. Skill named `prd-to-issues`              | [8e51ff7] 2026-02-20 to [aaf3050] 2026-04-17                         | none                     | H2 `Parent PRD`, H2 `User stories addressed`                                              |
| T2  | `## Parent` (left out when the source was not an issue), `## What to build`, `## Acceptance criteria`, `## Blocked by`. Skill named `to-issues`. No label until [7afa86d], `needs-triage` until [e736396] 2026-05-06, then "the correct triage label" for an AFK-ready issue | [aaf3050] 2026-04-17 to [386d4ff] (on `main` 2026-07-08)             | v1.0.0, v1.0.1           | H2 `What to build` and H2 `Acceptance criteria`                                           |
| T3  | Same four H2s, label `ready-for-agent` "unless instructed otherwise". Native sub-issue or blocking link "where it has one; otherwise" the `## Blocked by` text. Skill named `to-tickets`                                                                                     | [386d4ff] on `main` 2026-07-08, to [cffab50] 2026-10-06              | v1.1.0 to v1.3.1         | the two H2s; a native parent when the session made one                                    |
| T4  | Each ticket is a sub-issue of its source issue; `## Blocked by` is left out when blockers are native edges; `## Parent` stays in the template                                                                                                                                | [cffab50] and [9e2abf8] 2026-10-06, to date                          | v1.3.2, `main`           | native parent; native blocked-by; the two H2s                                             |
| L1  | Local tickets are one `tickets.md` in the repo root: `# Tickets: <name>`, one `## <Ticket title>` per ticket, `**What to build:**`, `**Blocked by:**` (titles), `- [ ]` criteria                                                                                             | [386d4ff] on `main` 2026-07-08, to [44eed54] 2026-07-10              | v1.1.0 only              | file `tickets.md` at the root, H1 `Tickets:`                                              |
| L2  | One file per ticket, `.scratch/<feature-slug>/issues/<NN>-<slug>.md`: `# <NN> — <Ticket title>`, `**What to build:**`, `**Blocked by:**` (numbers or titles, or "None — can start immediately"), `**Status:** ready-for-agent`, `- [ ]` criteria under no heading            | [44eed54] 2026-07-10 to [3216582] 2026-08-19                         | v1.2.0 to v1.2.3         | bold keys `What to build`, `Blocked by`, `Status` before any H2; checkboxes before any H2 |
| L3  | Same with `# <NN>: <Ticket title>` and "None (can start immediately)"                                                                                                                                                                                                        | [3216582] 2026-08-19, to date                                        | v1.3.0 to v1.3.2, `main` | same                                                                                      |
| P1  | Generic parent fallback in the GitHub tracker doc: `Part of #<parent>` at the top of the child body                                                                                                                                                                          | [cffab50] 2026-10-06, to date                                        | v1.3.2                   | first body line `^Part of #\d+`; the same line a decision ticket uses                     |
| P2  | Generic blocker fallback in the GitHub tracker doc: `Blocked by: #<n>, #<n>` at the top of the child body                                                                                                                                                                    | [ed0de59] 2026-10-27 (moved out of "Wayfinding operations"), to date | v1.3.2                   | the line; the same line a decision ticket uses                                            |

Counted on real trackers:

| #   | Form                                                                                                                      | Where          | Count                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------- |
| G1  | Spec as S4, with a paragraph before the first H2 that links its map                                                       | this repo      | 3 of 3 specs                                                                                |
| G2  | Spec with sub-issues                                                                                                      | this repo      | 2 of 3 (26 and 11 children)                                                                 |
| G3  | Spec with no build ticket, closed by a pull request                                                                       | this repo      | 1 of 3                                                                                      |
| G4  | Build ticket as T3 with all four H2s, a native parent, native blockers and the label                                      | this repo      | 37 of 37                                                                                    |
| G5  | Issue labelled `ready-for-agent` with no parent that is not a spec                                                        | this repo      | 1 ([#36 Write the upstream-review skill](https://github.com/dbarjs/hero-synergy/issues/36)) |
| M1  | `PRD.md` with header lines `Status: ready-for-agent`, `Label: prd`, `Map: [<title>](MAP.md)`, in an effort that has a map | scratch mirror | 1 of 49 efforts                                                                             |
| M2  | `PRD.md` with no header line and an `## Issues` table of its tickets and their states, in an effort with no map           | scratch mirror | 1 of 49 efforts                                                                             |
| M3  | Issue file in the L2 shape plus `**Parent:** [<title>](../PRD.md)`                                                        | scratch mirror | 12 of 257 issue files                                                                       |
| M4  | Issue file under a PRD with `Status: done` and no line that names the PRD                                                 | scratch mirror | 10 of 257                                                                                   |
| M5  | `spec.md`                                                                                                                 | scratch mirror | 0                                                                                           |

## Upstream over time

### The names

| Today            | Earlier names                                                                                                               | Renamed in                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `to-spec`        | `write-a-prd` (from [985d8fc], 2026-02-03), `to-prd` (from [aaf3050], 2026-04-17)                                           | [386d4ff]                                                                 |
| `to-tickets`     | `prd-to-issues` (from [8e51ff7], 2026-02-20), `to-issues` (from [aaf3050])                                                  | [386d4ff], which deleted `to-issues` and added `to-tickets` as a new file |
| `implement`      | none (added in [ffb2fa6], 2026-06-10)                                                                                       |                                                                           |
| `implement-spec` | none (added in [84b5ee5], 2026-08-21, under `skills/in-progress/`; moved to `skills/engineering/` in [24f41cc], 2026-09-24) |                                                                           |

[386d4ff] was written on 2026-07-02 and rebased into the 1.1 release branch: it reached `main` in the merge [cc1e248] on 2026-07-08, the day `v1.1.0` was tagged. Until then `main` held `to-prd` and `to-issues`. So `v1.0.0` and `v1.0.1` ship the PRD names and `v1.1.0` is the first release with `to-spec` and `to-tickets`.

Two plan skills are part of the same lineage and wrote no tracker form that survives:

- `prd-to-plan` ([4dd409d] 2026-03-02 to [a77fa6e] 2026-04-17, before any tag) wrote `./plans/<feature>.md`: `# Plan: <Feature Name>`, `> Source PRD: …`, `## Phase 1: <Title>` with `### What to build` and `### Acceptance criteria`.
- `to-plan` ([93f7319], written 2026-07-01) existed only inside the 1.1 release branch. [386d4ff], written the next day, deleted it in the same branch, so no first-parent state of `main` and no tag ever held it. It would have written a root `plan.md` or one parent issue with a sub-issue per phase.

### The spec

The template is the part between `<prd-template>` (later `<spec-template>`) tags. Its seven H2 headings are the same in [985d8fc] (2026-02-03) and in `v1.3.2`:

```markdown
## Problem Statement

## Solution

## User Stories

## Implementation Decisions

## Testing Decisions

## Out of Scope

## Further Notes
```

- The only heading change in the file's history is the eighth H2 `## 'Polishing' Requirements`, added in [4458b65] and removed ten days later in [8e51ff7].
- `User Stories` asks for "a LONG, numbered list" in the form `1. As an <actor>, I want a <feature>, so that <benefit>`, unchanged since [985d8fc].
- The rename in [386d4ff] changed the word "PRD" to "spec" and the tag name, not a heading. The last change to the file is [5c89081] (2026-08-19), which quoted the front matter. `v1.3.0` to `main` are byte-identical.
- **Where it is published.** "Submitted as a GitHub issue" until [7afa86d] (2026-04-28), then "publish it to the project backlog", then "to the project issue tracker" from [179a14e] the same day.
- **The label.** None until [7afa86d]; `needs-triage` "so it enters the normal triage flow" until [7014111] (2026-05-06); since then "Apply the `ready-for-agent` triage label - no need for additional triage". That sentence is in every tag.
- **What the template never held**: a title rule, a reference to the map or conversation the spec came from, a list of its tickets, or a status. The skill's body names no argument. The docs page documents `/to-spec #<map_issue>` for a cleared map since [fd10de9] (2026-08-05).
- **Upstream on the label**, in `docs/engineering/to-spec.md` since [fd10de9] (2026-08-05): the label "marks an input, not a work order. But AFK agents that poll for `ready-for-agent` cannot see that difference … This is the most-reported problem with the skill. Until it changes, exclude the parent spec explicitly in your AFK agent's prompt, or remove the label after `/to-tickets` has run."
- **Upstream on its lifetime**, same page: "If you change direction, delete the unfinished tickets and keep the spec", and "Treat it as disposable after the work ships".

### The build ticket on a tracker

The issue template, between `<issue-template>` tags:

| Commit                          | `## Parent`                                                                                                         | `## What to build` | `## Acceptance criteria` | `## Blocked by`                                                            | Other                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| [8e51ff7] 2026-02-20            | `## Parent PRD`, body `#<prd-issue-number>`                                                                         | yes                | three `- [ ]` items      | `- Blocked by #<issue-number> (if any)`, or "None - can start immediately" | `## User stories addressed` with `- User story 3` items |
| [aaf3050] 2026-04-17            | `## Parent`, body `#<parent-issue-number>`, left out when the source was not a GitHub issue                         | yes                | same                     | same                                                                       | the fifth H2 is gone                                    |
| [7afa86d] 2026-04-28            | "A reference to the parent ticket on the backlog" (the "issue tracker" from [179a14e])                              | yes                | same                     | "A reference to the blocking ticket (if any)"                              |                                                         |
| [386d4ff] on `main` 2026-07-08  | "A reference to the parent issue on the tracker (if the source was an existing issue, otherwise omit this section)" | yes                | two `- [ ]` items        | "A reference to each blocking ticket, or 'None — can start immediately'"   |                                                         |
| [3216582] 2026-08-19            | same                                                                                                                | yes                | same                     | "None (can start immediately)"                                             |                                                         |
| [cffab50], [9e2abf8] 2026-10-06 | same                                                                                                                | yes                | same                     | adds "Omit this section when blockers were set as native edges"            |                                                         |

- `## What to build` and `## Acceptance criteria` are in every version. The criteria are always `- [ ]` items.
- **The label.** None until [7afa86d]; `needs-triage` until [e736396] (2026-05-06); then "considered ready for AFK agents, so publish them with the correct triage label unless instructed otherwise", which is the `ready-for-agent` role without its name. `to-tickets` names it from [386d4ff], in today's wording: "Apply the `ready-for-agent` triage label unless instructed otherwise; the tickets are agent-grabbable by construction."
- **HITL and AFK.** From [78649ba] (2026-02-25) to [788b5c3] (2026-06-03) the skill sorted slices into HITL and AFK while quizzing the user. The issue template never had a line for it, and no tag holds that step.
- **Titles.** A "short descriptive name". No prefix, no number.
- **No spec at all.** The source may be "a plan, spec, or the current conversation". With no source issue the template leaves `## Parent` out, so upstream also writes build tickets with no parent of any kind.

### The parent link and the blockers

| Commit                                                            | How a ticket points at its source                                                                                                                                       | How blockers are written                                                                                      |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [8e51ff7] 2026-02-20 to [0172e61]                                 | the `## Parent` section only                                                                                                                                            | the `## Blocked by` section only; issues are created blockers first "so you can reference real issue numbers" |
| [0172e61] 2026-07-06 (`to-issues`, two days on `main`, in no tag) | "link each slice to its parent as a native **sub-issue**" where the tracker supports it; "the `## Parent` and `## Blocked by` body sections are the fallback otherwise" | "wire each blocker as a native **blocking edge**"                                                             |
| [386d4ff] on `main` 2026-07-08, v1.1.0 to v1.3.1                  | "Use the platform's native blocking / sub-issue relationship where it has one; otherwise set each ticket's 'Blocked by' to the blocking issues"                         | same sentence                                                                                                 |
| [cffab50], [9e2abf8] 2026-10-06, v1.3.2                           | "If the source was an existing issue, make each ticket its sub-issue (tracker doc's operation)"                                                                         | "Use the platform's native blocking relationship where it has one; otherwise set each ticket's 'Blocked by'"  |

- From 1.1.0 to 1.3.1 no tracker doc gave a command for a sub-issue outside its "Wayfinding operations" section. [cffab50] added the general line to the GitHub template: `gh issue create --parent <parent>`, `gh issue edit <parent> --add-sub-issue <child>` (`gh` 2.94 or later), the REST route for an older `gh`, and "Without sub-issues, put `Part of #<parent>` at the top of the child body".
- [ed0de59] (2026-10-27) moved blocking out of "Wayfinding operations" into the template's general conventions: `gh issue create --blocked-by <n>,<n>`, `gh issue edit <child> --add-blocked-by <blocker>`, and the fallback "a `Blocked by: #<n>, #<n>` line at the top of the child body". The same commit changed Close to a comment followed by `gh issue close`.
- Both are in `v1.3.2`. A repo keeps the tracker doc of the day it ran `/setup-matt-pocock-skills`, so the changelog tells users to re-run it.
- Upstream's own account of the earlier releases, in `docs/engineering/to-tickets.md` at `v1.3.2`: "On GitHub the tickets weren't created as sub-issues of the spec issue. This was reported across a dozen runs and several models", and "'Blocked by' was written into the issue body instead of a real blocking link". So a tracker written by 1.1.0 to 1.3.1 can hold build tickets whose only link to the spec is the `## Parent` text, and whose only blockers are the `## Blocked by` text.
- The fallbacks collide with wayfinder's: since 1.3.2 a build ticket in a repo without sub-issues carries `Part of #<spec>`, the line a decision ticket carries for its map since 1.1.0, and the `Blocked by: #<n>` line is the same for both. The line cannot say which kind the child is; the parent has to.
- GitLab: [cffab50] added "Attach an issue to a parent issue … put `Part of #<parent>` at the top" and [9e2abf8] removed it five minutes later, so the GitLab template at `v1.3.2` gives `to-tickets` no parent operation. The local template has none either.

### The local forms

Two documents write a local build ticket, and they have disagreed in every release:

| Release                  | The local tracker doc (`issue-tracker-local.md`)                                                                                                                                                                                                                           | The skill                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| v1.0.0, v1.0.1           | "The PRD is `.scratch/<feature-slug>/PRD.md`"; "Implementation issues are `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`"; "Triage state is recorded as a `Status:` line near the top"; comments under `## Comments` (all from [179a14e], 2026-04-28) | `to-issues` has no local template: only the four-H2 issue template |
| v1.1.0                   | unchanged                                                                                                                                                                                                                                                                  | `to-tickets` writes one `tickets.md` in the repo root (L1)         |
| v1.2.0 to v1.2.3         | "The spec is `.scratch/<feature-slug>/spec.md`"; "one file per ticket … never a single combined tickets file" ([44eed54], 2026-07-10)                                                                                                                                      | `<local-ticket-template>`, L2                                      |
| v1.3.0 to v1.3.2, `main` | same                                                                                                                                                                                                                                                                       | L3                                                                 |

The local ticket template at `v1.3.2`:

```markdown
# <NN>: <Ticket title>

**What to build:** …

**Blocked by:** the numbers/titles of the tickets that gate this one, or "None (can start immediately)".

**Status:** ready-for-agent

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2
```

- The tracker doc says "a `Status:` line"; the skill's template writes the key bold, `**Status:**`. It writes `**Blocked by:**` bold too, where the doc's wayfinding form is a plain `Blocked by: NN, NN` line.
- The template has no line that names the spec. A local build ticket belongs to the spec in its own directory, and to nothing when the directory holds none.
- The acceptance criteria sit under no heading, before any H2. A local ticket written from this template has no H2 until a `## Comments` is appended.
- `<NN>` is "numbered from `01` in dependency order (blockers first)". The docs page calls it "a real ticket ID, so `/implement 03` works".
- The path is the one wayfinder uses for a decision ticket: `.scratch/<effort>/issues/NN-<slug>.md` beside `map.md` (since [5c3c49d], 2026-07-01). Upstream does not say whether a spec written from a map goes into the map's directory.
- The doc and the template name no closed state for a local build ticket. `claimed` and `resolved` belong to "Wayfinding operations".

### Who closes a build ticket

- `implement` ([ffb2fa6], 2026-06-10, in `v1.0.0`) ends at "Commit your work to the current branch." Its docs page at `v1.3.2`: "`implement` has no completion step. It ends at the commit and never touches the work item … does not tick the `- [ ]` boxes on the originating issue. Close the ticket and reconcile the criteria yourself."
- Since [6d6a5b9] (2026-10-07, `v1.3.2`): "If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask."
- `implement-spec` (in `v1.3.0`) opens "a draft PR … marked as closing the spec and tickets" when the tracker closes work through PRs, else resolves "each ticket the way the issue tracker closes work" ([153fc1b], 2026-09-24). So one pull request can close a spec and all its build tickets at once. `main` differs from `v1.3.2` in this skill only ([a496f55], a fresh subagent per ticket), which changes no form.
- Upstream defines no resolution comment for a build ticket. The comment-then-close line in the tracker doc is general.

### The neighbours a build ticket can be taken for

- **A triaged issue.** `/triage` gives an issue one category role (`bug` or `enhancement`) and one state role, and on `ready-for-agent` posts an agent brief as a **comment**: `## Agent Brief`, `**Category:**`, `**Summary:**`, `**Acceptance criteria:**` with `- [ ]` items, `**Out of scope:**` (template since [651eab0], 2026-04-01, under `github-triage`; in every tag). The body stays the reporter's. `ask-matt` at `v1.3.2`: "Tickets that `/to-tickets` produced are already agent-ready, so **don't triage them**."
- **A decision ticket.** Body `## Question`, one `wayfinder:<type>` label, child of a map. Before [8295b8e] (2026-10-07, `v1.3.2`) nothing forbade a triage label on it, and that commit's message records why it was added: "Maps and tickets picked up a triage-state label (ready-for-agent), which reads as 'ready to implement'". Since 1.3.2: "`wayfinder:` labels are the only labels a map and its tickets carry, never a triage label like `ready-for-agent`".
- **The label string itself.** `triage-labels.md` maps each canonical role to "the actual label strings used in this repo's issue tracker", so `ready-for-agent` is a role name, not a guaranteed label.

## This repo's GitHub tracker

Counted on 2026-11-16. The scripts classified an issue by its labels, its native parent and its children, then the headings were checked against that.

| Kind            | Issues | Labels                                       | Native parent | Body H2s                                                                                   |
| --------------- | ------ | -------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------ |
| Map             | 7      | `wayfinder:map` only                         | none          | the five map headings on 6; one has no `Out of scope`                                      |
| Decision ticket | 91     | exactly one `wayfinder:<type>`, nothing else | a map         | every body starts with `## Question`                                                       |
| Spec            | 3      | `ready-for-agent` only                       | none          | the seven spec headings, in order                                                          |
| Build ticket    | 37     | `ready-for-agent` only                       | a spec        | `Parent`, `What to build`, `Acceptance criteria`, `Blocked by`, in order, and nothing else |
| Other           | 9      | see below                                    | none          | their own                                                                                  |

- No decision ticket or map carries a triage label, and no spec or build ticket carries a `wayfinder:` label.
- The labels `bug` and `enhancement` exist and are on no issue. A search of comments for "Agent Brief" returns nothing. This tracker holds no triaged issue.
- The register records that every session up to 2026-10-07 ran the installed plugin 1.2.3 at `84fdeff` (`docs/upstream.md`, "Tested ceiling"), whose `to-spec`, `to-tickets` and templates are identical to `v1.2.3`. All 37 build tickets were created on 2026-10-07 and 2026-10-09, before `v1.3.2` (2026-10-29). So everything here is form T3 and S4.

### The three specs

|                        | [#37 Spec: hero-synergy v0.1.0, the Cockpit](https://github.com/dbarjs/hero-synergy/issues/37) | [#155 Launch AFK sessions with permissions bypassed in isolated environments](https://github.com/dbarjs/hero-synergy/issues/155)                                                      | [#163 Read a local tracker's state in every form a real five-month tracker holds](https://github.com/dbarjs/hero-synergy/issues/163) |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Map                    | [#1 hero-synergy v0.1.0, fully decided](https://github.com/dbarjs/hero-synergy/issues/1)       | [#123 Launch AFK sessions with permissions bypassed in isolated environments](https://github.com/dbarjs/hero-synergy/issues/123)                                                      | [#130 State reading for local trackers, tested against a real five-month tracker](https://github.com/dbarjs/hero-synergy/issues/130) |
| First line of the body | `Produced by /to-spec from the finished map [#1 <title>](<url>).`                              | `From the map [#123 <title>](<url>).`                                                                                                                                                 | `From the map [#130 <title>](<url>).`                                                                                                |
| Title                  | starts with `Spec:`                                                                            | the map's title, word for word                                                                                                                                                        | its own                                                                                                                              |
| Sub-issues             | 26, all closed                                                                                 | 0                                                                                                                                                                                     | 11, 2 closed                                                                                                                         |
| State                  | closed by hand on 2026-11-16, last comment `## Built and shipped`                              | closed on 2026-11-16 by the merged pull request [#179 Launch AFK sessions with permissions bypassed in isolated environments (#155)](https://github.com/dbarjs/hero-synergy/pull/179) | open                                                                                                                                 |
| Assignee               | none                                                                                           | `dbarjs`                                                                                                                                                                              | none                                                                                                                                 |
| Body length            | 62,791 characters                                                                              | 24,843                                                                                                                                                                                | 55,077                                                                                                                               |

- **The headings.** All three hold exactly the seven H2s of S4. No other issue on the tracker holds any of `Problem Statement`, `Solution`, `User Stories`, `Implementation Decisions`, `Testing Decisions` or `Further Notes`.
- **The label.** All three still carry `ready-for-agent`, the two closed ones included.
- **How a spec names its map.** In the paragraph before `## Problem Statement`, as a Markdown link to the map issue, 3 of 3. No native link exists: `parent` is null on all three. The mention shows on the map's timeline as a cross-reference, but so do other issues: 11 issues outside the map's own children cross-reference [#1 hero-synergy v0.1.0, fully decided](https://github.com/dbarjs/hero-synergy/issues/1), and 6 cross-reference [#130 State reading for local trackers, tested against a real five-month tracker](https://github.com/dbarjs/hero-synergy/issues/130).
- **How a map names its spec.** Two maps ([#123 Launch AFK sessions with permissions bypassed in isolated environments](https://github.com/dbarjs/hero-synergy/issues/123) and [#130 State reading for local trackers, tested against a real five-month tracker](https://github.com/dbarjs/hero-synergy/issues/130)) name it in one line under `## Not yet specified` (`Nothing left. The spec, [<title>](<url>), settled …`). The body of [#1 hero-synergy v0.1.0, fully decided](https://github.com/dbarjs/hero-synergy/issues/1) never names [#37 Spec: hero-synergy v0.1.0, the Cockpit](https://github.com/dbarjs/hero-synergy/issues/37). All three name it in their closing comment, `## Destination reached`, posted on 2026-11-16.
- **A spec with no build ticket.** The map of [#155 Launch AFK sessions with permissions bypassed in isolated environments](https://github.com/dbarjs/hero-synergy/issues/155) says why in its closing comment: its build "covers the whole spec in one PR … so the spec isn't split into tickets". Upstream's flow allows this: the docs page of `implement` sends "A spec, and the build is small" to "`/implement` directly against the spec".

### The 37 build tickets

- **Headings.** 37 of 37 hold `## Parent`, `## What to build`, `## Acceptance criteria`, `## Blocked by` in that order, start with `## Parent`, and hold no other heading at any level.
- **The parent, twice.** 37 of 37 are native sub-issues of their spec, and their `## Parent` section starts with `#<spec number> <spec title>.` naming the same issue. 36 follow it with `Spec section(s): "…"`.
- **The blockers, twice.** 57 native blocked-by edges, every one between two build tickets of the same spec. The `## Blocked by` section lists the same numbers on 37 of 37: 57 items of the shape `- #<n> <title>`, and "None — can start immediately." on the 6 tickets with no blocker (3 as a list item, 3 as a plain line).
- **Acceptance criteria.** Only checkbox items, 4 to 11 per ticket.
- **Labels.** `ready-for-agent` and nothing else, 37 of 37, closed ones included.
- **Claim.** All 28 closed tickets are assigned to `dbarjs`. Of the 9 open ones, 1 is assigned and has an open pull request; 8 are unassigned. `/implement` does not ask for the assignment.
- **Order.** The sub-issue list of [#163 Read a local tracker's state in every form a real five-month tracker holds](https://github.com/dbarjs/hero-synergy/issues/163) is not in number order: [#170 Record the wild forms in the upstream register and watch the local template](https://github.com/dbarjs/hero-synergy/issues/170) sits after [#176 Show a ticket's triage role and Status line in the Cockpit](https://github.com/dbarjs/hero-synergy/issues/176).
- **Titles.** An imperative sentence. No prefix marks a build ticket.

### What a closed build ticket looks like

28 are closed, all with the state reason `COMPLETED`.

|                                                                                                                    | Tickets                                   |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Closed by a merged pull request (`closedByPullRequestsReferences`), from a branch named `worktree-<ticket number>` | 22                                        |
| No closing pull request recorded                                                                                   | 6                                         |
| No comment at all                                                                                                  | 11 (all of them closed by a pull request) |
| At least one comment                                                                                               | 17                                        |
| Last comment starts "Built … in #<pr>"                                                                             | 11                                        |
| Last comment starts "Resolved:"                                                                                    | 3                                         |
| Last comment starts `## Close-out`                                                                                 | 2                                         |
| Last comment is a follow-up written after the close                                                                | 1                                         |
| Last comment posted after the ticket closed                                                                        | 11 of the 17                              |
| Every acceptance box still empty                                                                                   | 26                                        |
| Every acceptance box ticked                                                                                        | 2                                         |

- Every closed build ticket has a merged closing pull request or a comment; 11 have only the pull request.
- Read by the decision-ticket rule (the resolution is the last comment), 11 of 28 would have no resolution, and one would show a follow-up note as its answer.
- For comparison, all 70 closed decision tickets have a comment. 6 of them list a merged pull request in `closedByPullRequestsReferences`: 5 task tickets, and [#3 Which trackers and workspace shapes does v0.1.0 support?](https://github.com/dbarjs/hero-synergy/issues/3), a grilling ticket that closed on 2026-10-02 and lists [#72 Derive the frontier, the ordering, the counts and the neighbourhood from a snapshot](https://github.com/dbarjs/hero-synergy/pull/72), a build ticket's pull request opened five days later. So the field is a link to a pull request, not the event that closed the issue.
- The closing pull request's branch is `worktree-<ticket number>` on all 22, and on the one open pull request.

### Issues that are neither

| Issue                                                                                                                                              | Labels                      | What it is                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#36 Write the upstream-review skill](https://github.com/dbarjs/hero-synergy/issues/36)                                                            | `ready-for-agent`           | Open, no parent, no children. One slice to build, written by hand from a decision ticket's resolution. H2s: `What the skill does, from the resolution`, `How to write it`, `Done when`. No checkbox. |
| [#186 Publish to Open VSX](https://github.com/dbarjs/hero-synergy/issues/186)                                                                      | `ready-for-human`           | Open, no parent. H2s `Why`, `Steps only Eduardo can do`, `Agent work`, `Done when`, with `- [ ]` items.                                                                                              |
| Six `Upstream break: <upstream> <version>` issues, such as [#184 Upstream break: skills v1.3.2](https://github.com/dbarjs/hero-synergy/issues/184) | `canary`, `ready-for-human` | Filed by the canary workflow. H2s `Failing contracts`, `Last green → first red`, `Error`, `Output`.                                                                                                  |
| [#182 Agent agnosticism](https://github.com/dbarjs/hero-synergy/issues/182)                                                                        | none                        | A 95-character note.                                                                                                                                                                                 |

- `ready-for-agent` with no parent selects 4 issues: the 3 specs and [#36 Write the upstream-review skill](https://github.com/dbarjs/hero-synergy/issues/36).
- A triage role with no parent selects 11: those 4, [#186 Publish to Open VSX](https://github.com/dbarjs/hero-synergy/issues/186) and the 6 canary issues.

### Edges that cross the two kinds

- 9 blocked-by edges run from a decision ticket to a build ticket. All 9 start at the `wayfinder:task` tickets of the map [#64 next, the terminal pre-alpha of the Cockpit](https://github.com/dbarjs/hero-synergy/issues/64), whose Destination is a script that follows [#37 Spec: hero-synergy v0.1.0, the Cockpit](https://github.com/dbarjs/hero-synergy/issues/37). Its 6 children are labelled `wayfinder:task`, start with `## Question`, and 3 were closed by a merged pull request: they build.
- No build ticket is blocked by a decision ticket, and none is blocked by a ticket of another spec.

## Local trackers

### The scratch mirror

`packages/core/fixtures/scratch-mirror`: 49 efforts, 342 Markdown files, of which 35 maps, 257 issue files and 50 notes (`truth.json`).

|                             | Efforts |
| --------------------------- | ------- |
| A map, no spec or PRD file  | 34      |
| A map and a `PRD.md`        | 1       |
| No map, a `PRD.md`          | 1       |
| No map, no spec or PRD file | 13      |

- **File names.** `PRD.md` twice, upper case. No `spec.md` in any casing, no `tickets.md`, no `plan.md`.
- **The truth file calls both PRDs a `note`**, as [#139 Which issue files are a map's tickets](https://github.com/dbarjs/hero-synergy/issues/139) decided.

**The PRD beside a map** (`effort-29`):

- H1 `# PRD: <title>`. Header lines before the first H2: `Status: ready-for-agent`, `Label: prd`, `Map: [<title>](MAP.md)`, `Decided: <date> (…)`.
- Eight H2s. `Out of Scope` survives the sanitizer; the others keep the words `Problem`, `User`, `Decisions` (twice) and `Notes` in the positions of upstream's seven headings, with one more H2 before `Out of Scope`.
- The map names it in one body line that links `PRD.md` and gives a range of ticket numbers.
- The effort's `issues/` holds 33 files in one number sequence: 21 are the map's tickets (01 to 10 and 23 to 33) and 12 are the PRD's (11 to 22).

**The 12 issue files that name the PRD:**

|                                                                                   | Files            |
| --------------------------------------------------------------------------------- | ---------------- |
| `**Parent:** [<title>](../PRD.md)`, bold key, a link                              | 12               |
| `**Status:**`, bold key                                                           | 12               |
| `**Blocked by:**`, bold key: `None — <prose>.` on 1, `<NN> — <prose>` items on 11 | 12               |
| One more bold key, whose word the sanitizer replaced                              | 8                |
| `- [ ]` or `- [x]` items before the first H2                                      | 12 (5 to 8 each) |
| H2s: `Comments` only, or none                                                     | 9 and 3          |
| `## What to build`, `## Acceptance criteria`, `## Question`                       | 0                |
| A `Type:` or `Label:` line                                                        | 0                |

- Status values: `ready-for-human` 8, `done (<date>)` 3, `ready-for-agent` 1. The truth reads 9 open and 3 closed.
- 11 of the 12 have every box ticked, the 8 `ready-for-human` ones included. The truth lists "every acceptance box ticked" as a disagreement on those 8, and the map's prose calls all 12 closed.
- No resolution is read on any of the 12.
- These are the only bold `Status`, `Parent` and `Blocked by` keys in the mirror: the other 245 issue files write `Status:` plain.
- The shape is upstream's L2 template with one line upstream never shipped, `**Parent:**`.

**The PRD with no map** (`effort-46`): no header line; three H2s, the last one `## Issues` over a table `| # | Issue | Status |` of 10 rows, each linking `issues/NN-…md` and reading `done`. Its 10 issue files carry `Status: done` (plain key), the H2s `Acceptance` and `Comments`, and no line that names the PRD.

**The other 17 issue files in efforts with no map** (13 efforts, 1 to 3 files each): a plain `Status:` line and their own H2s (`Problem` on 10). Roles: `needs-info` 5, `needs-triage` 2, `wontfix` 2, `ready-for-human` 1; the other 7 are `done`.

**Against the map's tickets:**

|                                               | The map's tickets (218) | PRD-parented (12) | In an effort with no map (27) |
| --------------------------------------------- | ----------------------- | ----------------- | ----------------------------- |
| A type (`Type:` or `Label: wayfinder:<type>`) | 218                     | 0                 | 0                             |
| `## Question`                                 | 218                     | 0                 | 0                             |
| A triage role                                 | 16                      | 9                 | 10                            |
| Bold `**Status:**`                            | 0                       | 12                | 0                             |

- 16 decision tickets carry a triage role: `ready-for-agent` 7 (all closed), `ready-for-human` 7 (6 open, 1 claimed), `needs-triage` 2 (open). So a triage role does not make a local issue file a build ticket.
- Two decision tickets carry a plain `Parent:` line holding a bare path. The truth reads them as their map's tickets.

### The pattern fixture

`packages/core/fixtures/local-forms`: 25 efforts, 140 issue files, invented text.

- `PRD.md` twice: in `prd-in-map` (a map, the PRD with `Status: ready-for-agent`, `Label: prd`, `Map: [Tool shed](MAP.md)`, one decision ticket and 4 PRD issues) and in `no-map-prd` (the PRD with an `## Issues` table, 2 PRD issues). No `spec.md`.
- All 6 PRD issues carry `**Parent:** [<title>](../PRD.md)` and `**Status:**`, both bold. Status values: `ready-for-human` 2, `ready-for-agent` 1, `done` 2, `done (<date>)` 1.
- **Two differences from the mirror.** The 6 files put their text under `## What to build` (and 4 under `## Acceptance` with one empty box); the mirror's 12 have neither heading and keep their boxes before the first H2. And `no-map-prd` gives a `**Parent:**` line to issues in an effort with no map; in the mirror the 10 such files have none.

### The local-tracker fixture

`packages/core/fixtures/local-tracker`: 3 efforts. `onboarding-spec` holds the only `spec.md` in the three fixtures: an H1 and one paragraph, none of upstream's headings. Its 2 issue files hold an H1, a plain `Status:` line (`ready-for-agent`, `needs-triage`) and `## What to build`. No `Parent:` line, no blocker, no criteria. It has no `truth.json`.

## What the scout reads today

At `main` [`1f61899`](https://github.com/dbarjs/hero-synergy/commit/1f61899):

- **GitHub.** The list request asks for open issues labelled `wayfinder:map`, and the second request for each map's `subIssues` (`packages/core/src/github/query.ts`). An issue that is neither is never fetched. A spec and its build tickets are invisible, open or closed.
- **Local.** An effort's map is a file named `map.md` in any casing; its tickets are `issues/<digits>-*.md`. When the effort has a map file, every issue file gets that map as its parent (`packages/core/src/scout/local.ts`, `parent: mapBody === null ? null : mapNumber`). No code reads `spec.md`, `PRD.md` or a `Parent:` header line: `headerTicketLines` reads `Blocked by`, `Blocks`, `Type`, `Status` and `Labels` only (`packages/core/src/snapshot/ticket-body.ts`).
- By that code the mirror's 12 PRD issues are tickets of the map beside them and raise `type-missing` (loud), `no-question-heading`, `header-key-bold` (both quiet) and `unknown-status`, besides whatever their `**Blocked by:**` items raise. This is read from the code; the scout was not run. The 27 issue files of mapless efforts land in their effort's `unmapped` group. The rule that moves the 12 out is decided in [#139 Which issue files are a map's tickets](https://github.com/dbarjs/hero-synergy/issues/139) and waits on [#174 Show unmapped issues in the Unmapped fold, grouped by effort](https://github.com/dbarjs/hero-synergy/issues/174), still open.
- **The snapshot** (schema 3, `packages/core/src/snapshot/model.ts`) has `maps`, each with `tickets`, and `unmapped` groups of the same `Ticket` shape. `Ticket` has `role`, `statusLine` and `modeNote`, null until the local reading rules fill them. It has no field for a spec, a parent that is not a map, acceptance criteria or a pull request.
- **The glossary** defines an Unmapped issue as "A tracker issue that is not a ticket of any map: on a local tracker, an issue file in an effort with no map, or one whose `Parent:` line names a PRD" (`GLOSSARY.md`). Since [`0976622`](https://github.com/dbarjs/hero-synergy/commit/0976622) it also defines a Build ticket as "A ticket of a spec: one slice to build, with its acceptance criteria and a triage role", and a Spec as the issue or "`.scratch/<feature>/spec.md`", with PRD a word to avoid. So an issue file whose `Parent:` line names a PRD is a build ticket by one entry and an unmapped issue by the other, and the only spec files a real tracker holds here are named `PRD.md`.
- **The register** (`docs/upstream.md`, "mattpocock-skills") has no row for a spec's headings, a build ticket's headings, `spec.md`, `PRD.md` or the local ticket template. It names `to-spec` and `to-tickets` only as skill names, and notes the 1.3.2 sub-issue change under "Ahead of the ceiling".
- **The drift table** treats a bold header key as drift (`header-key-bold`, quiet, hint "A header line is a plain 'Key: value' line"). Upstream's local ticket template has written `**Status:**` and `**Blocked by:**` bold since v1.2.0.
- **The map reader** normalizes headings to lower case (`normalizeHeading`), so a spec's `## Out of Scope` is the map heading `Out of scope` to it.
- **No fixture holds a spec on GitHub.** `packages/core/fixtures/github/` holds recorded answers to the two map requests only.

## What code could key on, with no label

Each mark, with what it selects in the sources above. None of this is a decision; [#203 How does the scout recognise a spec and its build tickets?](https://github.com/dbarjs/hero-synergy/issues/203) decides.

### A spec on GitHub

| Mark                                                                                                                                        | Since upstream        | On this tracker                                                                                            | Misses or over-selects                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The seven H2s (or the five no map shares: `Problem Statement`, `Solution`, `User Stories`, `Implementation Decisions`, `Testing Decisions`) | 2026-02-03, every tag | 3 of 3 specs, 0 of 144 others                                                                              | a spec edited by hand; upstream's docs say the template fits a refactor "less well"                                                                                                                                  |
| Has sub-issues and is not a `wayfinder:map`                                                                                                 | guaranteed from 1.3.2 | 2 of 3 specs, 0 others                                                                                     | misses a spec with no tickets yet and one built whole ([#155 Launch AFK sessions with permissions bypassed in isolated environments](https://github.com/dbarjs/hero-synergy/issues/155)); any hand-made parent issue |
| Its children hold `## What to build`                                                                                                        | 2026-02-20            | 2 of 3                                                                                                     | same misses                                                                                                                                                                                                          |
| Label `ready-for-agent` and no parent                                                                                                       | 2026-05-06            | 4: the 3 specs and [#36 Write the upstream-review skill](https://github.com/dbarjs/hero-synergy/issues/36) | every triaged issue; the label string can be remapped; upstream tells users to remove it from the spec                                                                                                               |
| A paragraph before the first H2 that links a `wayfinder:map` issue                                                                          | never in the template | 3 of 3                                                                                                     | a spec with no map; a session that writes no preamble                                                                                                                                                                |
| Title starts with `Spec:`                                                                                                                   | never                 | 1 of 3                                                                                                     |                                                                                                                                                                                                                      |

### A build ticket on GitHub

| Mark                                              | Since upstream                                       | On this tracker                          | Misses or over-selects                                                           |
| ------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------- |
| Native parent that is a spec                      | "where it has one" 1.1.0 to 1.3.1; always from 1.3.2 | 37 of 37                                 | tickets from 1.1.0 to 1.3.1 with no sub-issue link; tickets with no source issue |
| H2 `What to build` and H2 `Acceptance criteria`   | 2026-02-20, every tag                                | 37 of 37, 0 of 110 others                | none seen                                                                        |
| `## Parent` section whose text starts with `#<n>` | 2026-04-17                                           | 37 of 37, and equal to the native parent | left out with no source issue; the text is "a reference", not always `#<n>`      |
| `## Blocked by` section                           | 2026-02-20                                           | 37 of 37, equal to the native edges      | left out from 1.3.2 when edges are native                                        |
| No `wayfinder:` label and no `## Question`        |                                                      | 37 of 37                                 | also true of every other issue                                                   |
| Label `ready-for-agent`                           | 2026-05-06 as a role, "unless instructed otherwise"  | 37 of 37                                 | shared with specs and triaged issues                                             |

### On a local tracker

| Mark                                                                         | Since upstream                                         | In the fixtures                                                                                                                            | Misses or over-selects                                                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| A file `spec.md` or `PRD.md` directly in the effort directory, in any casing | `PRD.md` v1.0.0 to v1.1.0; `spec.md` from v1.2.0       | mirror: 2 `PRD.md`, 0 `spec.md`; pattern fixture: 2 `PRD.md`; `local-tracker`: 1 `spec.md`                                                 | a note that happens to be named so                                                             |
| The issue file sits in an effort that has a spec or PRD file and no map      | the template's layout                                  | mirror: 10 files in 1 effort                                                                                                               | an effort with both a map and a PRD (1 in the mirror)                                          |
| A `Parent:` header line that names the spec or PRD file                      | never                                                  | mirror: 12 of 12 in the effort with both; pattern fixture: 6 of 6                                                                          | mirror: 10 files under a PRD have no such line; 2 decision tickets use `Parent:` for their map |
| Bold `**Status:**` before any H2                                             | v1.2.0                                                 | mirror: exactly the 12 PRD-parented files, 0 of the other 245                                                                              | a hand-written file; the mirror's other 10 PRD issues write it plain                           |
| No type and no `## Question`                                                 |                                                        | mirror: all 39 files that are not a map's tickets, 0 of the 218 that are                                                                   | also true of a triaged local issue                                                             |
| `**What to build:**` bold key, or `## What to build`                         | bold key from v1.1.0; the H2 is the tracker template's | mirror: neither is readable (0 `## What to build`; the bold key's word is replaced); pattern fixture and `local-tracker`: the H2 on 8 of 8 | the two invented fixtures use the H2, the real tracker does not                                |

## Where two forms can be confused

1. **A spec and its build tickets share their only label.** `ready-for-agent` is on all 3 specs and all 37 build tickets here, by upstream's instruction in both skills. Upstream's docs call an agent building the whole spec off that label "the most-reported problem".
2. **A spec and its map.** Both are parents of sub-issues with native blockers between the children. [#155 Launch AFK sessions with permissions bypassed in isolated environments](https://github.com/dbarjs/hero-synergy/issues/155) and its map [#123 Launch AFK sessions with permissions bypassed in isolated environments](https://github.com/dbarjs/hero-synergy/issues/123) have the same title. A spec's `## Out of Scope` and a map's `## Out of scope` are one heading to a reader that ignores case. The label `wayfinder:map` is the one thing only the map has.
3. **A spec that is not a parent.** [#155 Launch AFK sessions with permissions bypassed in isolated environments](https://github.com/dbarjs/hero-synergy/issues/155) has no build ticket and never will. Every spec is in that state between `/to-spec` and `/to-tickets`. "Has sub-issues" finds neither.
4. **A build ticket and a decision ticket.** Both are sub-issues, claimed by an assignee, gated by native blockers. On this tracker the parent's label, the child's label and the child's first heading agree on all 128 children. They can come apart three ways:
   - a triage label on a decision ticket, which wayfinder sessions wrote before 1.3.2 and which 16 of the mirror's 218 decision tickets carry;
   - `/to-tickets` run against a map, which puts unlabelled `## What to build` children under a `wayfinder:map` issue;
   - a `wayfinder:task` ticket that builds, as the 6 tickets of the map [#64 next, the terminal pre-alpha of the Cockpit](https://github.com/dbarjs/hero-synergy/issues/64) do, 3 of them closed by a pull request and blocked by build tickets of [#37 Spec: hero-synergy v0.1.0, the Cockpit](https://github.com/dbarjs/hero-synergy/issues/37).
5. **A build ticket and an unmapped issue.** [#36 Write the upstream-review skill](https://github.com/dbarjs/hero-synergy/issues/36) is `ready-for-agent`, parentless and one slice to build, but has none of the template's headings. By the glossary a local issue file under a PRD is both a build ticket and an unmapped issue today.
6. **A build ticket and a triaged issue.** Both carry `ready-for-agent` and acceptance criteria. Upstream's triaged issue keeps its criteria in an `## Agent Brief` comment and carries `bug` or `enhancement`; a build ticket keeps them in the body under `## Acceptance criteria`. This tracker has no triaged issue to count. Locally, the 17 issue files of the mirror's mapless efforts that sit under no PRD carry a Status line with a triage role or `done`, and no type, like its PRD issues.
7. **The text fallbacks.** Since 1.3.2 `Part of #<n>` and `Blocked by: #<n>` at the top of a body are the fallback for a build ticket as well as for a decision ticket. Today the scout reads `Part of #<n>` as a ticket's map.
8. **Said twice, and it can drift.** All 37 build tickets repeat the parent and the blockers in text. They agree today on all 37. Nothing keeps them in step, and 1.3.2 stops writing the blocker half.
9. **One directory, one number sequence.** The mirror's effort with both a map and a PRD numbers its 12 build tickets 11 to 22 inside the map's 33. Their only difference from the tickets around them is the `**Parent:**` line, the bold keys and the missing type.
10. **Boxes and state.** 26 of 28 closed build tickets here have every box empty; 8 open ones in the mirror have every box ticked.
11. **The resolution.** A decision ticket's answer is its last comment. 11 of 28 closed build tickets have no comment, and what closes them is the pull request. Locally a closed build ticket reads `done` or `done (<date>)`, which upstream never named, and holds no resolution section.
12. **Bold keys.** The scout's `header-key-bold` drift fires on the exact lines upstream's local ticket template writes.

## Sources

Upstream files, read at each tag and through `git log -p --follow`:

- `skills/engineering/to-spec/SKILL.md` (earlier `skills/engineering/to-prd/`, `skills/to-prd/`, `to-prd/`, `write-a-prd/`)
- `skills/engineering/to-tickets/SKILL.md`; `skills/engineering/to-issues/SKILL.md` (earlier `skills/to-issues/`, `to-issues/`, `prd-to-issues/`); `skills/engineering/to-plan/SKILL.md`; `prd-to-plan/SKILL.md`
- `skills/engineering/implement/SKILL.md`; `skills/engineering/implement-spec/SKILL.md` (earlier `skills/in-progress/implement-spec/`)
- `skills/engineering/setup-matt-pocock-skills/issue-tracker-github.md`, `issue-tracker-gitlab.md`, `issue-tracker-local.md`, `triage-labels.md`
- `skills/engineering/triage/SKILL.md`, `AGENT-BRIEF.md`; `skills/engineering/wayfinder/SKILL.md`; `skills/engineering/ask-matt/SKILL.md`
- `docs/engineering/to-spec.md`, `to-tickets.md`, `implement.md` at `v1.3.2`; `CHANGELOG.md` at `main`

Release tags: `v1.0.0` ([bddb833]) and `v1.0.1` (2026-06-17), `v1.1.0` ([d574778], 2026-07-08), `v1.2.0` ([2ffb184], 2026-08-05), `v1.2.3` ([6acc160], 2026-08-06), `v1.3.0` ([984a2c0], 2026-10-04), `v1.3.1` ([24fe0ef], 2026-10-04), `v1.3.2` ([d1478fc], 2026-10-29). Between `v1.3.2` and `main` only `implement-spec/SKILL.md` differs among the skill and docs files above.

This repo, at [`1f61899`](https://github.com/dbarjs/hero-synergy/commit/1f61899): `packages/core/src/github/query.ts`, `packages/core/src/scout/local.ts`, `packages/core/src/snapshot/model.ts`, `read.ts`, `ticket-body.ts`, `header-lines.ts`, `markdown.ts`, `drift-table.ts`; `GLOSSARY.md`; `docs/upstream.md`; `packages/core/fixtures/scratch-mirror`, `local-forms`, `local-tracker`, `github`.

## Not verified

- **Other repos.** One GitHub tracker (this repo's) and one mirrored local tracker were counted. No third-party repo was surveyed, so how common each form is elsewhere is unknown.
- **No issue written by 1.3.2.** Nothing was run. What a 1.3.2 session really writes (whether `## Parent` stays beside a native sub-issue, whether `## Blocked by` is really left out) is read from the template only. Every build ticket here predates the 1.3.2 tag.
- **Which skills commit wrote each spec and ticket.** The register says sessions ran the installed 1.2.3 at `84fdeff` up to 2026-10-07. That was not checked per session, and [#155 Launch AFK sessions with permissions bypassed in isolated environments](https://github.com/dbarjs/hero-synergy/issues/155), [#163 Read a local tracker's state in every form a real five-month tracker holds](https://github.com/dbarjs/hero-synergy/issues/163) and their tickets were written two days later.
- **The mirror's words and dates.** Its words are replaced and its dates shifted. The H2s of `effort-29/PRD.md` beyond `Out of Scope`, the second bold key on 8 of the 12 PRD issues, and whether their H1 led with `<NN>` cannot be read. Its forms cannot be dated against upstream's.
- **Where the mirror's mapless issues came from.** Whether `/triage`, an earlier `to-issues` or a person wrote them is not recorded.
- **A triaged issue on GitHub.** None exists on this tracker. The form is upstream's template only. The comment search for "Agent Brief" is GitHub's search, not a read of every comment.
- **Why a closed decision ticket lists a later pull request.** The body of that pull request names no closing keyword for it. What `closedByPullRequestsReferences` counts as a reference was not looked up.
- **`tickets.md`, `plan.md`, `./plans/` and a `spec.md` written by upstream's skill.** None is in the fixtures; the one `spec.md` is invented.
- **A remapped label.** Every tracker here uses the default role names as label strings.
- **Installs between tags.** The marketplace pins `main` commits, so which form a given install wrote between two tags is not known.
- **Upstream's issue reports** ([262](https://github.com/mattpocock/skills/issues/262), [513](https://github.com/mattpocock/skills/issues/513), [518](https://github.com/mattpocock/skills/issues/518), [554](https://github.com/mattpocock/skills/issues/554) and [700](https://github.com/mattpocock/skills/issues/700) of `mattpocock/skills`) are cited from upstream's changelog, docs pages and commit messages. The issues themselves were not read.
- **GitLab and other trackers.** Read only for the two lines above.
- **What the API can list.** Only that `parent`, `subIssues`, `blockedBy` and `closedByPullRequestsReferences` return for these issues. Routes and costs are [#198 What can GitHub's API report about specs, build tickets and their pull requests, and at what cost?](https://github.com/dbarjs/hero-synergy/issues/198)'s question.

[985d8fc]: https://github.com/mattpocock/skills/commit/985d8fce764dae479e7b77b632429abe38891ee8
[651eab0]: https://github.com/mattpocock/skills/commit/651eab033bdf8f7fd535c274f8cbe839075aba5e
[4458b65]: https://github.com/mattpocock/skills/commit/4458b65ffca31dc80f975a179a4e9cfe43e1fa49
[8e51ff7]: https://github.com/mattpocock/skills/commit/8e51ff765eb242b65324e9b770526cc53e9db767
[78649ba]: https://github.com/mattpocock/skills/commit/78649baa3e6e4c241ce85ee8dc93ecc0b53e4515
[4dd409d]: https://github.com/mattpocock/skills/commit/4dd409d177767ca942eddaff5db577b33e549101
[a77fa6e]: https://github.com/mattpocock/skills/commit/a77fa6e7a6726f687aa36455b27ed8b7d09afdff
[aaf3050]: https://github.com/mattpocock/skills/commit/aaf3050857a8d00c710c382c87a29b81341370aa
[7afa86d]: https://github.com/mattpocock/skills/commit/7afa86d3a5dd96edde06ffa014e16c64e733681e
[179a14e]: https://github.com/mattpocock/skills/commit/179a14e721034706ffce7abae75b877c922b4ae8
[e736396]: https://github.com/mattpocock/skills/commit/e736396b35a5ca63192d72d07e089a3f85a0d7a0
[7014111]: https://github.com/mattpocock/skills/commit/70141119e9fe47430b62b93bcf166a73e6580048
[788b5c3]: https://github.com/mattpocock/skills/commit/788b5c382b769155afcbac0d8402c3b56eae02fd
[ffb2fa6]: https://github.com/mattpocock/skills/commit/ffb2fa662321045a8ace6f56f29ef8af11e19d3d
[bddb833]: https://github.com/mattpocock/skills/commit/bddb833cbaa322ff89d07e490530860aa73a4293
[5c3c49d]: https://github.com/mattpocock/skills/commit/5c3c49df1a6c24019ea56690088810961cd3370c
[93f7319]: https://github.com/mattpocock/skills/commit/93f73198e3588c1844733b67feaffa5b58812ff3
[0172e61]: https://github.com/mattpocock/skills/commit/0172e61e57c9cae07955e8e30a0f010cee3dbe54
[386d4ff]: https://github.com/mattpocock/skills/commit/386d4ff719a7c420ad1454232d0436b01f1b8c17
[cc1e248]: https://github.com/mattpocock/skills/commit/cc1e24891df515a43a034cd91d3f64e17d1c9ffb
[d574778]: https://github.com/mattpocock/skills/commit/d574778f94cf620fcc8ce741584093bc650a61d3
[44eed54]: https://github.com/mattpocock/skills/commit/44eed545186ffd0263e8004867750b80cfddd215
[fd10de9]: https://github.com/mattpocock/skills/commit/fd10de97d6583fde9de8d79ba77da7bec2356a56
[2ffb184]: https://github.com/mattpocock/skills/commit/2ffb184ffbb752faa664c0b204f3c9241b1428e9
[6acc160]: https://github.com/mattpocock/skills/commit/6acc160e4e0cd062dbbbd7a1b26ae92855edf07e
[3216582]: https://github.com/mattpocock/skills/commit/321658273cb1d20b76026717d027d505790106d4
[5c89081]: https://github.com/mattpocock/skills/commit/5c89081d4bbeb3d039a42093653f90bb698d780e
[84b5ee5]: https://github.com/mattpocock/skills/commit/84b5ee5afd738b6a3484e62509b84b3b573c5be3
[153fc1b]: https://github.com/mattpocock/skills/commit/153fc1b93de6584562765cdce299324e1ff9e661
[24f41cc]: https://github.com/mattpocock/skills/commit/24f41cc26d34ffd688e9105b43798a4b446e267d
[984a2c0]: https://github.com/mattpocock/skills/commit/984a2c023c9fb42bb6ea40c70a652284a109dc05
[24fe0ef]: https://github.com/mattpocock/skills/commit/24fe0ef7737efae15c87225755e9f6f5965e4888
[cffab50]: https://github.com/mattpocock/skills/commit/cffab50350e3d96688f63f890f4d7ca0e6007cfe
[9e2abf8]: https://github.com/mattpocock/skills/commit/9e2abf8611a345efbf779aacb171cff015bcdeb6
[8295b8e]: https://github.com/mattpocock/skills/commit/8295b8e10d4cdb6cce772a56dda7b7c37075074d
[6d6a5b9]: https://github.com/mattpocock/skills/commit/6d6a5b9072f47ee7ba1d972d8ce0ee98b7ed4394
[ed0de59]: https://github.com/mattpocock/skills/commit/ed0de59eb5de8c2730a650cc69f588ffa64c1040
[d1478fc]: https://github.com/mattpocock/skills/commit/d1478fcb140db0b93c0c8df17bcfd311844749d0
[a496f55]: https://github.com/mattpocock/skills/commit/a496f5513d4a4cf889bc48e189e579f4b0bdf6aa
[5863806]: https://github.com/mattpocock/skills/commit/5863806dd4e15c63174bee4e7515a4256792ecfa
