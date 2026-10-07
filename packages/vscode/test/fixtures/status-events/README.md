# Status event recordings

Recordings of real Claude Code sessions, ported from the prototype on the `prototype/status-hooks` branch ([#6](https://github.com/dbarjs/hero-synergy/issues/6)). They pin the line shape the status plugin writes and the Cockpit decodes.

- `<run>.payloads.jsonl`: the probe plugin's records for the three events the status plugin hooks (`SessionStart`, `SessionEnd`, `StopFailure`), as recorded: `at` is the fire time in epoch milliseconds, `input` is the whole hook payload Claude Code put on stdin.
- `<run>.events.jsonl`: what `claude-plugin/report.mjs` appends for those payloads with `HERO_SYNERGY_TICKET=6`, each line's `at` set to the recorded fire time as an ISO string. The test in `test/status-plugin/report.test.ts` re-runs the report on the payloads and checks it still writes these lines.

Recorded with Claude Code 2.1.287 on Linux, Node 24.20, in a scratch repository. The runs:

| Run               | What it did                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `a-headless`      | `claude -p`, one prompt                                                                    |
| `b-interactive`   | approvals, `AskUserQuestion`, background work, `/compact`, 75 s idle, `/clear`, `/exit`    |
| `c-resume`        | `--resume <session id>`, one prompt, then the terminal closed while idle                   |
| `d-hup-working`   | terminal closed in the middle of a turn                                                    |
| `e-sigkill`       | `kill -9` while idle: no `SessionEnd` ever came                                            |
| `f-stopfailure3`  | `claude -p` with a model that doesn't exist: `StopFailure` with `error: "model_not_found"` |
| `g-auto-worktree` | `-w` and `-n`, approvals, `AskUserQuestion`, `/exit` with uncommitted files                |
| `h-auto`          | auto mode: auto-approved Bash, `AskUserQuestion`                                           |
| `i-interrupt`     | Esc in the middle of a streamed reply, then 75 s of waiting                                |

The other three events the prototype hooked (`UserPromptSubmit`, `Notification`, `Stop`) were dropped in [#28](https://github.com/dbarjs/hero-synergy/issues/28); the registry reports live status instead. Their records are not ported.
