# What the spec flow's sessions need from Claude Code

Research for [#199 What do /to-tickets, /implement and /implement-spec need from a Claude Code session?](https://github.com/dbarjs/hero-synergy/issues/199), on map [#195 Specs and build tickets in the Cockpit](https://github.com/dbarjs/hero-synergy/issues/195). Done on 2026-11-16 against Claude Code 2.1.325 (the installed version, and the newest [changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) entry that day), Claude Code 2.1.212 (the floor in [`docs/upstream.md`](https://github.com/dbarjs/hero-synergy/blob/main/docs/upstream.md)) and the skills at tag [`v1.3.2`](https://github.com/mattpocock/skills/tree/v1.3.2) of `mattpocock/skills`.

Every fact is marked **read** (a doc, the changelog, `--help`, a skill's text) or **run**, with the version it ran on. No run reached a model: see the next section before trusting a "run".

## How it was measured

**Read.**

- The Claude Code docs, fetched as Markdown on 2026-11-16: [CLI reference](https://code.claude.com/docs/en/cli-reference), [sessions](https://code.claude.com/docs/en/sessions), [worktrees](https://code.claude.com/docs/en/worktrees), [subagents](https://code.claude.com/docs/en/sub-agents), [agent view](https://code.claude.com/docs/en/agent-view), [skills](https://code.claude.com/docs/en/skills), [non-interactive mode](https://code.claude.com/docs/en/headless) and [hooks](https://code.claude.com/docs/en/hooks).
- The changelog, to its newest entry, 2.1.325.
- `claude --help` on 2.1.212 and 2.1.325.
- The skills at `v1.3.2`: `SKILL.md` of `to-spec`, `to-tickets`, `implement`, `implement-spec` and `ask-matt`, their pages under `docs/engineering/`, the tracker templates under `setup-matt-pocock-skills/` and `CHANGELOG.md`.

**Run.** Two binaries: 2.1.325 (installed) and 2.1.212 (the linux-arm64 build from npm, `@anthropic-ai/claude-code-linux-arm64`). Every run used a scratch `HOME`, a scratch `CLAUDE_CONFIG_DIR` and scratch repositories, each cloned from its own bare `origin`, all under the session scratchpad. Nothing ran in this repository, against its tracker or against `~/.claude`.

The scratch configs have no login. `ANTHROPIC_BASE_URL` pointed at a local stand-in for the Messages API (about 130 lines of Python) that saves every request body and answers with a scripted reply: a text, or tool calls such as `Bash` or `Agent`. So:

- **What a run measures is the harness**: how `claude` reads its arguments, what it reloads from a transcript, what a slash command expands to, which worktree and branch it creates, what it writes to the registry.
- **What a run cannot measure is the model**: whether a real session running `/implement-spec` asks for `isolation: "worktree"`, what it names a branch, whether it asks a question as plain text or through a tool. Those are listed under [Only a real run settles](#only-a-real-run-settles).

Interactive runs went through a Python pty harness that reads the screen and sends keys. Onboarding was marked done in the scratch config; the trust dialog was answered through the pty. The runs set `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, so no feature flags were fetched and gated behaviour ran on its built-in default.

| Run | Mode        | What it did                                                                                                                                                               |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | print       | A first session, then `--resume <id> "/probe …"`, then `--continue "/probe …"`, then a fresh `"/probe …"`                                                                 |
| S2  | interactive | The same, with `-n "#7 Spec probe"`, each session ended with `/exit`                                                                                                      |
| S3  | print       | One subagent with `isolation: "worktree"`, from the main checkout on a local branch (a), from a `-w 42` session (b), and from `-w 42` with `worktree.baseRef: "head"` (c) |
| S4  | interactive | Two background subagents with `isolation: "worktree"`, `claude agents --json` polled every two seconds; then one whose command needs a permission                         |
| S5  | print       | A second `-w 42` session after the first left the worktree in one of nine states and `origin/main` moved on                                                               |
| S6  | interactive | A session left open and idle, resumed by id from a second terminal under a new `-n`                                                                                       |

`/probe` is a project skill with the frontmatter shape of the four upstream skills: `disable-model-invocation: true`, no `argument-hint`, no `$ARGUMENTS` in its text.

**One logged-in observation.** This research itself ran as a background subagent in its own worktree, spawned by an interactive session on 2.1.325 with a real login. `claude agents --json` was read from inside it, twice.

## Answer

1. **A finished session takes a new slash command.** `claude --resume <session-id> "/to-tickets <spec>"` reloads the conversation and runs the skill on top of it, in a terminal and in print mode, on 2.1.212 and 2.1.325 (run). `--continue` does the same for "the most recent conversation in the current directory", which the Cockpit cannot aim. A session that is still open must not be resumed: Claude Code starts a second process on the same transcript without a warning (run).
2. **`/implement` under `-w <n>` commits to `worktree-<n>`**, in `.claude/worktrees/<n>`, branched from `origin`'s default branch. Nothing in the skill pushes, opens a pull request or closes the ticket. A second `-w <n>` reopens the old tip unless the worktree is clean and either has no commits or was merged with its remote branch deleted and pruned (run).
3. **`/implement-spec`'s implementers, when spawned with `isolation: "worktree"`, land in `<repository root>/.claude/worktrees/agent-<id>` on `worktree-agent-<id>`, branched from `origin`'s default branch**, with or without `-w` on the session, and never from the integration branch (run). Under `-w <n>` the integration branch is made inside the session's worktree and `worktree-<n>` stays empty.
4. **The registry shows one session.** Subagents get no entry and no name there. The parent reads `busy` for as long as a background subagent runs, even after its own turn ended, and `waiting` with `permission prompt` when a subagent needs an approval (run, both versions).
5. **Arguments.** None of the four skills declares an argument; Claude Code appends `ARGUMENTS: <text>` to the skill's text (run). `/to-spec` reads the conversation (upstream's own page passes the map: `/to-spec #<map_issue>`), `/to-tickets` takes "a spec path, an issue number or URL", `/implement` takes a ticket reference, `/implement-spec` takes "a pointer to the spec (an issue number or a file path)".

## 1. Continuing a session with a new slash command

Upstream wants one context window: "Keep steps 1–3 in **one unbroken context window** (don't compact or clear until after `/to-tickets`) so the grilling, spec, and tickets all build on the same thinking" ([`ask-matt`, Context hygiene](https://github.com/mattpocock/skills/blob/v1.3.2/skills/engineering/ask-matt/SKILL.md), read).

### `--resume <id>` with a positional slash command

- **Read.** The CLI reference lists `claude -r "<session>" "query"`, "Resume session by ID or name", with the example `claude -r "auth-refactor" "Finish this PR"`. `claude --help` on both versions prints `Usage: claude [options] [command] [prompt]`.
- **Read.** In print mode "User-invoked skills and custom commands work. Include `/skill-name` in the prompt string and Claude Code expands it before running" ([non-interactive mode](https://code.claude.com/docs/en/headless)).
- **Read.** The changelog dates the positional slash command: 2.1.0 "Fixed slash commands passed as CLI arguments (e.g., `claude /context`) not being executed properly". 2.1.267 fixed "resuming a session after `/compact` or another slash command ran via `-p --resume`". No entry names an interactive `--resume` with a slash command.
- **Run, 2.1.212 and 2.1.325, interactive (S2) and print (S1).** A first session was given `Remember the codeword MANGO-7` and ended with `/exit`. Then:

  ```text
  claude --resume <session-id> -n "#7 Spec probe" "/probe https://example.test/issues/7"
  ```

  The request Claude Code sent held the first prompt, the first answer, and then the skill:

  ```text
  user:      Remember the codeword MANGO-7
  assistant: FIRST-OK
  user:      <command-message>probe</command-message>
             <command-name>/probe</command-name>
             <command-args>https://example.test/issues/7</command-args>
  user:      Base directory for this skill: <repo>/.claude/skills/probe

             PROBE-SKILL-BODY. Report the codeword given earlier in this conversation.

             ARGUMENTS: https://example.test/issues/7
  ```

  The session id and the transcript file stayed the same; the process got a new pid. The registry listed it as `interactive`, with the same `sessionId` and the name `#7 Spec probe`.

### `--continue`

- **Read.** "Load the most recent conversation in the current directory", skipping sessions created with `claude -p` or the Agent SDK and sessions whose first prompt was `/loop` (CLI reference). "`--continue` picks the most recent session recorded under the directory you launch from", and a `-w` session is recorded under its worktree: "When Claude enters or exits a worktree that Claude Code created with git, the transcript follows" ([worktrees](https://code.claude.com/docs/en/worktrees)).
- **Run, 2.1.212 and 2.1.325 (S1, S2).** `claude --continue "/probe continue-argument"` reopened the last session of the directory, kept its name without `-n`, and ran the skill on top of the whole conversation, the same way as `--resume <id>`.
- So from the workspace root, `--continue` reopens whichever plain session ran there last: a To spec, a Chart a map, a Run skill…, or one started by hand. It names no session, so it cannot carry "this map's spec session".

### What a resume restores, and what it doesn't

- **Read** ([sessions](https://code.claude.com/docs/en/sessions)). Restored: the conversation (after a compaction, the summary and what followed), the model, the permission mode except bypass, the name. Not restored, "pass … again": `--plugin-dir`, `--mcp-config`, `--add-dir`, `--settings`, `--fallback-model`. Bypass is not restored either ([#124 Claude Code's bypass-permissions contract](https://github.com/dbarjs/hero-synergy/issues/124)).
- **Run, 2.1.212 and 2.1.325 (S6).** `-n` together with `--resume` renames: a session started as `#7 Spec probe` and resumed with `-n "#8 Renamed on resume"` was listed under the new name. This settles the register's row "`-n` together with `--resume` … **unverified** below 2.1.289".
- **Run.** On exit, 2.1.212 prints `claude --resume "#7 Spec probe"` (by name) and 2.1.325 prints `claude --resume <session-id>`.

### A session that is still open

- **Run, 2.1.212 and 2.1.325 (S6).** With the first session open and idle in one terminal, `claude --resume <its id> -n "#8 Renamed on resume" "/probe live-argument"` in a second terminal was neither refused nor warned about. It loaded the conversation and ran the skill. `claude agents --json` then listed **two** `interactive` entries with the **same** `sessionId` and different names, and both processes wrote to one transcript file.
- **Read.** "If you resume the same session in two terminals or two `claude -p` runs at the same time, both write to one transcript. When you resume that session later, messages from one of them can be missing. To keep both conversations, add `--fork-session` to each `claude` command" (sessions).
- The refusal and hand-over the docs describe ("Resume a running background session", 2.1.285) covers background sessions only, which the Cockpit never starts.

### What else carries the context

| Route                                             | What it gives                                                                                                                                                                                                                                            | Source                                          |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Type `/to-tickets` in the session that is open    | The same context window, nothing reloaded. Upstream's own way                                                                                                                                                                                            | read (`ask-matt`)                               |
| `claude --resume <id> "/to-tickets <spec>"`       | The conversation reloaded from its transcript, the skill on top                                                                                                                                                                                          | run, both versions                              |
| `claude --resume "<name>" "/to-tickets <spec>"`   | The same, when exactly one session has that name; an ambiguous name opens the picker                                                                                                                                                                     | read (sessions); the prompt with a name not run |
| `claude --continue "/to-tickets <spec>"`          | The last session of the directory, whichever it was                                                                                                                                                                                                      | run, both versions                              |
| `--fork-session` with `--resume` or `--continue`  | A copy of the conversation under a new session id; the original untouched                                                                                                                                                                                | read (sessions)                                 |
| A fresh session on `/to-tickets <spec reference>` | No shared context. The skill fetches the spec ("fetch it and read its full body and comments"); upstream warns that a very large spec comes back truncated and says "Run them in the same context window and the agent never has to fetch the spec back" | read (`to-tickets/SKILL.md`, its docs page)     |

### What the Cockpit has to know to resume

- **Read** ([`packages/core/src/claude/actions.ts`](https://github.com/dbarjs/hero-synergy/blob/main/packages/core/src/claude/actions.ts)). To spec is `claude "/to-spec <map>"` in a plain terminal: no `-n`, no `--plugin-dir`, no `HERO_SYNERGY_*`. The Cockpit learns a session id from the status plugin's `SessionStart` event, which that launch doesn't load. While the session lives, its `sessionId` is in the registry, under a default display name that names no map; once it ends, nothing recorded it.
- So a To tickets Action that resumes needs the To spec session launched like a ticket session (a name, the plugin, the env), or a name to resume by.

## 2. Worktrees and branches

### `/implement`

- **Read** ([`implement/SKILL.md`](https://github.com/mattpocock/skills/blob/v1.3.2/skills/engineering/implement/SKILL.md)). "Commit your work to the current branch." Its [docs page](https://github.com/mattpocock/skills/blob/v1.3.2/docs/engineering/implement.md): "`implement` commits to the branch you are on. It does not create one, and it does not ask"; "Can it open a pull request instead of committing? Not built in"; "`implement` has no completion step. It ends at the commit and never touches the work item … Close the ticket and reconcile the criteria yourself".
- **Read** (worktrees). `-w <name>` creates `.claude/worktrees/<name>/` "at your repository root, on a new branch named `worktree-<name>`", branched from "the repository's default branch on the remote" (`worktree.baseRef: "fresh"`, the default; `-w` is 2.1.49, `baseRef` 2.1.133).
- **Run, 2.1.212 and 2.1.325 (S3b, S5).** In a session started with `-w 42`, `pwd` printed `<repo>/.claude/worktrees/42` and `git branch --show-current` printed `worktree-42`, at `origin/main`.
- So under `-w <number>`, `/implement` commits to `worktree-<number>`.

**How a pull request comes out of it.** Not from the skill. The branch exists only locally until something runs `git push` and `gh pr create`: the session, when the repo's instructions or the launch's own words tell it to, or the developer. `/pr` only shapes the body ("It's model-invoked, so the agent reaches for it whenever it writes a PR", `ask-matt`). On exit, a named `-w` session asks keep or remove, and "Removing deletes the worktree directory and its branch, along with all the work in them" (worktrees, read): a commit that was never pushed dies with a Remove.

### A second session on the same build ticket

**Read** (worktrees, "Reuse a worktree name"). An existing name is reopened. With the `"fresh"` base it is first reset to the default branch when all of these hold: the sandbox isn't restricting writes, the worktree has no uncommitted or untracked files, it is still on the branch Claude Code made for it, and "It has no commits of its own, or its pull request or merge request was merged and its remote branch deleted". "Claude Code detects the merged case from git state alone". Before 2.1.208 a reused name always reopened at its old tip.

**Run, 2.1.212 and 2.1.325, the same result on both (S5).** A first `-w 42` session, then the state below, then one more commit on `origin/main`, then a second `-w 42` session that printed its log and status:

| What the first session left                                                                  | What the second session started on                                                 |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Nothing committed, a clean tree                                                              | **Reset**: `worktree-42` at the new `origin/main`                                  |
| A commit on `worktree-42`, not pushed                                                        | The old tip, without the new `origin/main` commit                                  |
| A commit, pushed (an open pull request)                                                      | The old tip                                                                        |
| Merged with a merge commit, the remote branch deleted, the clone's `origin/worktree-42` gone | **Reset** to the new `origin/main`                                                 |
| Squash-merged, the remote branch deleted, the clone's `origin/worktree-42` gone              | **Reset** to the new `origin/main`; the original commit is no longer on the branch |
| Merged, the remote branch kept                                                               | The old tip, behind `main`                                                         |
| Merged, the branch deleted on the remote only (no `git fetch --prune` in the clone)          | The old tip, behind `main`                                                         |
| The worktree switched to another branch, with a commit there                                 | That other branch at its tip; `worktree-42` untouched at its base                  |
| An untracked file                                                                            | The old tip, the file still there                                                  |

Two things the docs don't say and the runs show: a squash merge counts as merged, and "its remote branch deleted" is read from the clone's own remote-tracking ref, so a branch GitHub deleted after the merge still counts as present until the clone prunes it.

A reset never drops unmerged work: it happens only where nothing was left to lose. What it changes is the starting point. A second session on a build ticket whose pull request merged starts from `main` only when the remote branch was deleted and pruned; otherwise it starts from the pre-merge tip. This repository keeps its `origin/worktree-<n>` branches after a merge, so here a reused number always reopens the old tip.

### `/implement-spec`

**Read** ([`implement-spec/SKILL.md`](https://github.com/mattpocock/skills/blob/v1.3.2/skills/engineering/implement-spec/SKILL.md)). "The goal is the entire spec implemented on a single **integration branch**". Step 3: "Create the integration branch. If the issue tracker closes work through PRs, or the user asks for one, open a draft PR after the first merge". Step 4: implementer subagents work "each in its own worktree on its own branch", and each one "confirms its worktree is based on the integration branch before starting, and resets onto it if not" and "merges the integration branch tip into its own branch before reporting done". Step 5: a merger subagent merges each finished branch. Step 9: "Clean up all **implementer subagent** worktrees." Its [docs page](https://github.com/mattpocock/skills/blob/v1.3.2/docs/engineering/implement-spec.md) lists as a prerequisite "A harness that runs subagents in the background and gives each one a git worktree".

**Read** (Claude Code). The Agent tool takes `isolation: "worktree"`, which "creates a temporary git worktree so the agent works on an isolated copy of the repo" (the tool's own schema, from the request 2.1.325 sent; the parameter is 2.1.49). The worktree is "branched by default from your default branch rather than the parent session's `HEAD`" and "automatically cleaned up if the subagent makes no changes" (subagents). With `worktree.baseRef: "head"` it branches from local `HEAD`, and "Inside a worktree, `"head"` resolves to that worktree's `HEAD`, not the main checkout's" (worktrees; fixed in 2.1.154).

**Run (S3).** The scripted "model" called `Agent` with `isolation: "worktree"`, and the subagent printed where it was:

| Session                                                                                                           | Subagent's worktree                                | Its branch                 | Based on                                              | Versions         |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------- | ----------------------------------------------------- | ---------------- |
| No `-w`, in the main checkout, on a local `integration` branch one unpushed commit ahead                          | `<repo>/.claude/worktrees/agent-<17 hex>`          | `worktree-agent-<same id>` | `origin/main`, **without** the `integration` commit   | 2.1.212, 2.1.325 |
| `-w 42`; the session made `spec-7-integration` inside its worktree and committed there                            | `<repo>/.claude/worktrees/agent-<id>`, beside `42` | `worktree-agent-<id>`      | `origin/main`, **without** the integration commit     | 2.1.212, 2.1.325 |
| `-w 42`, the same, with `{"worktree": {"baseRef": "head"}}` committed in the repository's `.claude/settings.json` | `<repo>/.claude/worktrees/agent-<id>`, beside `42` | `worktree-agent-<id>`      | the session's `HEAD`, **with** the integration commit | 2.1.325          |

What follows from the runs:

- **Where.** Subagent worktrees are always under the repository root's `.claude/worktrees/`, siblings of the session's own worktree, never nested inside it.
- **Which base.** By default every implementer starts from `origin`'s default branch, not from the integration branch. The skill's "resets onto it if not" is the step that covers this; the integration branch is a local branch of the same repository, so every worktree can reach it.
- **What the orchestrator is told.** A foreground subagent's result ends with `worktreePath:` and `worktreeBranch:` lines; a background subagent's completion notification carries `<worktree><worktreePath>…</worktreePath><worktreeBranch>…</worktreeBranch></worktree>` (run, both versions; the notification fields are changelog 2.1.72).
- **Cleanup.** A subagent's worktree is locked while it runs. One that finished with no change was removed with its branch. One left with a commit or an untracked file stayed on disk, unlocked, with its branch, after the session ended (run, both versions). Step 9 of the skill is what removes those.
- **Under `-w <n>`.** After the session made its integration branch, worktree `<n>` was on that branch and `worktree-<n>` sat at its base with no commit of its own (run). On exit that is the docs' "Another branch is checked out" case: the session asks keep or remove, "Either answer keeps that other branch and its commits. Removing deletes the worktree directory and the worktree's own branch" (read). A later `-w <n>` reopens the worktree on the integration branch at its tip (run, S5).
- **Without `-w`.** The session runs in the directory it was launched from, so "Create the integration branch" switches the branch of that checkout (read; this follows from the skill and from where a session without `-w` runs).
- **Isolation.** A `-w` session cannot edit a file in the main checkout, run a command there or point git at it, and "The same enforcement covers every subagent Claude spawns from the isolated session" (worktrees, read).

### A local tracker under `-w`

**Read.** "A worktree holds only what git tracks" (upstream's `implement-spec` page), and a local tracker's `.scratch/` is gitignored, which is why Work ticket passes no `-w` on a local tracker (`actions.ts`). The isolation checks block "an `Edit`, `Write`, or `NotebookEdit` that targets a path in the main checkout" (worktrees). So an `/implement` session under `-w` on a local tracker could neither find the ticket file in its worktree nor change the one in the main checkout. `.worktreeinclude` would copy gitignored files into a new worktree, which makes a second copy of the tracker, not a view of it. Not run.

## 3. What the registry reports

### A session running `/implement-spec`

**Read.** "Subagents and teammates a session spawns aren't listed as separate rows" ([agent view](https://code.claude.com/docs/en/agent-view)); in `--json` "Each entry describes one session". "With nothing configured, a subagent that Claude spawns from your main conversation starts in the background" (subagents; changelog 2.1.198 "Subagents now run in the background by default"). "When a background subagent reaches a tool call that needs permission, Claude Code surfaces the prompt in your main session and names the subagent that is asking" (subagents).

**Run, 2.1.212 and 2.1.325, the same on both (S4).** A session named `#7 Spec probe` launched two background subagents with `isolation: "worktree"` and ended its own turn; each subagent ran for 24 seconds.

- `claude agents --json` listed **one** entry for the whole run: `kind: "interactive"`, `name: "#7 Spec probe"`, `cwd` the session's own directory. No entry appeared for a subagent, and no field of the parent's entry counts or names them. The raw `sessions/<pid>.json` file holds nothing more about them.
- `status` was `busy` from the launch until both subagents had finished and the turn that follows the last completion notice had ended, then `idle`. That includes the stretch after the session's own turn was over, while its screen read "Waiting for 2 background agents to finish".
- When a background subagent ran a command that needed a permission, the entry read `status: "waiting"`, `waitingFor: "permission prompt"`. The prompt in the terminal was headed "Bash command · from the general-purpose agent". After the approval the entry was `busy` again, then `idle`.

**Seen in a logged-in session, 2.1.325.** The session that spawned this research had one entry, `interactive`, `busy`, with its own `cwd`, while background subagents ran. The repository held six `.claude/worktrees/agent-*` worktrees at that moment and none was listed.

**Under which names.** A subagent has no registry name. Inside the session it shows by agent type and by the `description` the model gave the Agent call ("general-purpose implementer A"). Outside, its only traces are the directory `.claude/worktrees/agent-<id>` and the branch `worktree-agent-<id>`, neither of which names a ticket.

**What else could report them** (read, not run). The hooks `SubagentStart` (2.0.43) and `SubagentStop` (1.0.41) fire per subagent with `session_id`, `agent_id` and `agent_type` ([hooks](https://code.claude.com/docs/en/hooks#subagentstart)). Neither payload names a ticket. Before 2.1.311 `SubagentStop` ran "about twice a minute for each running subagent instead of once when it finishes" (changelog). The status plugin hooks neither today.

### `/to-spec`, `/to-tickets` and `/implement`

Nothing in the registry tells these from a decision ticket's session: the same fields, the same three `status` values (run for the plain shape, both versions: `interactive`, the `-n` name, `idle` between turns). What differs comes from how each is launched and what each skill does:

- **The name.** To spec is launched with no `-n` (`actions.ts`), so its entry carries a default display name: "The default combines the working directory's name with a two-character suffix" (sessions, read; 2.1.196). It ties the entry to no map.
- **`cwd`.** A session without `-w` reports the workspace root; a `-w` session reports its worktree.
- **Stops for the developer.** `/to-spec` says "Check with the user that these seams match their expectations" and `/to-tickets` says "Iterate until the user approves the breakdown" (read). A question asked as plain text ends the turn, so the entry reads `idle`; one asked through a question tool reads `waiting` with `input needed` (the values are from the register; which one a real session produces was not run).
- **`/implement`** calls `code-review`, which at 1.3.2 "runs both sub-agents in the foreground" (upstream changelog, read). By the runs above that shows as `busy` on the one entry.

## 4. What each skill takes

**Read**, at `v1.3.2`. All four carry `disable-model-invocation: true`, so only a typed command or a prompt that starts with the command runs them ("no other skill can call it either", `implement`'s page). None has `argument-hint`, `arguments`, or a `$ARGUMENTS` placeholder in its text.

**Read** (skills) and **run** (2.1.212 and 2.1.325, S1 and S2). "If you invoke a skill with arguments but no placeholder in the skill's content receives one, Claude Code appends `ARGUMENTS: <your input>` to the end of the skill content". The runs show exactly that, as in the request quoted in section 1. So whatever follows the command reaches the model as one line of text, and the skill's prose decides what it means.

| Skill             | What `SKILL.md` says                                                                                                                                                                            | What upstream's page shows                                                                                                                                                         | On GitHub                                                             | On a local tracker                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/to-spec`        | "This skill takes the current conversation context and codebase understanding and produces a spec." It names no argument                                                                        | For "A wayfinder map has cleared" its table says `/to-spec #<map_issue>`; "Give it the main map issue … not the individual decision tickets"                                       | The map's number or URL                                               | Nothing stated for `/to-spec`; by `/wayfinder`'s rule a map is the path `.scratch/<effort>/map.md`       |
| `/to-tickets`     | "Work from whatever is already in the conversation context. If the user passes a reference (a spec path, an issue number or URL) as an argument, fetch it and read its full body and comments." | "`/to-tickets`, or `/to-tickets #<spec_issue>`"                                                                                                                                    | The spec's number or URL, or nothing in the session that wrote it     | The spec's path, `.scratch/<feature-slug>/spec.md`, or nothing                                           |
| `/implement`      | "If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask."                                               | "`/implement #42`"; "passing the issue URL or `owner/repo#2` removes the ambiguity entirely"; "The `NN` prefix is a real ticket ID, so `/implement 03` works" (`to-tickets`' page) | The ticket's URL (a bare `#2` was once resolved against another list) | The ticket's path, `.scratch/<feature-slug>/issues/<NN>-<slug>.md`; a bare `NN` repeats in every feature |
| `/implement-spec` | "You have been provided a spec. This spec should have tickets associated with it"                                                                                                               | "To start a run, clear the context and type `/implement-spec` with a pointer to the spec (an issue number or a file path)"                                                         | The spec's number or URL                                              | The spec's path                                                                                          |

How a reference is fetched is the tracker doc's business (read, the templates): on GitHub "Read it as in **Read an issue**" (`gh issue view <number> --json …`), and "a bare `#42` may be either" an issue or a pull request; on a local tracker "Read the file at the referenced path. The user will normally pass the path or the issue number directly."

What each one writes, as far as the Cockpit's reading goes (read):

- `/to-spec` publishes the spec and applies `ready-for-agent` to it ("Apply the `ready-for-agent` triage label"). On a local tracker the spec is `.scratch/<feature-slug>/spec.md`.
- `/to-tickets` publishes one issue per ticket, "If the source was an existing issue, make each ticket its sub-issue", with native blocking edges, and applies `ready-for-agent`; locally one file per ticket with `**Status:** ready-for-agent`. "Do NOT close or modify any parent issue."
- `/implement` commits and stops: it does not close the ticket or tick its criteria.
- `/implement-spec` ends with "resolve each ticket the way the issue tracker closes work", or with a draft pull request "marked as closing the spec and tickets" turned ready for review.

## Only a real run settles

A scripted reply can make the harness create a worktree; it cannot say what a model does with a skill's text. These need one real `/implement-spec` run, on a spec with at least two unblocked tickets, under `-w` and without:

- Whether the orchestrator spawns implementers with the Agent tool's `isolation: "worktree"` (the path measured here) or runs `git worktree add` itself. In the second case the paths and branch names are its own choice, none of section 2's table applies, and under `-w` the isolation checks decide whether it can work in them at all.
- What it names the integration branch, and whether it creates it in the session's own directory.
- Whether implementers actually run in the background, and how many at once.
- Where the merger subagent runs, and whether merges are fast-forwards as the skill intends.
- Whether it opens the draft pull request on GitHub, what it closes and when. Upstream's page says the tracker's blocked-by count is stale during a run, because tickets close at the end.
- What the developer is asked at exit when the `-w` worktree sits on the integration branch.

And one real `/to-spec` then `/to-tickets`:

- Whether `/to-tickets`, run through `--resume`, skips fetching the spec because it is already in the conversation.
- Whether each skill asks its questions as plain text (`idle`) or through a question tool (`waiting`, `input needed`).

## Seen on the way

Not asked by the ticket; each touches a row of the upstream register.

- **The trust dialog's preselected answer changed.** On 2.1.212 the dialog reads "❯ 1. Yes, I trust this folder / 2. No, exit". On 2.1.325 it reads "❯ No, exit / Yes, I trust this folder", so Enter exits (run; the scratch repositories carried a `.claude/skills` folder, and no changelog entry names the change).
- **An interactive entry can lack `status` at first.** On 2.1.325 the first poll after the trust dialog returned the entry with `pid`, `cwd`, `kind`, `startedAt`, `sessionId` and `name` and no `status`; the next poll, two seconds later, had it (run, two launches). Not seen on 2.1.212.
- **The positional slash command is dated**: changelog 2.1.0, and run on 2.1.212 and 2.1.325. The register lists it as "undated (**unverified**)".

## Not verified

- **No real `/implement-spec`, `/to-spec`, `/to-tickets` or `/implement` ran.** Everything about them is their text at `v1.3.2`. The list under [Only a real run settles](#only-a-real-run-settles) is open.
- **No run reached a model.** Replies were scripted. Anything that depends on a model's choice is unmeasured.
- **No login and no feature flags in the scratch runs.** Gated behaviour ran on built-in defaults. The one logged-in observation (the registry around this research's own parent session) agrees with the scratch runs, and covers nothing else.
- **2.1.292**, the register's tested ceiling, was not run. Only 2.1.212 and 2.1.325.
- **Reuse of a worktree name was run in print mode only** (`-p -w 42`), where a finished session leaves its worktree locked. An interactive `-w` session that exits with "keep" was not run, and neither was the docs' sandbox condition.
- **`worktree.baseRef: "head"`** was run on 2.1.325 only.
- **`--resume "<name>"` with a prompt**, and `--fork-session`, were read, not run.
- **Resuming a `-w` session with a new slash command** was read ("Claude Code returns the session to that worktree"), not run.
- **A resume after a compaction, or of a transcript older than the 30-day retention**, was read, not run.
- **The exit prompt of a `-w` session whose worktree is on another branch** was read, not run.
- **A local tracker under `-w`** was reasoned from the docs' isolation rules, not run.
- **Worktrees made by hand with `git worktree add` inside a `-w` session**: whether the isolation checks let a subagent edit there was not run.
- **`SubagentStart` and `SubagentStop`** were read, not run.
- **How a resumed session's prompt cache behaves**, and so what the second command costs, was not measured.
- **linux-arm64 only.** No macOS or Windows binary was run.
