# The spec flow, walked once for real

Findings for [#215 Walk the whole flow once on a throwaway spec and record what each skill does](https://github.com/dbarjs/hero-synergy/issues/215), on map [#195 Specs and build tickets in the Cockpit](https://github.com/dbarjs/hero-synergy/issues/195). Run on 2026-11-16. It follows [#199 What do /to-tickets, /implement and /implement-spec need from a Claude Code session?](https://github.com/dbarjs/hero-synergy/issues/199), which ran Claude Code against a scripted stand-in for the model and left open everything a model decides. Here every session ran a real model.

Every fact below was **seen** in a run unless it is marked otherwise. Each run happened once, so anything the model chose (a branch name, how many implementers at once, whether to tick a box) is one sample.

## What was run

- **Claude Code 2.1.325** (installed), logged in, with Eduardo's real `~/.claude` (no scratch config). The model was Opus 5.5 at `xhigh` effort, from his settings.
- **Skills: the installed plugin, `49dd158`, shown as 1.3.1**, which is the marketplace's current pin. Its `to-spec`, `to-tickets`, `implement` and `tdd` are byte-identical to tag [`v1.3.2`](https://github.com/mattpocock/skills/tree/v1.3.2). Its `implement-spec` and `code-review` lack one sentence that `v1.3.2` adds: "Start every subagent with a fresh context window." Every subagent in these runs was a fresh `general-purpose` agent, so that sentence describes what happened anyway.
- **His `permissions.defaultMode` is `bypassPermissions`.** So the plain launches (To spec, To tickets) also ran with bypass on, and no session saw a permission prompt. Implement and Implement spec were launched with `--permission-mode bypassPermissions`, as the Cockpit would launch AFK build tickets ([#204 Which tickets are AFK, and which sessions bypass?](https://github.com/dbarjs/hero-synergy/issues/204)).

**Tracker: local markdown, not GitHub.** The ticket says a throwaway repository under Eduardo's account needs his word first. He was away, so the walk used the fallback that needs none. Pull requests and GitHub closes are therefore [still open](#still-open).

**The throwaway repository** is `tally`, a Node CLI with no dependencies and an empty subcommand table, under the session scratchpad. It had a bare `origin` on disk, the setup skill's local templates in `docs/agents/`, a `CLAUDE.md` with the `## Agent skills` block, and `.scratch/` gitignored, as the Cockpit assumes. The starting point was a finished local map, `.scratch/word-counts/map.md`, with three resolved grilling tickets. Nothing ran against this repository or its tracker.

**How the sessions were driven.** Each session ran in its own tmux window, from the argv the Cockpit builds, with the parent session's Claude Code variables removed. Questions were answered by typing into the window. Three things were watched from outside the whole time:

- `claude agents --json`, polled every 2 seconds, with every change logged.
- `git worktree list`, the branches, the bare remote, the main checkout's status and every `Status:` and `Blocked by:` line in `.scratch`, polled every 2 seconds, with every change logged.
- Passive hooks in the throwaway repository's `.claude/settings.json`. Each one appends its payload to a log and allows everything: `PreToolUse` (Agent, Bash, Skill, AskUserQuestion), `SubagentStart`, `SubagentStop`, `Notification`, `Stop` and `UserPromptSubmit`.

The transcripts were read afterwards. The logs, the tracker files as the runs left them, and the scripts are in [`flow-walk/`](flow-walk/).

| Step                  | Launch (the Cockpit's argv)                                                                                                                                       | Wall time       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| To spec               | `claude '/mattpocock-skills:to-spec .scratch/word-counts/map.md'`                                                                                                 | 1 min 29 s      |
| To tickets            | `/exit`, then `claude --resume <id> '/mattpocock-skills:to-tickets .scratch/word-counts/spec.md'`, then one approval typed in the terminal                        | 24 s, then 50 s |
| Implement 04          | `claude --permission-mode bypassPermissions -n '#4 tally words' -w 4 '/mattpocock-skills:implement .scratch/word-counts/issues/04-tally-words.md'`                | 6 min 8 s       |
| _(developer)_         | Fast-forwarded `main` to `worktree-4` and pushed it; left ticket 04's `Status:` as Implement left it                                                              |                 |
| Implement spec, run A | `claude --permission-mode bypassPermissions -n 'Spec: Word, line and character counts' '/mattpocock-skills:implement-spec .scratch/word-counts/spec.md'`, no `-w` | 16 min 7 s      |
| Implement spec, run B | The same with `-w word-counts`, in a fresh clone of the same `origin` with the same `.scratch`, started at the same moment                                        | 14 min 53 s     |

## Answer

1. **`/implement-spec` uses the Agent tool's worktree isolation.** Implementers and the review-fix implementer are `Agent` calls with `isolation: "worktree"`, landing in `.claude/worktrees/agent-<id>` on `worktree-agent-<id>`, branched from `origin/main`. Each implementer then resets or merges onto the integration branch tip. No session ran `git worktree add`.
2. **The integration branch depends on `-w`.** Without `-w` the orchestrator ran `git switch -c feature/word-counts main` in the checkout it was launched in, and left that checkout on the new branch. Under `-w word-counts` it created no branch: the session's own `worktree-word-counts` was the integration branch. #199's scripted run made a new branch inside the worktree and left `worktree-<n>` empty; the real model did neither.
3. **Implementers run in the background, as many as the frontier allows.** Every `Agent` call left `run_in_background` unset, and Claude Code backgrounded them all. Tickets 05 and 06 ran side by side; 07 started once both were merged. Mergers and reviewers were background agents too.
4. **The merger is a non-isolated background subagent** working in the integration branch's checkout: the main checkout in run A, the session's worktree in run B. It merged one branch at a time. The second of 05 and 06 conflicted, and the merger resolved the conflict itself.
5. **No pull request, no push, nothing merged to `main`**, on a local tracker. Both orchestrators said this tracker closes work through its `Status:` line, not pull requests. Both ended by offering to merge or push.
6. **Tickets close at the very end, all at once.** Ticket 04 was already built and merged, but its `Status:` still read `ready-for-agent`. Both runs recognised it from `main`'s history and resolved it first, without rebuilding it. Tickets 05, 06 and 07 and the spec turned `Status: resolved` together in the last minute, each with a `## Comments` note naming its commits. Until then the tracker showed no progress.
7. **The `-w` exit dialog** reads "You have 8 commits on worktree-word-counts. The branch will be deleted if you remove the worktree.", offering "Keep worktree" (the default) or "Remove worktree". Here that branch is the integration branch, so Remove would delete the whole spec's work. While the dialog is open, the registry says `waiting` with `waitingFor: "dialog open"`.
8. **`/to-spec` and `/to-tickets` ask in plain text.** The registry read `idle` and never `waiting`, and no `AskUserQuestion` call was made. `/to-spec` asked nothing at all: the map named the seam, so it skipped the seam check.
9. **`claude --resume <id> "/to-tickets <spec>"` works with a real model.** The resumed session built on the To spec conversation. The session id stays the same, but the default display name changes (`repo-c3` became `repo-d8`).
10. **`/implement` commits to its branch and stops.** It made two commits on `worktree-4`. It did not assign the ticket, edit it, push, open a pull request or close anything; the agent docs don't tell it to. Under `-w` it found the gitignored ticket through `git worktree list`, and it left the ticket file alone because the file is outside its worktree.
11. **Locally, the spec and build tickets live in the map's folder.** `/to-spec` wrote `.scratch/word-counts/spec.md` beside `map.md`, with a `Map:` line linking back. `/to-tickets` numbered the build tickets 04 to 07, after the map's decision tickets 01 to 03, in the same `issues/` folder.

## `/to-spec`

- **Asked nothing.** Its step 2 says to check the seams with the user. It said instead: "The map names run(argv) as the test seam, and that is the highest one there is, so I'm using it as the only seam without asking." It ended with three "points to check" written as plain text. The registry went `busy`, then `idle`, and never `waiting`. No `AskUserQuestion` hook fired.
- **Wrote `.scratch/word-counts/spec.md`**, in the map's folder, since the tracker doc says a spec is `.scratch/<feature-slug>/spec.md` and it took the map's slug. The file has:
  - `# Spec: Word, line and character counts`, the map's title with `Spec:` in front.
  - `Status: ready-for-agent`, the triage role, as a plain line.
  - `Map: [map.md](map.md). Decisions: [01 line](issues/01-what-is-a-line.md), …`, a link back to the map and each decision ticket, in a line of its own.
  - The seven H2s of the template, with 33 user stories.

  On GitHub the three real specs link their maps only in prose ([#198 What can GitHub's API report about specs, build tickets and their pull requests, and at what cost?](https://github.com/dbarjs/hero-synergy/issues/198)). Locally, this spec carries the link in a line of its own.

- **Committed nothing**, and said so, because `.scratch/` is gitignored.
- **Registry.** Launched without `-n`, it showed the default name `repo-c3`.

## `/to-tickets`, by resuming the To spec session

- **The resume.** To spec was ended with `/exit`, then `claude --resume 3dbbacc9-… '/mattpocock-skills:to-tickets .scratch/word-counts/spec.md'` was launched. The session came back with To spec's context. Its first reply took the map's resolved tickets into account: "Tickets 01–03 in .scratch/word-counts/issues/ are the resolved grilling tickets, so the new files would be numbered 04–07 to avoid overwriting them." The registry kept the `sessionId` and showed a new default name, `repo-d8`.
- **The quiz was plain text.** It listed four tickets with their blockers and asked three questions. The registry read `idle` 26 seconds after launch and never `waiting`.
- **After one typed approval** it wrote four files in 50 seconds, without touching the spec or the map:
  - `issues/04-tally-words.md`, blocked by nothing. It includes the one prefactor.
  - `issues/05-tally-lines.md` and `issues/06-tally-characters.md`, each blocked by 04.
  - `issues/07-tally-all.md`, blocked by 04, 05 and 06.
- **The shape of a local build ticket:**
  - `# NN: <title>`.
  - `Status: ready-for-agent` and `Blocked by: 04` as **plain** lines. The template writes `**Blocked by:**` and `**Status:**` in bold; the session said it matched "the existing tickets 01–03" instead.
  - `Spec: [spec.md](../spec.md)`.
  - A `**What to build:**` paragraph.
  - Checkboxes with no heading above them.
  - **No `Type:` line**, the field that marks a decision ticket.
- **One folder holds both kinds of ticket.** Locally, a decision ticket and a build ticket differ by the `Type:` line and the `Spec:` line, not by where they live. Their `Status:` lines differ only while open (`claimed` against a triage role): `/implement-spec` later resolved the build tickets, and the spec, with the same `Status: resolved` a decision ticket gets. Reasoned, not run: a `-w <number>` built from a local ticket number would collide across efforts, since every effort numbers from 01.

## `/implement` on build ticket 04, under `-w 4`

- **Finding the ticket.** The repo-relative path the Cockpit passes doesn't exist inside worktree 4, because `.scratch` is gitignored. The session's first command was `git worktree list`. It then read the ticket from the main checkout and stated it: "Ticket: **04: `tally words`** (Status: ready-for-agent, not blocked)". It asked nothing.
- **What it ran.** `/tdd`, then `/code-review`, which started two background reviewers (Standards and Spec) inside the worktree, then fixes.
- **Git.** Two commits on `worktree-4`: the prefactor `dc00689`, then the feature `29e5372`. Nothing was pushed (the bare `origin` didn't move) and no pull request was opened.
- **The tracker.** No claim and no status change. In its words: "I didn't change the ticket file. .scratch/ is gitignored and lives only in the main checkout, outside this worktree, so its Status: line and checkboxes are still unticked."
- **The registry** read `busy` for 6 minutes 10 seconds without a break, including the minute after its own turn ended (`Stop` at 20:09:34) while the reviewers ran.
- **Exit.** `/exit` opened "Exiting worktree session. You have 2 commits on worktree-4. The branch will be deleted if you remove the worktree." with Keep (the default) and Remove. The registry read `waiting`, `waitingFor: "dialog open"`. After Keep, Claude Code printed `claude --permission-mode bypassPermissions --worktree "4" --resume <id>`.

## `/implement-spec`, with and without `-w`

The developer had fast-forwarded `main` to ticket 04's work, and its `Status:` still read `ready-for-agent`. Both runs started from that state.

|                       | Run A, no `-w`                                                                                                                                                     | Run B, `-w word-counts`                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Spec found            | `.scratch/word-counts/spec.md` in its own checkout                                                                                                                 | Absent from the worktree; read from the main checkout after `ls` of it                    |
| Integration branch    | `feature/word-counts`, by `git switch -c feature/word-counts main` in the main checkout                                                                            | `worktree-word-counts`, the session's own branch; no branch created                       |
| Ticket 04             | Recognised as done from `main`'s history; `Status: resolved` at 20:14:31, before any implementer                                                                   | The same, at 20:15:03, written into the main checkout's `.scratch` with `sed`             |
| Implementers          | `Agent`, `isolation: "worktree"`, `run_in_background` unset: 05 and 06 together, then 07, then the review fixes                                                    | The same                                                                                  |
| Implementer worktrees | `.claude/worktrees/agent-<id>` on `worktree-agent-<id>`, from `origin/main`; each checked its base against the integration tip first and reset onto it when behind | The same, beside the session's worktree, not inside it                                    |
| Mergers               | Background `Agent` with no isolation, working in the main checkout, one per finished implementer                                                                   | The same, working in `.claude/worktrees/word-counts`                                      |
| Conflict              | Merging 05 after 06; resolved by the merger (`86d0bbd`)                                                                                                            | Merging 06 after 05; resolved by the merger (`3f3d23a`)                                   |
| Code review           | `/code-review`: two background reviewers, then one review-fix implementer in a worktree, then a merger                                                             | The same                                                                                  |
| Subagents in all      | 10: 4 implementers, 4 mergers, 2 reviewers                                                                                                                         | 10, the same split                                                                        |
| Tickets and spec      | 05, 06, 07 and the spec `Status: resolved` together at 20:29:11, each with a `## Comments` note; boxes left unticked                                               | The same at 20:28:10; boxes ticked; the notes on 05 to 07 end "Not yet merged to `main`"  |
| Draft pull request    | None: "There's no PR because this tracker is local markdown"                                                                                                       | None: "your tracker closes work with the Status: line rather than through PRs"            |
| Push or merge to main | Neither; `main` stays at `29e5372`                                                                                                                                 | Neither                                                                                   |
| Cleanup               | Removed its 4 agent worktrees and branches, **and `worktree-4`**, the earlier Implement session's worktree, because it was merged                                  | Removed its 4 agent worktrees and branches; its own worktree stays                        |
| Main checkout after   | Left on `feature/word-counts`                                                                                                                                      | Untouched, on `main`                                                                      |
| Its closing offer     | "I can merge the branch into main, or push it and open a PR."                                                                                                      | "To land it, merge worktree-word-counts into main."                                       |
| Exit                  | No dialog                                                                                                                                                          | The Keep/Remove dialog with "8 commits on worktree-word-counts"; `waiting`, `dialog open` |

More, seen in both runs:

- **The orchestrator's turn ends after each spawn.** A `Stop` hook fired right after every background spawn, and each agent's completion came back as a new turn, with a `UserPromptSubmit` hook. The registry nevertheless read `busy` almost throughout: run A for 16 minutes without a break, and run B with one `idle` reading at 20:20:45 that lasted 3 seconds or less. That reading fell between the 07 implementer finishing and the next turn starting. A 2-second poll can catch the orchestrator `idle` mid-run.
- **The review-fix implementer ran `/domain-modeling`** in both runs, and added **Line** and **Character** to `GLOSSARY.md`, which the spec's Further Notes had asked for.
- **Claude Code's worktree guard.** In a `-w` session and in every subagent spawned with `isolation: "worktree"`, Claude Code 2.1.325 refuses git commands it cannot prove stay inside the worktree. That covers compound commands naming git, `git -C <shared checkout>` and `cd` into the shared checkout ("This session is isolated in the worktree …, but this command redirects git to the shared checkout via -C. Refusing to run it"). Every worktree-isolated session and implementer hit it at least once. Each recovered by splitting the command or writing a script. The guard doesn't stop plain file writes, so run B could still edit the main checkout's `.scratch`. Run A's orchestrator and its mergers, working in the main checkout, never hit it.

## What the Cockpit can see from outside

- **The registry** has one entry per session; subagents never appear in it, as in #199. A spec run reads `busy` while it works, with the short `idle` gaps described above, then `idle` at the end. The only `waiting` in the whole walk was the `-w` exit dialog (`dialog open`). To tickets read `idle` while it waited for its approval, because it asks in plain text. A session launched without `-n` gets a default name, and a resume gives it a new one.
- **`git worktree list`** shows each implementer as `.claude/worktrees/agent-<id> … [worktree-agent-<id>]`. It is marked `locked` while its subagent runs and unlocked the moment it finishes, then disappears at cleanup. The number of locked `agent-` worktrees was the number of running implementers: 2 at the peak. A `-w` session's own worktree is `locked` while its session runs.
- **The integration branch** moves with every merge: `feature/word-counts` in the main checkout, or `worktree-<name>` in a `-w` session.
- **The local tracker** shows nothing until the end: one ticket at the start (only because it was already done), then everything at once. On a local tracker, the Cockpit can't follow a spec run's progress through ticket states.
- **Hooks.** `SubagentStart` and `SubagentStop` fire for every `Agent` subagent, with `agent_id`, `agent_type` and the subagent's `cwd`; for an implementer, that `cwd` is its worktree. `PreToolUse` on `Agent` carries the `description` ("Implement ticket 05 tally lines") and `isolation`. After every main-turn `Stop` there is one more `SubagentStop`, with no `agent_type` and no matching start: an internal helper, to be filtered out.
- **Transcripts.** A `-w` session's transcript lives under the **main checkout's** project folder, `~/.claude/projects/<encoded repository root>/<session-id>.jsonl`, not the worktree's. Each subagent writes `<session-id>/subagents/agent-<id>.jsonl` from its start. Beside it sits `agent-<id>.meta.json`, holding `description`, `worktreePath`, `worktreeBranch`, `requestShape: "background"` and `finished: true`; it was last written when the subagent finished.

## Launch facts met on the way

- **A folder that was never trusted** opens on the trust dialog, whose highlighted default is "No, exit" (2.1.325).
- **`-w` in a folder that was never trusted fails outright**, with exit code 1 and no dialog: "Error creating worktree: Workspace trust not yet accepted. Run `claude` once in this directory and accept the trust dialog, then retry with --worktree."
- **The resume line printed at exit** includes the launch's `--permission-mode` and `--worktree`, for example `claude --permission-mode bypassPermissions --worktree "word-counts" --resume <id>`.

## Still open

- **Everything GitHub-specific.** Whether `/implement-spec` opens the draft pull request and when; whether the build tickets close by `Closes #n` or by the session; whether `/to-tickets` makes sub-issues and native blocking edges; whether anything is assigned, pushed or labelled on GitHub. This needs a throwaway GitHub repository, and that needs Eduardo's word.
- **How `/to-spec` asks when it does ask.** Here it skipped the question.
- **Typing `/to-tickets` into the still-open To spec session**, upstream's own way, wasn't run; the resume path was.
- **Variation between runs.** One run each. The branch name `feature/word-counts`, the merge order, ticking boxes and cleaning up another session's worktree are choices a model made once.
- **A spec with no prior work**, a frontier wider than two, a failing implementer, a rate limit.
- **A permission prompt inside a subagent.** Bypass was on everywhere.
- **Claude Code 2.1.212**, the floor, and the plugin at `v1.3.2` proper. The only difference is the one sentence quoted above.
- **Whether a subagent's `.meta.json` exists before the subagent finishes.**

## Files

In [`flow-walk/`](flow-walk/):

- `launches.log`: every launch line, as run.
- `registry.log`: every change in `claude agents --json` for the throwaway repositories.
- `snapshots-run-a.log` and `snapshots-run-b.log`: every change in the worktrees, branches, remote, main checkout status and tracker status lines. Run A's file also covers To spec, To tickets and Implement.
- `hooks.jsonl`: every hook payload, timestamped.
- `tracker-after-run-a/` and `tracker-after-run-b/`: the map, spec and tickets as each run left them.
- `harness/`: the throwaway repository's hook settings and the scripts that launched, watched and summarised.
