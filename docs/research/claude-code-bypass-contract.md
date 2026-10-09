# Claude Code's bypass-permissions contract

Research for [#124](https://github.com/dbarjs/hero-synergy/issues/124), on map [#123](https://github.com/dbarjs/hero-synergy/issues/123). Read on 2026-10-09 against the Claude Code [changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) (newest entry 2.1.295), the docs at `code.claude.com/docs` ([permission modes](https://code.claude.com/docs/en/permission-modes), [settings reference](https://code.claude.com/docs/en/settings-reference), [sessions](https://code.claude.com/docs/en/sessions), [agent view](https://code.claude.com/docs/en/agent-view), [CLI reference](https://code.claude.com/docs/en/cli-reference), [dev container](https://code.claude.com/docs/en/devcontainer), [sandbox environments](https://code.claude.com/docs/en/sandbox-environments)) and `claude --help` on 2.1.292.

**How it was measured.** This devcontainer runs as `vscode`, **uid 1000, not root** (`id -u`). I ran three binaries: 2.1.292 (installed), 2.1.289 (the tested ceiling in `docs/upstream.md`, still installed) and 2.1.212 (the floor, the linux-arm64 build downloaded from npm `@anthropic-ai/claude-code-linux-arm64`). Every run used a scratch `CLAUDE_CONFIG_DIR` under the session scratchpad and a scratch working directory, with a clean environment (`env -i`), never `~/.claude`. The scratch config had no login, so `-p` runs end with `Not logged in` after the `system/init` message, which is where `permissionMode` is read. Interactive runs went through a Python pty harness that reads the screen and sends keys. The root runs used `sudo env -i …` with the same scratch config. I also read the bundled JavaScript of 2.1.212 and 2.1.292 for the root check, the dialog and the settings it reads.

The developer's own `~/.claude/settings.json` in this container already sets `permissions.defaultMode: "bypassPermissions"` and `skipDangerousModePermissionPrompt: true`, so a session started here without a flag already bypasses, and never shows the dialog. That is why every measurement below used a scratch config.

## Answers

### 1. `--dangerously-skip-permissions` and `--permission-mode bypassPermissions` are equivalent

- The docs say so in one line: "The `--dangerously-skip-permissions` flag is equivalent" ([permission modes, Skip all checks](https://code.claude.com/docs/en/permission-modes#skip-all-checks-with-bypasspermissions-mode)). The agent view docs call the flag "shorthand for `--permission-mode bypassPermissions`".
- **Measured** on 2.1.212, 2.1.289 and 2.1.292: `claude -p --output-format stream-json --verbose` reports `"permissionMode":"bypassPermissions"` in `system/init` for either flag. Both trigger the same root check, the same dialog and the same `disableBypassPermissionsMode` downgrade (below).
- **Since**: both are older than the floor. `--dangerously-skip-permissions` is in changelog 1.0.7 ("sometimes didn't work in `--print` mode"). The changelog never announces `--permission-mode`; its first mention is a fix in 2.1.132. Both exist, and behave the same, on 2.1.212.
- The flag the Cockpit sends, `--permission-mode bypassPermissions`, is fine. One cosmetic difference: the root refusal names `--dangerously-skip-permissions` even when you passed `--permission-mode bypassPermissions`.
- Not the same: `--allow-dangerously-skip-permissions` only adds bypass to the Shift+Tab cycle without starting in it (`--help`; permission modes). It still triggers the root check (measured).
- `--restricted` (2.1.248+) refuses `bypassPermissions` (changelog 2.1.248; `--help`). The Cockpit doesn't pass it.

### 2. The one-time confirmation dialog

- **It exists, interactive only.** The first interactive start in bypass shows "WARNING: Claude Code running in Bypass Permissions mode … By proceeding, you accept all responsibility for actions taken while running in Bypass Permissions mode", with `❯ No, exit` preselected and `Yes, I accept` below it (**measured**, 2.1.292). It comes **after** the workspace trust dialog in a folder that isn't trusted yet.
- **Decline exits.** In code, "No, exit" exits with status 1 and Esc with status 0 (2.1.292 bundle). Docs: "If you decline: Claude Code exits."
- **Where acceptance is stored**: `skipDangerousModePermissionPrompt: true` written to **user settings**, `$CLAUDE_CONFIG_DIR/settings.json` (by default `~/.claude/settings.json`). **Measured**: after accepting, the scratch config's `settings.json` held exactly `{"skipDangerousModePermissionPrompt": true}`, and the next interactive bypass start showed no dialog. The 2.1.212 bundle writes the same key to `userSettings` too.
- **Which files can skip it**: user, local (`.claude/settings.local.json`), `--settings` (flag) and managed settings. Project `.claude/settings.json` can't ("An untrusted repository can't skip the dialog for you", [settings reference](https://code.claude.com/docs/en/settings-reference#skipdangerousmodepermissionprompt)). The 2.1.212 and 2.1.292 bundles both read exactly those four sources.
- **`-w` or a fresh worktree doesn't re-trigger it** once it has been accepted in user settings: the check reads no per-directory state other than `localSettings`, and acceptance is written to user settings (read from code, **not measured with `-w`**). One caveat: if the acceptance lived only in a repo's `.claude/settings.local.json`, a fresh `-w` worktree wouldn't have that gitignored file, so the dialog would come back.
- **Non-interactive (`-p`) never shows it** (docs; measured: the scratch config with no acceptance started `-p` in `bypassPermissions` with no prompt). `claude --bg` in bypass is refused until the dialog has been accepted once interactively (agent view docs). 2.1.290 and 2.1.293 fixed background paths that skipped that consent.
- **The Cockpit's position**: it launches interactive sessions, so on a machine where nobody has accepted, the first AFK session sits on this dialog. The dialog's default answer exits. The map's "never accept it for you, never write `~/.claude`" rule means the developer accepts once by hand.

### 3. Root refusal

- **Yes.** On Linux and macOS, bypass refuses to start as root. It prints to stderr and **exits with status 1**:

  ```text
  --dangerously-skip-permissions cannot be used with root/sudo privileges for security reasons
  ```

  **Measured** with `sudo` on 2.1.212, 2.1.289 and 2.1.292, for `--permission-mode bypassPermissions`, `--dangerously-skip-permissions` and `--allow-dangerously-skip-permissions` alike.
- **The exact condition** (2.1.292 bundle; the 2.1.212 bundle has the same `getuid()===0 && IS_SANDBOX!=="1"` test): `process.getuid() === 0 && process.env.IS_SANDBOX !== "1" && !CLAUDE_CODE_BUBBLEWRAP`. So `IS_SANDBOX=1`, or a truthy `CLAUDE_CODE_BUBBLEWRAP`, lifts it. **Measured**: as root with `IS_SANDBOX=1`, `-p` started in `bypassPermissions` on 2.1.212 and 2.1.292.
- **The docs don't name either variable.** They say "The check is skipped automatically inside a recognized sandbox" and recommend running as a non-root user ([permission modes](https://code.claude.com/docs/en/permission-modes#skip-all-checks-with-bypasspermissions-mode), [dev container](https://code.claude.com/docs/en/devcontainer), [sandbox environments](https://code.claude.com/docs/en/sandbox-environments)). `IS_SANDBOX` is not in the [env vars](https://code.claude.com/docs/en/env-vars) page, so it is an undocumented, read-from-code contract.
- In an interactive terminal the Cockpit's launch would print the line and the terminal would end at once. The map already rules out setting `IS_SANDBOX`, so a root container gets the refusal. Detection could treat uid 0 as a reason to warn.

### 4. Resume doesn't keep bypass

- **The flag must be passed again.** [Sessions, Permission mode on resume](https://code.claude.com/docs/en/sessions#permission-mode-on-resume): a session that ended in `bypassPermissions`, resumed from a terminal, starts in "the permission mode a new session would start in. To bypass permissions again, enable it at launch with one of its launch flags or `permissions.defaultMode: "bypassPermissions"` in user, `--settings`, or managed settings". Other modes (plan, auto) are restored; bypass is deliberately not.
- **Measured** on 2.1.292 with a scratch config: a session started with `-n resume-probe --session-id … --dangerously-skip-permissions` came back in `⏵⏵ auto mode on` under both `--resume <id>` and `--resume resume-probe`. With `--resume resume-probe --permission-mode bypassPermissions` it came back in `⏵⏵ bypass permissions on`, with no dialog the second time.
- `-p --resume` starts in whatever a new `-p` run would (docs).
- **Consequence for `actions.ts`**: `resumeById` and `resumeByName` must carry the flag when the ticket qualifies, just as `workTicket` does. Otherwise a resumed AFK session silently runs in the built-in default (auto on 2.1.284+, Manual earlier).

### 5. `disableBypassPermissionsMode` and auto mode

- **`permissions.disableBypassPermissionsMode: "disable"` downgrades the session. It isn't refused.** The docs say Claude Code "rejects the `--dangerously-skip-permissions` flag" ([settings reference](https://code.claude.com/docs/en/settings-reference#permissions-disablebypasspermissionsmode)). In practice the session starts anyway, in the mode it would have had without the flag.
  - **Measured interactive** (2.1.292, via `--settings` with the key): the session starts in `⏵⏵ auto mode on` with the footer notice `Bypass permissions mode was disabled by settings`. No exit, no dialog.
  - **Measured `-p`**: `permissionMode` is `auto` on 2.1.292 and 2.1.289, and `default` on 2.1.212 (the built-in default changed in between). Nothing goes to stderr, so it is **silent**.
  - The key works from any settings file ("Scope: Any file"), managed settings being the usual one. 2.1.110 and 2.1.223 extended it to hook `setMode` and agent-definition `permissionMode`.
- **Project settings can't turn bypass on**: `defaultMode: "bypassPermissions"` in `.claude/settings.json` or `.claude/settings.local.json` is ignored since 2.1.257 (changelog; permission modes). Before 2.1.257 it applied. The launch flag isn't affected either way.
- **The auto mode classifier doesn't run in a bypassed session.** The launch flag wins over `defaultMode` and the built-in auto default ("Which mode a session starts in": the flag comes first). The classifier only reviews calls in `auto` mode. A few things still stop a bypassed session in every mode ([actions no mode auto-approves](https://code.claude.com/docs/en/permission-modes)):
  - explicit `ask` rules and `deny` rules, which block in every mode;
  - `AskUserQuestion` and MCP tools marked `requiresUserInteraction`;
  - `rm`/`rmdir` of a critical path, which since 2.1.281 shows a two-minute prompt and then denies the command, so an unattended session keeps going;
  - reads outside the working directories under `blockReadsOutsideWorkingDirectories`;
  - the cross-session messaging holds.
- The only "fallback to auto" bug on record is 2.1.196's fix of `claude agents --dangerously-skip-permissions` silently falling back to auto mode. It concerns `claude agents`, and 2.1.196 is below the floor anyway.

### 6. `claude agents --json` for a bypassed session

- **No permission mode is exposed.** The `--json` fields are `pid, cwd, kind, startedAt, sessionId, name, status` (+ `waitingFor`). **Measured**: an accepted bypass session named `bypass-probe` listed as `{"pid","cwd","kind":"interactive","startedAt","sessionId","name":"bypass-probe","status":"idle"}`. The raw `sessions/<pid>.json` file has no mode field either.
- **While the bypass dialog is open there is no registry entry at all.** **Measured**: `claude agents --json` printed `[]` with the dialog on screen, and the entry appeared once the dialog was accepted. That matches the trust dialog's behaviour recorded in `docs/upstream.md` ([#28]). So `waitingFor` never reports the bypass dialog, not even as `dialog open`. The Cockpit sees a terminal it launched with no `SessionStart` and no entry, its "starting" state from #28 point 13, for as long as the dialog waits.
- Once running, a bypassed session can still be `waiting`: `permission prompt` for a critical-path `rm` or an `ask` rule, and `input needed` for `AskUserQuestion`.

## Implications for #127 (the Actions ticket)

- Send `--permission-mode bypassPermissions`. It is equivalent, documented and floor-safe.
- Add it to the resume launches too (`resumeById`, `resumeByName`), not only to `workTicket`, because bypass is never restored on resume.
- The health warning can name two things the Cockpit can't fix: the one-time dialog (its preselected answer is "No, exit", and the session is invisible in `--json` while it waits) and root (exit 1, the terminal closes). A managed `disableBypassPermissionsMode` just quietly gives an auto/Manual session, which is safe.
- Rows for `docs/upstream.md`: the flag equivalence; `skipDangerousModePermissionPrompt` in user settings; the root check and its `IS_SANDBOX`/`CLAUDE_CODE_BUBBLEWRAP` escape (**undocumented**); bypass not restored on resume; `disableBypassPermissionsMode` downgrading instead of refusing; no registry entry while the bypass dialog is open.

## Gaps and uncertainty

- **`-w` with the dialog wasn't run.** The conclusion that a fresh worktree doesn't re-trigger it comes from the bundle (the sources it reads) and from where acceptance is written. The interactive runs were in a scratch directory that wasn't a git repo.
- **The scratch config had no login.** Mode resolution, the root check, the dialog and the registry entry all happen before any API call, and the `-p` `system/init` message and the interactive footer show the resolved mode. But no real tool call was run in bypass. Whether auto mode is "available" may depend on the account, so the downgraded mode under `disableBypassPermissionsMode` may be Manual instead of auto on accounts where auto isn't offered.
- **Interactive runs were on 2.1.292 only.** On 2.1.212 and 2.1.289 I measured the `-p` mode, the root refusal and the disable downgrade, and read the 2.1.212 code for the dialog's settings sources and where it stores acceptance. The 2.1.289 dialog wasn't run.
- **`IS_SANDBOX` and `CLAUDE_CODE_BUBBLEWRAP` are read from code, not docs.** They could change without a changelog entry. The map already rules out setting them.
- **When the dialog and the root check first appeared isn't dated** by the changelog. Both are present on the floor (2.1.212).
- **Docs vs. behaviour on `disableBypassPermissionsMode`**: the docs say "rejects"; the binaries downgrade (with a footer notice interactively, silently in `-p`).

[#28]: https://github.com/dbarjs/hero-synergy/issues/28
