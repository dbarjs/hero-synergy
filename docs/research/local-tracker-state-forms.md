# State forms on a real local tracker

Research for [#131](https://github.com/dbarjs/hero-synergy/issues/131), on map [#130](https://github.com/dbarjs/hero-synergy/issues/130). Surveyed on 2026-10-09: the `.scratch/` directory of a private production repo that has run on the local markdown tracker for five months, copied to this machine for the survey and never committed. Upstream's history of the same forms is in [`wayfinder-conventions.md`](https://github.com/dbarjs/hero-synergy/blob/research/wayfinder-conventions/docs/research/wayfinder-conventions.md) ([#10](https://github.com/dbarjs/hero-synergy/issues/10)); this note answers the gap that research left open, how common each form is on a real tracker.

**Every form here is a shape.** The tracker's own words are replaced by `<date>`, `<NN>` (a ticket number), `<title>`, `<slug>`, `<prose>`, `<person>`, `<code>` and `<n>`. Keys, state words, `wayfinder:` labels, triage roles, AFK/HITL and Markdown are verbatim. Every count is a count of files.

**How it was surveyed.** Eight subagents each read one batch of effort directories, every Markdown file in full, and recorded per file: every `Key: value` line before the first H2, every other line that states or changes a state, the H2 headings, what a careful reader of the whole file concludes about its state, and whether the effort's map records it. A script merged the batches, checked that each of the 342 Markdown files was recorded exactly once, and counted. Screenshots, smoke scripts and reports were counted, not read. One batch also ran the scout's current parsers over its files in memory. The careful reading is a model's; the files it could not call are listed under Gaps, and [#134](https://github.com/dbarjs/hero-synergy/issues/134) settles them.

## Answer

- **The scout reads almost nothing of this tracker today.** All 35 maps are named `MAP.md`. The scout opens `map.md`, so on a case-sensitive file system it finds no map, and all 257 tickets land in `unmapped`. With the maps found, it would still read 2 of the 227 closed tickets as closed (the two bare `Status: resolved`), raise `unknown-status` on 255, find a type on 18, find a resolution on 17, and turn most `Blocked by:` values into slugs or into numbers that aren't blockers.
- **The first word of a ticket's Status line carries its state.** Read by that leading keyword alone, the line agrees with the careful reading on 241 of 257 tickets: `closed` (167), `done` or `DONE` (26), `resolved` (24) and `wontfix` (2) are closed; `open` (13), `needs-info` (5), `needs-triage` (3) and `ready-for-agent` (1) are open. What follows the keyword is annotation (a date, a parenthesis, a dash clause) and never reverses it.
- **The other 16:** `ready-for-human` (13) was read as closed 8 times ("built, waiting on a human step"), open 4 times and in progress once; `open — claimed <date> (…)` and `open — ready-for-human (claimed <date>, …)` (2) are claims; one line holds a DONE half and an OPEN half.
- **Maps state their own state** on a `Status:` line (31 of 35), always a narrative of 117 to 4,670 characters (median 448), usually bold-led. By leading keyword, `DONE` (14) and `destination reached` (1) are closed; `in progress` (5), `charted` (4) and `REOPENED` (1) are open; `route walked` (2) went one way each; 4 lines lead with other words and 4 maps have no Status line.
- **Type, claim, membership and blockers sit on GitHub-shaped header lines** under the Status line: `Assignee:`, `Label:` or `Labels: wayfinder:<type> (AFK|HITL …)`, `Blocked by:`, `Map:`. None of them is in the local template, which has `Type:`, `Status: claimed | resolved`, `Blocked by: NN, NN` and nothing else.
- **The resolution is rarely under `## Answer`**: 17 of 227 closed tickets. 108 put it under a `### Resolution (<date> …)` heading inside `## Comments`.

## The corpus

| | files |
|---|---:|
| effort directories | 49 |
| with a map | 35 |
| without a map | 14 |
| Markdown files | 342 |
| maps | 35 |
| tickets (`issues/NN-<slug>.md`) | 257 |
| research write-ups (`research/` or `assets/`) | 19 |
| asset notes (`assets/`) | 24 |
| handoffs | 4 |
| PRDs | 2 |
| QA checklist | 1 |

The careful reading: 227 tickets closed, 26 open, 2 claimed, 2 in progress; 17 maps closed, 11 in progress, 7 open.

## Maps

- **File name:** `MAP.md` 35 times, `map.md` never.
- **Sections:** all 35 have the five current H2s. Three add one more: `## Destination reached`, `## Redraw`, `## Round <n> — <prose>`.
- **Header lines before the first H2:** `Label: wayfinder:map` (32) or `Labels: wayfinder:map` (3), `Status:` (31), `Charted: <date> …` (26), `Charted:` with `Recharted:` (1), `Redrawn:` (1).
- **The Status line:**

  | leading keyword | careful reading | maps |
  |---|---|---:|
  | `**DONE <date>** — …`, `DONE (<date>) — …`, `**DONE <date> (second closing)** — …` | closed | 14 |
  | `**destination reached <date>** …` | closed | 1 |
  | `**route walked …** — …` | closed 1, in progress 1 | 2 |
  | `in progress …`, `**in progress <date>** — …` | in progress | 5 |
  | `charted <date> …` | in progress 2, open 2 | 4 |
  | `**REOPENED <date> — …**` | in progress | 1 |
  | other words first (`**<NN> + <NN> + <NN> DONE <date>** …`, `<prose> **DONE <date>** — … Frontier = …`) | open 3, in progress 1 | 4 |
  | no Status line | open 2, closed 1, in progress 1 | 4 |

  These lines are histories, not values. The open ones name their frontier (`frontier = **<NN> ONLY** (HITL — <prose>)`); the closed ones say so (`No frontier`).
- **Decisions so far against the tickets:** 33 of 35 maps list exactly their closed tickets, as decisions or out of scope. One map's prose closes a range of tickets whose own files never say closed; another lists a half-done ticket. In 13 maps, decision gists start with a state word: `- [<title>](issues/<NN>-<slug>.md) — CLOSED <date> …`, `— DONE <date> …`.

## Tickets

### The Status line

On all 257 tickets, before the first H2: `Status:` 245 times, `**Status:**` 12 times. Each is 12 to 185 characters long (median 27). It takes 55 shapes; the 23 that recur cover 225 tickets:

| shape | tickets |
|---|---:|
| `closed (resolved <date>)` | 35 |
| `closed (<date>)` | 30 |
| `closed` | 27 |
| `closed <date>` | 23 |
| `done` | 16 |
| `resolved (<date>)` | 14 |
| `ready-for-human` | 12 |
| `open` | 11 |
| `closed (DONE <date>)` | 10 |
| `closed <date> (resolved)` | 8 |
| `resolved <date> (closed)` | 6 |
| `needs-info` | 5 |
| `DONE <date> (closed)` | 5 |
| `needs-triage` | 3 |
| `done (<date>)` | 3 |
| `closed — DONE <date> (uncommitted)` | 3 |
| `wontfix`, `resolved <date>`, `resolved` | 2 each |
| `**closed <date>** (resolved — <prose>)` and three more `closed`/`resolved` shapes with a history clause | 2 each |

The other 32 shapes appear once each. They are the same keywords followed by longer history: `closed (superseded <date> — <prose>)`, `closed (moved <date> — <prose>)`, `closed <date> (reopened and re-closed <prose>)`, `done (implemented <date> <prose>)`, `open — claimed <date> (HITL: <prose>)`, `open — needs-triage (blocked)`, `ready-for-human (charted <date> <prose>; unblocked <date> <prose>)`.

- **The annotation repeats the state in other words** (`closed (resolved …)` 51 times, `closed (DONE …)` 26, `resolved … (closed)` 6, `DONE … (closed)` 6) **and adds history**: `uncommitted`, `superseded`, `moved`, `reopened`, `unblocked <date>`. A dash clause can carry a second keyword (`open — claimed`, `open — ready-for-human`, `open — needs-triage`).
- **Casing:** `DONE` 6 times; every other keyword is lower case.
- **Never seen:** `Status: claimed`, YAML front matter, or a Status line after the first H2 that is not inside code.

### Claim

- `Status: claimed` never appears. The two tickets the careful reading calls claimed carry the claim in the Status line's dash clause.
- `Assignee:` sits on 208 tickets: `<person>` or `<person> (<prose>)` 77, `<person> (…, claimed <date> …)` 59, `<person> (… session <date>)` 52, `—` or empty 19, `(unclaimed)` 1; 49 tickets have no Assignee line. `claimed <date>` stays after the ticket closes: all 59 are closed. Some assignees name an agent session rather than a person.

### Type

| where the type is | tickets |
|---|---:|
| `Label: wayfinder:<type> (…)` and an H1 prefix (`# Task: …`, `# Research: …`, `# Grilling: …`) | 128 |
| `Labels: wayfinder:<type>`, sometimes `, ready-for-agent` or `, ready-for-human` after it | 35 |
| `Type: wayfinder:<type> (AFK)` or `(HITL …)` | 21 |
| `Type: <type>`, `Label: wayfinder:<type>` and an H1 prefix | 18 |
| `Label: wayfinder:<type>` alone | 16 |
| nowhere (triage issues and `/to-tickets` issues) | 39 |

The label is annotated: `(AFK)` 83 times and `(HITL)` 32, often followed by prose that can name other tickets (`(AFK — <prose> <NN> <prose>)`, `(HITL — <prose>)`).

### Membership

- 230 tickets sit in an effort with a map, 27 in one without.
- `Map: [<title>](../MAP.md)` 163 times, `Map: ../MAP.md` 35 times.
- `**Parent:** [<title>](../PRD.md)` 12 times, on `/to-tickets` issues filed inside a wayfinder effort's `issues/`, next to its tickets; `Parent: ../MAP.md` twice.

### Blockers

| `Blocked by:` value | tickets |
|---|---:|
| a none marker: `—`, `— (<prose>)`, `(none — frontier)`, `(nothing — frontier)` | 140 |
| links: `[<NN>-<slug>](<NN>-<slug>.md)`, `[<title>](<NN>-<slug>.md)`, `[<NN> — <title>](<NN>-<slug>.md)` | 35 |
| links with state notes: `[<NN>](<NN>-<slug>.md) closed <date>)` | 6 |
| bare file names with state notes: `<NN>-<slug>.md (closed <date> — frontier)` | 15 |
| numbers with prose: `**Blocked by:** <NN> — <prose>.` | 13 |
| numbers with state notes: `<NN> (closed <date>) — **UNBLOCKED**`, `<NN> resolved <date>; frontier — <prose>` | 10 |
| `<NN>, <NN>`, the template's form | 10 |
| no Blocked by line | 28 |

A closed blocker stays listed, usually with a note. `Blocks:`, the inverse edge, sits on 24 tickets.

### Resolution

| where a closed ticket's resolution is | tickets |
|---|---:|
| `### Resolution (<date> …)` under `## Comments` | 108 |
| `## Resolution (<date> …)` as its own H2 | 38 |
| a bold paragraph, `**Resolution …**` | 31 |
| a dated list item under `## Comments`, `- <date> (<person>): <prose>` | 20 |
| `## Answer` | 17 |
| other text under `## Comments` | 11 |
| nowhere | 2 |

21 tickets title that heading in the tracker's second language.

### Traps for a line reader

- 52 tickets quote a Status line in inline code under `## Question`, as a closing protocol: `` `Status: closed` `` 45 times, `` `Status: resolved` `` 7. Six of them are still open or claimed, so a reader that greps the whole body closes them.
- 12 tickets put acceptance checkboxes before the first H2.
- `## ` lines inside code fences; 3 tickets with two `## Comments` headings; 3 with no H2 at all.
- One Status line holds two states.

## Efforts without a map

- 13 directories hold 1 to 3 issue files each, none of them a wayfinder ticket: `done` 7, `needs-info` 5, `needs-triage` 2, `wontfix` 2, `ready-for-human` 1. These are the local template's triage roles, plus `done`.
- 1 directory holds a `PRD.md` and its 10 `/to-tickets` issues, all `done`. The PRD keeps their states in a table as well.

## Other files

The 19 research write-ups and 24 asset notes carry header lines of their own (`Ticket:`, `Researched:`, `Date:`, `Source:`) and never a `Status:` line. Handoffs, PRDs and the QA checklist sit at an effort's top level, next to `MAP.md`.

## What the current scout reports, measured

Run in memory with the repo's parsers over one batch (3 maps, 23 tickets): no map on a case-sensitive file system. With `MAP.md` read anyway, it raised `unknown-status` on all 23 tickets, showed the 20 closed ones as open, raised 20 `decision-links-open-ticket` and 16 `blockers-as-slugs`, gave 4 tickets blockers made of digits from parentheses and link titles, and dropped every blocker written as a link.

## Gaps

- One tracker, one team, five months. Other trackers will hold other forms.
- The careful reading is a model's, settled by [#134](https://github.com/dbarjs/hero-synergy/issues/134) where it could not call `ready-for-human` (13), the line with a DONE half and an OPEN half, `route walked`, the maps with no Status line, and the map whose prose and ticket files disagree.
- The source repo's tracker doc was not copied, so whether it documents `MAP.md`, the header lines or `closed` and `done` is unknown. Upstream never shipped any of them ([#10](https://github.com/dbarjs/hero-synergy/issues/10)).
