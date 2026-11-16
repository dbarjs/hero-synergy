# The spec flow on GitHub, walked once for real

Findings for [#225 Walk /to-tickets and /implement-spec once on a throwaway GitHub repository](https://github.com/dbarjs/hero-synergy/issues/225), on map [#195 Specs and build tickets in the Cockpit](https://github.com/dbarjs/hero-synergy/issues/195). Run on 2026-11-16. It follows [#215 Walk the whole flow once on a throwaway spec and record what each skill does](https://github.com/dbarjs/hero-synergy/issues/215), whose findings are in [`flow-walk.md`](flow-walk.md): that walk used a local tracker, so everything only GitHub shows stayed open.

Every fact below was **seen** in a run unless it is marked otherwise. Times are UTC. Anything a model chose (a branch name, the words of a comment, whether to ask) is a sample of one to four runs.

## What was run

- **Claude Code 2.1.325**, logged in, with Eduardo's real `~/.claude`. The model was **Fable 5.2 at `xhigh` effort**, from his settings. #215 ran Opus 5.5, so a difference from #215 can come from the model as well as from the tracker.
- **Skills: the installed plugin, `49dd158`, shown as 1.3.1**, the same as #215. Its tracker template lacks the 1.3.2 flags, but a session reads the repo's own tracker doc, and that one is 1.3.2.
- **`gh` 2.100.0.** `permissions.defaultMode` is `bypassPermissions`, so no session saw a permission prompt.

**The throwaway repository** is [`dbarjs/flow-walk-throwaway`](https://github.com/dbarjs/flow-walk-throwaway), private, created for this walk with Eduardo's go-ahead (recorded on #225). Nothing ran against this repository or its tracker. It holds:

- `tally`, the Node CLI with no dependencies and an empty subcommand table that #215 used.
- `docs/agents/issue-tracker.md`, byte-equal to the GitHub template at tag [`v1.3.2`](https://github.com/mattpocock/skills/blob/v1.3.2/skills/engineering/setup-matt-pocock-skills/issue-tracker-github.md), with `triage-labels.md`, `domain.md` and a `CLAUDE.md` holding the `## Agent skills` block.
- The five triage labels, as the setup skill creates them, and `wayfinder:map` and `wayfinder:grilling`.
- Four finished maps made by hand (#1, #5, #18, #22), each with three closed `wayfinder:grilling` sub-issues that carry a resolution comment.
- Passive hooks in `.claude/settings.json`, as in #215.

**Two rounds, two runs each.** The rounds differ in one thing: what the repository's `CLAUDE.md` says about how work reaches `main`.

| Round                                         | `CLAUDE.md`                         | Run without `-w` (clone `a`)        | Run under `-w <spec>` (clone `b`)            |
| --------------------------------------------- | ----------------------------------- | ----------------------------------- | -------------------------------------------- |
| 1: the tracker doc alone                      | Only the `## Agent skills` block    | **A**: map #1, spec #10, 4 tickets  | **B**: map #5, spec #9, 3 tickets, `-w 9`    |
| 2: the repo says work closes by pull requests | The same plus **Building a ticket** | **C**: map #18, spec #27, 3 tickets | **D**: map #22, spec #26, 3 tickets, `-w 26` |

Round 2's paragraph, pushed to the throwaway's `main` between the rounds, is modelled on the README paragraph [#206 How is a build ticket launched, and how does its work reach main?](https://github.com/dbarjs/hero-synergy/issues/206) decided:

> **Building a ticket.** This repo closes work through pull requests. A build session assigns the ticket to itself before any work, commits on its own branch, pushes that branch and opens a pull request to `main` whose description says `Closes #<number>`, so the merge closes the ticket.

**How the sessions were driven.** Each session ran in its own tmux window, from the argv the Cockpit builds or will build, with the parent session's Claude Code variables removed. Every launch carried the status plugin and its two variables, as a tracked session does. Questions were answered by pressing keys in the window. Four things were watched from outside:

- `claude agents --json`, polled every 2 seconds.
- Each clone's worktrees, branches (local and remote-tracking) and checkout status, polled every 2 seconds.
- GitHub, with one GraphQL request every 10 seconds (2 points each): the branches, every issue and every pull request.
- The passive hooks, and the status plugin's events file.

| Step                         | Launch                                                                                                                               | Wall time                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| To spec, four times          | `claude -n '#<map> <title>' --plugin-dir <ext>/claude-plugin '/mattpocock-skills:to-spec <map URL>'`                                 | 3 min 1 s to 4 min 51 s  |
| To tickets, resumed (A, C)   | `/exit`, then `claude --resume <id> -n '#<spec> <title>' --plugin-dir … '/mattpocock-skills:to-tickets <spec URL>'`, then one answer | 3 min 5 s, 3 min 35 s    |
| To tickets, typed (B, D)     | `/mattpocock-skills:to-tickets <spec URL>` typed into the To spec session, still open, then one answer                               | 3 min 12 s, 4 min 21 s   |
| Implement spec A and C       | `claude --permission-mode bypassPermissions -n '#<spec> <title>' --plugin-dir … '/mattpocock-skills:implement-spec <spec URL>'`      | 26 min 49 s, 31 min 26 s |
| Implement spec B and D       | The same with `-w <spec number>`, started at the same moment as A and C                                                              | 24 min 46 s, 26 min 35 s |
| _(developer, after round 2)_ | `gh pr merge 34 --merge` in the throwaway, to see what the merge closes                                                              |                          |

## Answer

1. **`/to-tickets` writes native sub-issues and native blocking edges, with the 1.3.2 flags.** One `gh issue create --parent <spec> --label ready-for-agent --blocked-by <n>,<n>` per ticket, blockers first, in 4 of 4 runs. The flags come from the repo's tracker doc, so the installed plugin's older template did not matter.
2. **A build ticket's only label is `ready-for-agent`**, and it has no assignee. Its body is `## Parent`, `## What to build` and `## Acceptance criteria`, with no `## Blocked by` section (13 of 13 tickets).
3. **With the 1.3.2 tracker doc alone, `/implement-spec` opens no pull request** (2 of 2). Both runs read the doc's Close line, comment then close, as "this tracker closes work by comment".
4. **In that case GitHub shows nothing until the last minute.** No branch, no assignment, no comment for 24 and 26 minutes. Then the session pushes the integration branch, and comments on and closes each build ticket itself.
5. **And the spec stays open**, with every build ticket closed and a pushed branch that nothing points at. That is the **built** state of [#208 What are a spec's states, and what becomes of its map?](https://github.com/dbarjs/hero-synergy/issues/208), and it lasts until a person merges the branch and closes the spec.
6. **When `CLAUDE.md` says work closes through pull requests, `/implement-spec` does what its step 3 says** (2 of 2). It opens a draft pull request right after the first merge, from the integration branch to `main`, whose description starts with `Closes #n` for the spec and for every build ticket. It pushes after every merge, and at the end rewrites the description and marks the pull request ready.
7. **Those closing keywords work as [#198](https://github.com/dbarjs/hero-synergy/issues/198) expected.** From the first reading after the pull request opened, `closedByPullRequestsReferences` on the spec and on each ticket named it, tickets not built yet included.
8. **In that case the session assigns the spec and every build ticket to itself about a minute after launch**, and then never comments on, closes or edits an issue. The tickets stay open until the merge.
9. **The merge closes the spec first.** GitHub closed the four issues one at a time, in the order of the `Closes` lines, over 5 seconds: the spec, then each ticket. One reading caught the spec closed with two build tickets still open.
10. **The integration branch is `spec-<n>-<slug>` in all four runs, and under `-w` it is a new branch.** The session ran `git switch -c` inside its worktree, which left `worktree-<n>` behind with no commits. Without `-w` the launch checkout is left on the integration branch, as in #215.
11. **`/to-tickets` asks through the question tool** (4 of 4), so the registry reads `waiting`, `input needed`. In #215 it asked in plain text and read `idle`.
12. **`/to-spec` leaves the map alone and links to it only in text.** The spec has no parent, and the map stays open with no comment. 3 of 4 specs name their map in a line before the first heading; 1 of 4 names it only under `## Further Notes`.

## `/to-spec`

- **One write:** `gh issue create --title "Spec: …" --label ready-for-agent --body-file …`. Each session ran `gh repo view --json nameWithOwner` first, the own-repo check of the 1.3.2 tracker doc.
- **The spec issue:** title `Spec: <feature>` (4 of 4, three with the subcommand names in parentheses), the label `ready-for-agent`, no assignee, no parent, the seven H2s.
- **The map link is text, as a `#n` reference and never a URL:**
  - 3 of 4 open with a line before `## Problem Statement`: "Spec for the wayfinder map #1. It turns that map's three decisions into one buildable feature: #2 (what a line is), #3 (what a character is) and #4 (what `tally all` prints)."
  - 1 of 4 (#9) opens at `## Problem Statement` and names its map only in `## Further Notes`: "This spec is the result of the map in #5."
- **The map is untouched:** still open, no comment, no sub-issue added. One session said: "I left map #1 open and did not make #10 its sub-issue; the spec links to the map in its first line."
- **No question** in 4 of 4. Each said the map already names the seam. The registry went `busy`, then `idle`.
- **A spec can be edited after it is published.** Run C's session replaced its spec's body 25 seconds after creating it, to mention a sibling spec that appeared meanwhile.
- **Numbers interleave between efforts.** Two To spec sessions ran side by side, and map #5's spec came out as #9, before map #1's as #10. Later, #14 (a ticket of spec #9) landed among spec #10's tickets.

## `/to-tickets`

- **The question.** Each session read the spec, then asked one question through `AskUserQuestion`, headed "Ticket split" or "Breakdown", with three or four options, each with a preview of the tickets and their blockers. The registry read `waiting` with `waitingFor: "input needed"`, and a `Notification` hook fired. The recommended option was taken in A, B and C; in D the second was, to get a parallel frontier.
- **Resuming works on GitHub** (A, C). `claude --resume <id> -n '#<spec> <title>' … '/to-tickets <spec URL>'` continued the To spec conversation under the same session id. The registry showed the new name, and the status plugin logged `SessionStart` with `source: "resume"` under the spec's number.
- **Typing it into the open To spec session works too** (B, D), the way upstream describes. That session keeps the map's name, `#5 Sentence and paragraph counts`, while it asks about and writes the spec's tickets.
- **The writes**, after the answer, in one script per session:
  - In 3 of 4, `gh issue create --help | grep -E -- '--(parent|blocked-by)'` first, to check that this `gh` has the flags.
  - Then one `gh issue create --repo … --parent <spec> --label ready-for-agent --title … --body-file …` per ticket, blockers first, with `--blocked-by <n>` or `--blocked-by <n>,<n>` on a blocked ticket.
  - No `gh api` call, no `--add-sub-issue`, no `--add-blocked-by`. Run D also replaced three ticket bodies afterwards with `gh issue edit --body-file`, to fill in sibling numbers.
- **What GitHub then holds** for a build ticket: a native parent, native `blockedBy` edges, the one label, no assignee, 7 to 12 unticked boxes. The spec lists it under `subIssues` in creation order.
- **The body.** `## Parent` holds `#<spec>` (one session added the title in parentheses), then `## What to build` and `## Acceptance criteria`. No ticket has `## Blocked by`, since the template says to omit it when the edges are native.
- **The spec is untouched** and keeps `ready-for-agent` beside its tickets. One session pointed it out: "An agent picking work by that label could pick up the whole spec as well as its tickets."
- **A new ticket is briefly parentless.** `gh` sets the label, the parent and each edge in separate requests: #12 was created at 21:22:20, labelled at :21, and given its blocker and its parent at :23. For 1 to 3 seconds a new build ticket is an open `ready-for-agent` issue with no parent.
- **The four task graphs:** A a diamond (#11, then #12 and #13, then #15), B and C chains of three, D two parallel tickets and a third blocked by both.

## `/implement-spec` with the tracker doc alone (runs A and B)

|                          | Run A, no `-w`                                                                                              | Run B, `-w 9`                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Integration branch       | `spec-10-counts`, by `git switch -c` in the launch checkout                                                 | `spec-9-sentence-paragraph-counts`, by `git switch -c` inside worktree `9`; `worktree-9` keeps no commits |
| Assigned                 | Nothing                                                                                                     | Nothing                                                                                                   |
| Implementers             | `Agent`, `isolation: "worktree"`, `run_in_background` unset; each renamed its branch to `ticket-<n>-<slug>` | The same; branches stayed `worktree-agent-<id>`                                                           |
| At once                  | #12 and #13 together                                                                                        | One at a time (a chain)                                                                                   |
| Subagents                | 12: 5 implementers, 5 mergers, 2 reviewers                                                                  | 10: 4 implementers, 4 mergers, 2 reviewers                                                                |
| On GitHub while building | Nothing, from 21:23:41 to 21:49:51                                                                          | Nothing, from 21:23:41 to 21:47:35                                                                        |
| Pull request             | None: "No PR was opened, because the tracker closes work by comment and close."                             | None: "No draft PR was opened, since this tracker closes work by comment"                                 |
| Push                     | `git push -u origin spec-10-counts` at 21:49:46, "so the closing comments point at reachable commits"       | `git push -u origin spec-9-sentence-paragraph-counts` at 21:47:31, for the same reason                    |
| Build tickets            | `gh issue comment` then `gh issue close` for each, 21:50:04 to 21:50:17                                     | The same for each, 21:47:59 to 21:48:07                                                                   |
| Spec                     | Left open, with one status comment                                                                          | Left open, with no comment                                                                                |
| Checkout after           | The launch checkout is on `spec-10-counts`                                                                  | The launch checkout is untouched, on `main`                                                               |
| Exit                     | No dialog                                                                                                   | The worktree dialog; `waiting`, `dialog open`                                                             |

More, seen in both:

- **How the tickets end:** `CLOSED` with `stateReason: COMPLETED`, closed by the session (the closed event names no pull request or commit), one comment each naming the commits and the branch, never assigned, still labelled `ready-for-agent`, boxes unticked.
- **How the spec ends:** open, `subIssuesSummary` 4 of 4 or 3 of 3 completed, with a branch on `origin` that no issue links to except in a comment's text. Both sessions said the spec stays open because the work is not on `main`.
- **The whole tracker change takes under a minute** at the end of a 25-minute run. Until then a reader of GitHub can't tell that the spec is being built.
- **Cleanup** removed the run's own implementer worktrees and deleted their merged branches.
- **The exit dialog under `-w`** now reads: "Exiting worktree session. This session was named "#9 Spec: …". Keep the worktree to resume it later, or remove it to clean up. The worktree is now on branch spec-9-sentence-paragraph-counts, which is kept either way." Keep is the default.

## `/implement-spec` when the repo says work closes through pull requests (runs C and D)

|                         | Run C, no `-w`                                                                                   | Run D, `-w 26`                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Assigned                | Spec #27 and tickets #28, #29, #30, by `gh issue edit <n> --add-assignee @me`, 49 s after launch | Spec #26 and tickets #31, #32, #33, the same way, 56 s after launch                        |
| Integration branch      | `spec-27-longest`, by `git checkout -b` in the launch checkout                                   | `spec-26-digit-punctuation-counts`, by `git switch -c` inside worktree `26`                |
| First push              | 22:12:08, after the first merge                                                                  | 22:11:39, after the first merge                                                            |
| Draft pull request      | #34 at 22:12:24, 8 minutes after launch                                                          | #35 at 22:12:38, 8 minutes after launch                                                    |
| Later pushes            | After every merge, by the merger subagent                                                        | After every merge, by the orchestrator                                                     |
| Commits on it over time | 2, 4, 6, 11                                                                                      | 2, 5, 9, 14                                                                                |
| Ready                   | `gh pr edit 34 --body-file …` then `gh pr ready 34`, 22:35:21                                    | `gh pr edit 35 --body-file …` then `gh pr ready 35`, 22:30:30                              |
| Issues                  | No comment, no close, no edit; open and assigned at the end                                      | The same                                                                                   |
| Subagents               | 10                                                                                               | 10, with #31 and #32 built together                                                        |
| Exit                    | No dialog; the launch checkout is on `spec-27-longest`                                           | The worktree dialog; Remove deleted the folder and `worktree-26`, and kept the spec branch |

**The pull request**, the same shape in both:

- **Created by** `gh pr create --draft --base main --head <integration branch> --assignee @me --title 'tally: <feature> (…)' --body-file …`. The title holds no issue number.
- **The closing lines open the description.** #34 has four lines, `Closes #27`, `Closes #28`, `Closes #29`, `Closes #30`. #35 has one: `Closes #26. Closes #31. Closes #32. Closes #33.` GitHub parsed both forms: `closingIssuesReferences` listed the spec and its three tickets.
- **While a draft**, the description says so and names what is merged so far: "Draft: the integration branch for spec #27. #28 is merged here; #29 and #30 land next, then a code review."
- **When ready**, the description is replaced: a summary, before-and-after evidence and a merge-risk section. It ends with the Claude Code attribution and the session's link.
- **Its facts:** author and assignee the logged-in user, no label, no comment, `reviewDecision: null`, no checks (`statusCheckRollup: null`, as the throwaway has no workflow).
- **Its states, as read:** a draft reads `isDraft: true` with `mergeable: MERGEABLE` and `mergeStateStatus: CLEAN`, not `DRAFT`. After every push, one reading (10 seconds or less) says `UNKNOWN` for both.

**What the issues show meanwhile.** From 22:05, a minute in, the spec and every ticket are assigned. From 22:12, each one's `closedByPullRequestsReferences` names the pull request, though only the first ticket is built. Nothing else changes on an issue until the merge: no box is ticked, and `ready-for-agent` stays.

**The paragraph says "the ticket"; the session applied it to the whole run.** It was written for one build session per ticket, and `/implement-spec` read it as: assign the spec and all its tickets, one branch, one pull request that closes them all.

## The merge

The developer's step, on the throwaway only: `gh pr merge 34 --merge` at 22:37:00.

- **GitHub closed the issues one by one, in the order of the `Closes` lines:** spec #27 at 22:37:02, then #28 at :03, #29 at :05 and #30 at :07. Each is `COMPLETED`, and its closed event names pull request #34.
- **A reading in between is inconsistent.** The watcher's reading at 22:37:04 had the spec and #28 closed and #29 and #30 open.
- **The other pull request then conflicted.** #35 read `UNKNOWN`, then `mergeable: CONFLICTING` with `mergeStateStatus: DIRTY`, since both specs edit the same command table. It was left that way.
- **The head branch stays** after the merge; the repository does not delete merged branches.

## What the Cockpit can see from outside

- **The registry** has one entry per session, named by `-n`, with the worktree as `cwd` under `-w`. All four spec runs read `busy` from start to end. The only other reading was one `idle` in run B, 2 seconds or less, 23 minutes in. `waiting` had two causes: `input needed` at the To tickets question, and `dialog open` at the `-w` exit dialog. One entry had no `status` on its first poll.
- **The status plugin** logged one `SessionStart` and one `SessionEnd` per session and nothing for any subagent. A resumed session starts with `source: "resume"`.
- **Git, locally.** Locked `agent-` worktrees count the running implementers, as in #215 (2 at the peak of A and D). In rounds with a pull request, `origin/<integration branch>` moves after every merge. Without one, the branch has no upstream until the last minute.
- **GitHub, round 1.** Nothing during the build. At the end: a new branch, then each build ticket gains a comment and closes, seconds apart.
- **GitHub, round 2.** Assignees about a minute in. A draft pull request after the first merge that names the spec and every ticket as closing. A growing commit count. Then `isDraft: false`. Then, at the merge, the closes.
- **The worktree guard** refused several of this walk's own watcher commands, which came from a `-w` session: any compound command that names git, and any command whose text contains "git" in a file name or a URL. Plain `git -C <literal path>` calls passed.

## Against #215

| Fact                            | #215: local tracker, Opus 5.5                  | Here: GitHub, Fable 5.2                                                                     |
| ------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| How `/to-tickets` asks          | Plain text; the registry reads `idle`          | `AskUserQuestion`; the registry reads `waiting`, `input needed` (4 of 4)                    |
| Integration branch without `-w` | `feature/<slug>`                               | `spec-<n>-<slug>` (2 of 2)                                                                  |
| Integration branch under `-w`   | The session's own `worktree-<name>`            | A new `spec-<n>-<slug>` in the worktree; `worktree-<n>` stays empty (2 of 2), as #199 found |
| Implementer branches            | `worktree-agent-<id>`                          | Renamed to `ticket-<n>-<slug>` in 3 of 4 runs                                               |
| Pull request                    | None: the tracker is local                     | None with the tracker doc alone; a draft one when `CLAUDE.md` says so                       |
| When tickets close              | All at once in the last minute, by the session | The same with no pull request; by the merge with one                                        |
| The spec at the end             | `Status: resolved` with its tickets            | Left open in both rounds; only the merge closes it                                          |
| Boxes                           | Ticked in 1 of 2 runs                          | Never ticked (0 of 4)                                                                       |
| Push                            | Never                                          | At the end with no pull request; after every merge with one                                 |

## What this means for decisions on the map

Facts only; the decisions are the tickets' own.

- **For [#210 How does a whole-spec run show in the Cockpit?](https://github.com/dbarjs/hero-synergy/issues/210), which closed while this ran.** None of its rules changes; these facts say which fire.
  - "One pull request that closes the spec and its tickets" holds only when the repo's `CLAUDE.md` says work closes through pull requests. With the 1.3.2 tracker doc alone there is no pull request, the tracker is silent until the end, the tickets are closed by the session and the spec stays open as built, not hidden as on a local tracker.
  - Under `-w <spec>` the work is on `spec-<n>-<slug>`, never on `worktree-<spec>`. #210 reads the worktree by its path whatever branch is checked out, which fits. Its fallback that attaches a pull request by a `worktree-<spec>` branch name would not have matched either pull request here.
  - Both pull requests carried one closing keyword per number, so neither of #210's two drift codes would fire.
  - Its README paragraph "Building a whole spec" needs a line saying when a pull request opens at all, and none about keywords.
- **For [#211 What does the snapshot hold for a spec and a build ticket?](https://github.com/dbarjs/hero-synergy/issues/211), open.** One pull request can be the closing pull request of a spec and of every build ticket at once. A build ticket has no `## Blocked by` section, only native edges. A spec's map is a `#n` in its text, in 1 of 4 specs only under `## Further Notes`.
- **For [#203 How does the scout recognise a spec and its build tickets?](https://github.com/dbarjs/hero-synergy/issues/203), closed.** "The first map it names before its first heading" finds the map of 3 of these 4 specs. A new build ticket is a lone `ready-for-agent` issue for 1 to 3 seconds before its parent lands.
- **For [#205 Which Actions carry an idea or a finished map to a spec and its build tickets?](https://github.com/dbarjs/hero-synergy/issues/205), closed.** A To tickets session reads `waiting` at its question, not `idle`. When `/to-tickets` is typed into the To spec session, the question shows on the session named after the map.
- **For [#206](https://github.com/dbarjs/hero-synergy/issues/206), closed.** Its README paragraph, read by `/implement-spec`, assigns the spec and all its tickets at the start and opens one pull request for all of them.
- **For [#208](https://github.com/dbarjs/hero-synergy/issues/208), closed.** A whole-spec run with no pull request ends at **built** every time, not rarely. With a pull request, the merge closes the spec before its tickets, so a reading can hold a closed spec with open build tickets.
- **For [#209 Does the Cockpit show a build ticket's pull request?](https://github.com/dbarjs/hero-synergy/issues/209), closed.** A whole-spec pull request closes, by keyword, tickets that are not built yet, so by #209's rule it claims every open ticket of the spec from the first merge on. A draft pull request reads `mergeStateStatus: CLEAN`. `UNKNOWN` follows every push for a reading.

## Still open

- **`/to-spec` asking its seam question.** It skipped it in 4 of 4, as in #215.
- **Checks on the pull request.** The throwaway has no workflow, so `statusCheckRollup` was always null.
- **`/implement` on one build ticket on GitHub**, with and without the paragraph. This walk ran the two skills the ticket named.
- **A `CLAUDE.md` worded otherwise.** One paragraph, one wording.
- **Variation.** Two runs per round. The same repo held all four efforts, and each session read the others' issues and branches.
- **Other versions:** the plugin at `v1.3.2` proper, Claude Code 2.1.212, another model.
- **Not covered, as in #215:** a failing implementer, a rate limit, a permission prompt inside a subagent, a frontier wider than two.

## What is left on GitHub

[`dbarjs/flow-walk-throwaway`](https://github.com/dbarjs/flow-walk-throwaway) stays as the walk left it, for Eduardo to look at and delete:

- Four open maps, each finished.
- Specs #10 and #9: open and built, their branches pushed, no pull request.
- Spec #27: closed by merged pull request #34.
- Spec #26: open, with pull request #35 ready and in conflict with `main`.

## Files

In [`flow-walk-github/`](flow-walk-github/):

- `launches.log`: every launch line and every key pressed, as run.
- `registry.log`: every change in `claude agents --json` for the walk's sessions.
- `snapshots-a.log` and `snapshots-b.log`: every change in each clone's worktrees, branches and checkout status.
- `github-changes.log`: from the GitHub readings, each branch, issue and pull request line at the time it first read that way.
- `hooks.jsonl`: every hook payload, timestamped, minus its path and id fields.
- `status-events-a.jsonl` and `status-events-b.jsonl`: what the status plugin wrote.
- `tracker-final.json`: every issue and pull request as the walk left them, with bodies, comments and timelines.
- `harness/`: the throwaway repository's hook settings and second-round `CLAUDE.md`, and the scripts that launched, typed, watched and summarised.
