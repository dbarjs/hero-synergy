# PROTOTYPE: do the status hooks report a session's state reliably?

Throwaway work for [Do the status hooks report a session's state reliably?](https://github.com/dbarjs/hero-synergy/issues/6). Nothing here is meant to be merged.

## What was built

- `packages/vscode/claude-plugin/`: the status plugin, copied verbatim from the seed's Appendix A.7 (six hooks, `async: true`, one line per event appended to `HERO_SYNERGY_EVENTS`).
- `prototype/status-hooks/probe-plugin/`: a second plugin that records every hook event with its whole input into `HERO_SYNERGY_PROBE`. It is the ground truth the status plugin is compared against.
- `cc.sh` launches `claude` with both plugins through `--plugin-dir` and the environment variables set. `t.sh` drives interactive sessions through tmux. `lag.mjs` measures the delay between a hook firing and its line being written. All three have the scratch paths of the session that ran them baked in.
- `runs/`: the events file and the probe file of each scenario.

## How it was run

Claude Code 2.1.287 in the Linux devcontainer, Node 24.20. Real sessions in a scratch git repository that has its own `UserPromptSubmit` and `Stop` hooks in `.claude/settings.json`. Interactive sessions ran in tmux with Haiku 4.5 (Sonnet for the auto mode run). Remote control and push notifications were switched off for the test sessions. Nothing was tested on Windows or macOS.

| Run | What it did |
| --- | --- |
| `a-headless` | `claude -p`, one prompt |
| `b-interactive` | approval prompt (slow and fast answer), `AskUserQuestion`, background subagent, background shell, Esc at an approval prompt, `/compact`, 75 s idle, `/clear`, `/exit` |
| `c-resume` | `--resume <session id>`, one prompt, then the terminal closed while idle |
| `d-hup-working` | terminal closed in the middle of a turn |
| `e-sigkill` | `kill -9` while idle |
| `f-stopfailure3` | `claude -p` with a model that doesn't exist |
| `g-auto-worktree` | `-w` and `-n`, approval prompt, `AskUserQuestion`, `/exit` with uncommitted files |
| `h-auto` | auto mode: auto-approved Bash, `AskUserQuestion` |
| `i-interrupt` | Esc in the middle of a streamed reply, then 75 s of waiting |
| `s-stress-*` | 20 failing headless sessions, five at a time, with every core busy |

## What works

- **The plugin loads with `--plugin-dir`** and needs no install step. Two `--plugin-dir` flags load two plugins.
- **Plugin hooks merge with the repo's own hooks.** The scratch repo's `UserPromptSubmit` and `Stop` hooks ran on every turn beside both plugins.
- **Hooks inherit the session's environment**, in the repo root and in a `-w` worktree.
- **`async: true` doesn't hold the session up.** The repo's `Stop` hook sleeps for one second; the status line was written at once. Async hooks also outlive the session: the `SessionEnd` line was written after `/exit`, after a headless run, and after the terminal was closed.
- **The six events fire on the happy path** in the order the seed's table expects.
- **A resumed session keeps its session id.**

## Where the six-row table lies

| Status in the seed | What happened |
| --- | --- |
| started (`SessionStart`) | Right for `startup` and `resume`. It also fires after `/compact` (`compact`) and after `/clear` (`clear`), in the middle of a session's life. Nothing fires while the workspace trust dialog is open. |
| working (`UserPromptSubmit`) | Right, and it also fires when a background agent or shell finishes and wakes the session. Nothing says "working" again after an approval or an answered question. |
| waiting for you (`Stop`) | Right at the end of a normal turn. It also fires while a background agent is still running (the hook input lists it in `background_tasks`). **It never fires after Esc**: the status stays "working" for good, and no `idle_prompt` follows either. |
| needs approval (`Notification`, `permission_prompt`) | Arrives 6.0 to 6.1 seconds after the prompt appears, five times out of five. Answered sooner, it never arrives. It fires the same way for `AskUserQuestion`, in manual and in auto mode, so a question reads as "needs approval". It fires for a subagent's prompt without naming the subagent. Nothing reports that the approval was given, so the status stays until `Stop`. |
| failed (`StopFailure`) | Fires. The reason is in `error` (`model_not_found`), which `report.mjs` doesn't read, so `detail` is `null`. A hook on `StopFailure` without `async: true` exited with status 1 before running in a headless session. Only one failure type was provoked. |
| ended (`SessionEnd`) | Fires on `/exit` (`prompt_input_exit`), on `/clear` (`clear`, followed by a `SessionStart` with a new session id), at the end of a headless run (`other`), and when the terminal is closed, idle or working (`other`). It doesn't fire on `kill -9`. With `-w` and uncommitted files, `/exit` first shows a keep-or-remove dialog that no hook reports. |

Other things seen:

- `PermissionRequest` fires the moment a prompt appears and carries `tool_name`, so it tells an approval from a question. `PostToolUse` fires when the tool has run.
- `Notification` with `idle_prompt` fires 60 seconds after a `Stop`.
- A `SubagentStop` with an empty `agent_type` follows every `Stop` by a few seconds (the prompt suggestion). Anything mapped onto `SubagentStop` must skip it.
- After Esc the transcript holds `[Request interrupted by user]`; no hook reports it.

## Ordering with `async: true`

- Each hook is its own `node` process and stamps `at` when it writes, not when the event fired.
- Unloaded, a line lands 20 to 247 ms after its hook fires (median 44 ms, 59 events), and all 63 events of the scenario runs were written in the order they fired.
- With every core busy, 4 of 20 failing headless sessions wrote `SessionEnd` before `StopFailure`. The two fire about 100 ms apart. Sorting by `at` doesn't repair it.

So the last line of the file isn't always the latest state. A reader has to treat `SessionEnd` as final for its session id rather than trust line order.

## Proposal to react to

Not decided; this is what the runs suggest.

| Status | Source |
| --- | --- |
| started | `SessionStart` with `startup` or `resume` only |
| working | `UserPromptSubmit`; `PostToolUse` and `PostToolUseFailure` after an approval or an answer |
| waiting for you | `Stop` with no running `background_tasks`; `PermissionRequest` for `AskUserQuestion` |
| needs approval | `PermissionRequest` for any other tool |
| failed | `StopFailure`, with `error` as the detail |
| ended | the terminal closing, with `SessionEnd` as a hint |

Still open after that: Esc has no hook at all.
