# How do VS Code terminals and Claude Code hooks behave on Windows?

Research for [#11](https://github.com/dbarjs/hero-synergy/issues/11). Read on 2026-10-02 against Claude Code 2.1.287 (the newest changelog entry) and `microsoft/vscode` at `868a32d`.

This is a reading task done on Linux. Nothing here was run on Windows. Claims marked **documented** come from the vendor's docs or source; claims marked **inferred** are my reading of the source; everything else that matters is listed under [Needs a real Windows test](#needs-a-real-windows-test).

## Answer

What breaks or needs different handling when the Cockpit launches sessions and reads status events on Windows:

1. **The launch command in the seed is bash syntax.** No single command string quotes correctly in PowerShell, cmd and Git Bash, and `sendText` does no quoting for you. Launch `claude` as the terminal's process instead (`shellPath` plus a `shellArgs` array), so no shell parses the ticket title or the `/wayfinder …` prompt.
2. **`claude` is not always an `.exe`.** The native installer puts `claude.exe` in `%USERPROFILE%\.local\bin`. An npm install puts `claude.cmd` and `claude.ps1` shims on `PATH`. The shims go through `cmd.exe` or PowerShell's execution policy, and Node's `child_process` cannot spawn a `.cmd` without a shell, which affects the scout as well as sessions.
3. **Git Bash may rewrite the prompt.** MSYS converts arguments that look like Unix paths before it starts a native Windows program, and `/wayfinder <map-url> <ticket-url>` starts with a slash. Not verified; it disappears if no shell is involved (item 1).
4. **Environment variables are the easy part.** `TerminalOptions.env` sets `HERO_SYNERGY_TICKET` and `HERO_SYNERGY_EVENTS` on the process, independent of the shell, and hooks inherit the session's environment.
5. **Exec-form hooks are documented to work on Windows**, and `node` plus a script path is the pattern the docs recommend there. They need Claude Code 2.1.139 or later, and `node` must be on `PATH` as a real `node.exe`. One unanswered user report says exec-form arguments were still re-parsed by Git Bash, so this needs a test.
6. **`${CLAUDE_PLUGIN_ROOT}` resolves on Windows.** In exec form it is substituted as a plain string with the native path; in shell form Claude Code deliberately substitutes forward slashes.
7. **`--plugin-dir "<path>"` can leave the command line.** `CLAUDE_CODE_PLUGIN_DIRS` (2.1.280 or later, `;`-separated on Windows) loads the same plugin from the terminal's environment, which removes one quoted path.
8. **Do not rely on `SessionEnd` for "ended" on Windows.** Closing a VS Code terminal there terminates the process forcefully, so the hook probably never runs. Use `window.onDidCloseTerminal` as the source of truth for "ended" on every platform.
9. **Appending is the same; watching is weaker.** Node opens the file for append with all sharing modes on Windows, so concurrent hooks and the Cockpit's reader do not block each other. Watching goes through `ReadDirectoryChangesW`, events are coalesced and can be dropped, so treat each event as a hint and read from the last byte offset, with a slow poll as a backstop.
10. **WSL remote windows behave as Linux.** With `extensionKind: ["workspace"]` the extension, the terminal, `claude`, the hook's `node` and the file watcher all run inside WSL. Claude Code and Node must be installed inside the distribution, and WSL 1 is a poor target.

## How Claude Code runs on Windows

**Supported setups (documented).** Claude Code runs on Windows 10 1809 or later, natively or inside WSL. The supported shells are "Bash, Zsh, PowerShell, or CMD" ([setup: system requirements](https://code.claude.com/docs/en/setup#system-requirements)).

| Option | Requires | Notes |
| --- | --- | --- |
| Native Windows | Nothing; Git for Windows is optional | Sandboxing not supported |
| WSL 2 | WSL 2 enabled | Sandboxing supported |
| WSL 1 | WSL 1 enabled | Sandboxing not supported |

Source: [setup: Set up on Windows](https://code.claude.com/docs/en/setup#set-up-on-windows).

**Git Bash is no longer required (documented).** Since 2.1.120, "when absent, Claude Code uses PowerShell as the shell tool" ([changelog 2.1.120](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md), [What's new, week 18](https://code.claude.com/docs/en/whats-new/2026-w18)). Git Bash still matters for hooks: a shell-form hook runs through Git Bash when it is installed and through PowerShell when it is not ([hooks: exec form and shell form](https://code.claude.com/docs/en/hooks#exec-form-and-shell-form)).

**In WSL, Claude Code is a Linux install (documented).** "You install and launch `claude` inside the WSL terminal, not from PowerShell or CMD" ([setup](https://code.claude.com/docs/en/setup#set-up-on-windows)). On WSL 1 the native binary fails with `Exec format error`, tracked in [anthropics/claude-code#38788](https://github.com/anthropics/claude-code/issues/38788); the docs' fix is to convert the distribution to WSL 2 ([troubleshoot-install](https://code.claude.com/docs/en/troubleshoot-install#exec-format-error-on-wsl1)).

**What the `claude` command is (documented).**

- Native installer: `%USERPROFILE%\.local\bin\claude.exe` ([troubleshoot-install](https://code.claude.com/docs/en/troubleshoot-install#command-not-found-claude-after-installation)). That directory may be missing from `PATH` after install, which gives `'claude' is not recognized`.
- npm: the package "installs the same native binary", but the command on `PATH` is an npm launcher. PowerShell's execution policy can block `claude.ps1`; the docs' workaround is "Call the `.cmd` launcher instead" ([setup: install with npm](https://code.claude.com/docs/en/setup), [troubleshoot-install](https://code.claude.com/docs/en/troubleshoot-install#running-scripts-is-disabled-on-this-system)).
- An older Claude Desktop can register a `Claude.exe` in `WindowsApps` that wins on `PATH`, so `claude` opens the desktop app ([troubleshoot-install](https://code.claude.com/docs/en/troubleshoot-install#claude-desktop-overrides-the-claude-command-on-windows)).
- Auto-update renames `claude.exe` aside and moves the new one in; a failed update can leave no `claude.exe` ([troubleshoot-install](https://code.claude.com/docs/en/troubleshoot-install#claude-exe-missing-after-an-update-on-windows)).

**What that means for the extension.**

- The Cockpit should resolve `claude` once, prefer a real `.exe`, and show a clear message when it finds nothing or only a shim.
- The scout spawns `claude -p` as a child process. Node's docs say `.bat` and `.cmd` files "are not executable on their own without a terminal, and therefore cannot be launched using `child_process.execFile()`" ([Node child_process](https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows)). So with an npm install the scout needs a shell or the path of the underlying `claude.exe`.
- A user report says `claude.cmd` returned prose instead of the JSON envelope for a complex `--json-schema` call while `claude.exe` succeeded, with the same arguments ([anthropics/claude-code#82447](https://github.com/anthropics/claude-code/issues/82447), open, no maintainer reply). That is the scout's exact call shape.
- The scout example in the seed is a bash pipeline (`gh … | claude -p …` with `$VARS`). On Windows the extension has to do the piping itself through `child_process`, not through a shell string.

## How a VS Code terminal passes the command and the environment

### What the API gives you

`window.createTerminal(options)` takes `name`, `shellPath`, `shellArgs`, `cwd`, `env`, `iconPath`, `location` and more ([vscode.d.ts, `TerminalOptions`](https://github.com/microsoft/vscode/blob/868a32d35dc4f489c0bf682ae8967afeb740c66e/src/vscode-dts/vscode.d.ts#L12467)):

- `shellArgs?: string[] | string`: "A string can be used on Windows only which allows specifying shell args in command-line format."
- `env`: "Object with environment variables that will be added to the editor process." With `strictEnv` false (the default) the terminal's environment is the window's environment plus `terminal.integrated.env.windows` plus `env`.
- Without `shellPath` the terminal runs the user's default profile. That defaults to PowerShell on Windows and can be cmd, Git Bash, a WSL shell or anything else the user configured ([terminal profiles](https://code.visualstudio.com/docs/terminal/profiles)).

`Terminal.sendText(text)` writes to the shell's stdin: "The text is written to the stdin of the underlying pty process (shell) of the terminal" ([vscode.d.ts](https://github.com/microsoft/vscode/blob/868a32d35dc4f489c0bf682ae8967afeb740c66e/src/vscode-dts/vscode.d.ts#L7723-L7731)). The implementation only normalizes newlines to `\r` and appends one; it does no quoting ([terminalInstance.ts](https://github.com/microsoft/vscode/blob/868a32d35dc4f489c0bf682ae8967afeb740c66e/src/vs/workbench/contrib/terminal/browser/terminalInstance.ts#L1404-L1426)).

### Environment variables

`env` is applied to the process VS Code spawns, so it does not depend on which shell runs or how it quotes. Claude Code then passes it on: "A hook process inherits the parent environment" apart from `OTEL_*` exporter variables and, if `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1`, credentials ([hooks](https://code.claude.com/docs/en/hooks#common-input-fields)). So `HERO_SYNERGY_TICKET` and `HERO_SYNERGY_EVENTS` reach `report.mjs` on Windows the same way as elsewhere. Set `HERO_SYNERGY_EVENTS` to a native absolute path (`C:\…`), because the hook's `node.exe` is a Windows program.

### Option A: `sendText` into the user's shell

The extension has to produce a different command string per shell. VS Code does exactly that for its own "send path to terminal" feature: it wraps paths as `& '…'` for PowerShell, converts backslashes to slashes for Git Bash, asks WSL to translate the path, and uses plain double quotes otherwise ([`preparePathForShell`](https://github.com/microsoft/vscode/blob/868a32d35dc4f489c0bf682ae8967afeb740c66e/src/vs/workbench/contrib/terminal/common/terminalEnvironment.ts#L320-L383)). The shell can be read from `Terminal.state.shell` (`'pwsh'`, `'cmd'`, `'gitbash'`, `'wsl'`, … or `undefined` "when there is not a clear signal") ([vscode.d.ts](https://github.com/microsoft/vscode/blob/868a32d35dc4f489c0bf682ae8967afeb740c66e/src/vscode-dts/vscode.d.ts#L7815-L7825)).

For `claude -n "<ticket title>" -w <slug> --plugin-dir "<dir>" "/wayfinder <map-url> <ticket-url>"`:

| Shell | What the seed's double quotes do | What would be needed |
| --- | --- | --- |
| PowerShell | Double-quoted strings are expandable: `$name`, `$(…)` and backticks in a ticket title are interpreted. Single-quoted strings are verbatim, and `''` is a literal quote ([about_Quoting_Rules](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_quoting_rules)). | Single quotes with `'` doubled. Before PowerShell 7.3 (so in Windows PowerShell 5.1, which ships with Windows) embedded `"` in an argument to a native program is not preserved; 7.3 changed that, but keeps the legacy behavior for `.cmd` and `.bat` targets ([about_Parsing](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_parsing#passing-arguments-that-contain-quote-characters)). |
| cmd | Double quotes group the argument. | Not verified: how `%`, `^`, `!` and embedded `"` in a title behave. cmd has no single-quote form. |
| Git Bash | POSIX rules: `$`, backticks and `\` are live inside double quotes. | Single quotes, with a backslash path for `--plugin-dir` converted to forward slashes as VS Code does. Plus the path-conversion risk below. |

**Git Bash path conversion (documented in general, unverified here).** MSYS2 says "all the arguments that look like Unix paths will get auto converted to Windows" when a native program is called, for example `--dir=/foo` becomes `--dir=C:/msys64/foo`; `MSYS2_ARG_CONV_EXCL` switches it off ([MSYS2 filesystem paths](https://www.msys2.org/docs/filesystem-paths/)). `claude.exe` is a native program and the prompt `/wayfinder …` starts with a slash. The page says nothing about arguments that contain spaces, and I found no Claude Code issue reporting a mangled slash command, so whether this bites is open.

**Shell integration is not a way out.** `shellIntegration.executeCommand(executable, args)` escapes arguments only "when the argument both contains whitespace and does not include any single quote, double quote or backtick characters", and it "is not guaranteed to work as shell integration must be activated" ([vscode.d.ts](https://github.com/microsoft/vscode/blob/868a32d35dc4f489c0bf682ae8967afeb740c66e/src/vscode-dts/vscode.d.ts#L7886-L7941)). On Windows shell integration supports Git Bash and pwsh only; "Command Prompt does not support shell integration" ([shell integration](https://code.visualstudio.com/docs/terminal/shell-integration), [vscode.d.ts](https://github.com/microsoft/vscode/blob/868a32d35dc4f489c0bf682ae8967afeb740c66e/src/vscode-dts/vscode.d.ts#L7711-L7721)).

**A default profile that is not on the same machine.** In a local Windows window whose default profile is a WSL shell, `sendText` would run `claude` inside WSL while the extension, the plugin directory and the events file are Windows paths (inferred). Setting `shellPath` avoids depending on the default profile.

### Option B: `claude` as the terminal's process (`shellPath` plus `shellArgs`)

`createTerminal({ name, shellPath: 'claude', shellArgs: ['-n', title, '-w', slug, '--plugin-dir', dir, prompt], env, iconPath, location })` involves no shell:

- VS Code resolves a bare `shellPath` itself. On Windows it walks the terminal's `PATH` and tries each `PATHEXT` extension (default `.COM;.EXE;.BAT;.CMD`), then hands node-pty the absolute path ([terminalProcess.ts `_validateExecutable`](https://github.com/microsoft/vscode/blob/868a32d35dc4f489c0bf682ae8967afeb740c66e/src/vs/platform/terminal/node/terminalProcess.ts#L276-L317), [processes.ts `findExecutable`](https://github.com/microsoft/vscode/blob/868a32d35dc4f489c0bf682ae8967afeb740c66e/src/vs/base/node/processes.ts#L86-L141)). If nothing is found the terminal fails with `Path to shell executable "claude" does not exist`.
- node-pty turns an argument array into one Windows command line, quoting any argument with a space or tab and escaping embedded `"` and trailing backslashes; a string is appended verbatim ([node-pty `argsToCommandLine`](https://github.com/microsoft/node-pty/blob/d1b0fe9705daa3dc1a8b04bf60ced131a15728fe/src/windowsPtyAgent.ts#L286-L336)). So a ticket title with `$`, `'`, `` ` `` or `"` and the `/wayfinder …` prompt arrive as single arguments, the same way for every user regardless of their shell (inferred from the source).

Trade-offs:

- **npm shims.** `PATHEXT` resolution finds `claude.cmd` when there is no `claude.exe`. Whether ConPTY starts a `.cmd`, and how `cmd.exe` then re-parses the title and prompt, is unverified. Microsoft's own warning for this case: "when passing arguments to batch files, the arguments are passed as raw command-line strings to `cmd.exe`" ([about_Parsing](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_parsing#passing-arguments-that-contain-quote-characters)).
- **No shell profile.** The process gets the window's environment only. A Node version manager that puts `node` on `PATH` from a shell profile would not apply, and the hooks need `node` (inferred).
- **The terminal ends with the session.** When `claude` exits there is no prompt left to type `claude --resume` into. `window.onDidCloseTerminal` and `Terminal.exitStatus` (code and `TerminalExitReason`) report it ([vscode.d.ts](https://github.com/microsoft/vscode/blob/868a32d35dc4f489c0bf682ae8967afeb740c66e/src/vscode-dts/vscode.d.ts#L7689-L7704)).

Option B is the one that does not need three quoting implementations, so it is the one to test first.

### Fewer things to quote

`CLAUDE_CODE_PLUGIN_DIRS` lists plugin directories "each loaded the way a `--plugin-dir` flag loads it. Separate multiple paths with `:` on Unix or `;` on Windows. Give each path as an absolute path". It requires 2.1.280 or later, and project and local settings cannot set it ([env-vars](https://code.claude.com/docs/en/env-vars), [plugins: create](https://code.claude.com/docs/en/plugins/create#load-a-directory-or-archive-for-one-session)). Set through `TerminalOptions.env`, it takes the extension path, which on Windows sits under `C:\Users\<name>\…` and can contain spaces, off the command line. An administrator can turn off both the flag and the variable with `disableSideloadFlags` ([plugins CLI reference](https://code.claude.com/docs/en/plugins/cli-reference#flags-that-load-a-plugin-for-one-session)).

### Closing the terminal

On Windows VS Code can only kill a terminal process forcefully ([processes.ts comment on `killTree`](https://github.com/microsoft/vscode/blob/868a32d35dc4f489c0bf682ae8967afeb740c66e/src/vs/base/node/processes.ts#L143-L149)); node-pty's Windows `kill()` calls `process.kill(pid)` on every process attached to the console ([windowsPtyAgent.ts](https://github.com/microsoft/node-pty/blob/d1b0fe9705daa3dc1a8b04bf60ced131a15728fe/src/windowsPtyAgent.ts#L196-L224)), and Node documents that on Windows such signals "terminate the process forcefully and abruptly (similar to `'SIGKILL'`)" ([Node child_process](https://nodejs.org/api/child_process.html#subprocesskillsignal)). So when the user closes a session's terminal on Windows, Claude Code most likely gets no chance to run `SessionEnd` (inferred). On top of that, `SessionEnd` hooks have a 1.5 second budget on a normal exit, and "Timeouts set on plugin-provided hooks don't raise the budget" ([hooks: SessionEnd](https://code.claude.com/docs/en/hooks#sessionend)).

## Exec-form hooks and `${CLAUDE_PLUGIN_ROOT}` on Windows

**Exec form (documented).** "Exec form runs when `args` is present. Claude Code resolves `command` as an executable on `PATH` and spawns it directly with `args` as the argument vector. There is no shell … No shell tokenization happens on any platform." The Windows note fits the seed's design exactly: "On Windows, exec form requires `command` to resolve to a real executable such as a `.exe`. The `.cmd` and `.bat` shims … can't be spawned without a shell. … The `node` plus script-path pattern works on every platform because `node.exe` is a real binary" ([hooks: exec form and shell form](https://code.claude.com/docs/en/hooks#exec-form-and-shell-form)).

**`${CLAUDE_PLUGIN_ROOT}` (documented).** It resolves "anywhere in `command` and `args`" of hook commands and is also exported to the hook process as `CLAUDE_PLUGIN_ROOT` ([manifest reference: environment variables](https://code.claude.com/docs/en/plugins/manifest-reference#environment-variables)). On Windows:

- Shell form: "the substituted paths use forward slashes so a shell doesn't read backslashes as escapes."
- Exec form keeps native paths. The troubleshooting page lists it as the way to get backslashes: "An exec-form hook, which spawns the process directly with an `args` array" ([plugins troubleshooting](https://code.claude.com/docs/en/plugins/troubleshooting#claude-plugin-root-shows-forward-slashes-on-windows)).

So `args: ["${CLAUDE_PLUGIN_ROOT}/report.mjs"]` becomes something like `C:\Users\me\.vscode\extensions\…\claude-plugin/report.mjs`, with mixed separators, passed to `node.exe` as one argument. Spaces in the path need no quoting in exec form. A plugin loaded with `--plugin-dir` "loads in place and is never copied" ([plugin loading](https://code.claude.com/docs/en/plugins/loading)), so the root is the extension's own folder.

**Minimum version.** Exec form was added in 2.1.139 ([changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)). Older versions ignore `args`. A maintainer confirmed this when closing [#77160](https://github.com/anthropics/claude-code/issues/77160): "On versions before that, the `args` field wasn't recognized", and exec form fired correctly for him on 2.1.233, on Linux. On an old version the seed's hook would run bare `node` with the hook JSON on stdin, which Node tries to evaluate as a script; that is the failure described in [#90495](https://github.com/anthropics/claude-code/issues/90495), whose reporter was on 2.1.117.

**Requirements the seed does not state.**

- `node` must be on the session's `PATH`. Claude Code does not need Node: "The installed `claude` binary does not itself invoke Node" ([setup](https://code.claude.com/docs/en/setup)). A user with the native install and no Node gets a failing hook on every event.
- `command` must not be a Windows app execution alias. A user report shows exec form refusing a `WindowsApps\pwsh.exe` alias with `Executable not found in $PATH` ([#85475](https://github.com/anthropics/claude-code/issues/85475), open). A normal Node install is a real `node.exe`.

**Contrary reports on the issue tracker.** None has a maintainer reply that settles it for Windows.

| Issue | State | Claim | Bearing on the seed |
| --- | --- | --- | --- |
| [#70150](https://github.com/anthropics/claude-code/issues/70150) | Closed as stale, not planned (2.1.186) | Exec-form `args` with `${CLAUDE_PLUGIN_ROOT}` were re-parsed by Git Bash and lost their backslashes. The `command` was `bash`. | Direct contradiction of the docs if it also happens with `node`. Changelog 2.1.161 mentions special handling for hooks "that invoke bash explicitly", so it may be specific to `bash`. Unresolved. |
| [#90495](https://github.com/anthropics/claude-code/issues/90495) | Open | Exec form still ran `bash.exe -c node` and dropped `args`. | Reporter's version (2.1.117) predates exec form, so this reads as version skew (inferred). |
| [#70200](https://github.com/anthropics/claude-code/issues/70200), [#14828](https://github.com/anthropics/claude-code/issues/14828) | Open | Child processes, including shell-form hooks run through `bash.exe`, flash console windows. | Reported for shell form. Whether an exec-form `node.exe` hook flashes a window is unknown. |
| [#77078](https://github.com/anthropics/claude-code/issues/77078) | Open | Hook processes are sometimes left suspended and hang the turn. | The seed's hooks are `async: true`, so they should not block a turn, but a status event could go missing. |

**Fallback if exec form fails on Windows.** The shell form `node "${CLAUDE_PLUGIN_ROOT}/report.mjs"` is documented to work under both Windows hook shells: Git Bash gets a forward-slash path, and for PowerShell Claude Code rewrites the placeholder to `${env:CLAUDE_PLUGIN_ROOT}`, which "works inside double-quoted strings" ([hooks: Windows PowerShell tool](https://code.claude.com/docs/en/hooks#windows-powershell-tool)). Shell-form hooks under Git Bash may source the user's profile, and a profile that echoes text pollutes hook output ([hooks guide](https://code.claude.com/docs/en/hooks-guide)); `report.mjs` prints nothing, so that does not affect it.

**Other documented Windows caveats for plugins.**

- Component paths in a plugin must use forward slashes; "Components declared with backslash paths therefore load on Windows only" ([plugin loading](https://code.claude.com/docs/en/plugins/loading)).
- File-tool paths in hook input arrive "with backslash separators" on Windows ([hooks: PreToolUse](https://code.claude.com/docs/en/hooks#pretooluse-input)). `report.mjs` does not read them.
- Windows has no `/dev/tty`; hooks have no controlling terminal on any platform ([hooks](https://code.claude.com/docs/en/hooks#hook-input-and-output)). `report.mjs` only reads stdin and appends to a file.

## Appending to and watching the events file

### Appending

`appendFileSync` opens with the `a` flag, writes and closes. On Windows libuv maps that to `FILE_APPEND_DATA` and opens every file with `FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE` "to match UNIX semantics" ([libuv `src/win/fs.c`](https://github.com/libuv/libuv/blob/49b1c064714b412d7f7a2f5e7146c977554e57f9/src/win/fs.c#L494-L513)). So several hook processes appending while the Cockpit reads do not hit sharing violations among themselves (inferred from the source). `report.mjs` writes `\n` explicitly, so there are no CRLF line endings to handle.

Not covered by anything I read: whether two simultaneous appends can interleave inside a line on NTFS, and whether antivirus or indexing software holding the file can make an append fail. A status event is one short line in one write, which keeps the exposure small.

### Watching

- **VS Code's watcher.** A non-recursive watch on a file or folder uses Node's `fs.watch`; recursive watches use parcel-watcher ([File Watcher Internals](https://github.com/microsoft/vscode/wiki/File-Watcher-Internals)). Platform back ends: "Windows: using `ReadDirectoryChangesW`", Linux `inotify`, macOS `fsevents`. Limits: "mapped network drives or third party file system drivers are not guaranteed to produce file events" and "the operating system may decide to drop file events at any time, there is no 100% guarantee" ([File Watcher Issues](https://github.com/microsoft/vscode/wiki/File-Watcher-Issues)).
- **Events are coalesced.** The Node-based watcher aggregates changes over 75 ms and throttles bursts ([nodejsWatcherLib.ts](https://github.com/microsoft/vscode/blob/868a32d35dc4f489c0bf682ae8967afeb740c66e/src/vs/platform/files/node/watcher/nodejs/nodejsWatcherLib.ts#L24-L51)). One change event can stand for several status events on any platform.
- **Outside the workspace.** A string glob only reports workspace files. For a file elsewhere, pass a `RelativePattern` with a `Uri` for the folder ([vscode.d.ts `createFileSystemWatcher`](https://github.com/microsoft/vscode/blob/868a32d35dc4f489c0bf682ae8967afeb740c66e/src/vscode-dts/vscode.d.ts#L13984-L14079)). The same doc notes that matching is case-insensitive on Windows and that reported paths may differ in casing from disk.
- **A path that does not exist yet.** Uncorrelated requests "for non existing paths are ignored", or the watcher is suspended and re-checked by polling every 5 seconds ([File Watcher Internals](https://github.com/microsoft/vscode/wiki/File-Watcher-Internals)). Create the events file before launching the session, or watch its folder.
- **Node's `fs.watch` directly.** "On Windows systems, this feature depends on `ReadDirectoryChangesW`"; it "is implemented by monitoring changes in a directory versus specific files"; "no events will be emitted if the watched directory is moved or renamed"; and it "can be unreliable, and in some cases impossible, on network file systems" ([Node fs: caveats](https://nodejs.org/api/fs.html#caveats)). The seed gives file watching to Effect; I did not check which primitive `@effect/platform-node` uses.

Design consequences, the same on every platform but more likely to matter on Windows: keep a byte offset and read everything after it on each event, tolerate a partial last line, add a slow poll while sessions are live, and keep the file on a local disk (extension storage, not a network or synced folder).

### WSL remote windows

- `"extensionKind": ["workspace"]` means the extension "needs to run where the workspace is located" ([extension host](https://code.visualstudio.com/api/advanced-topics/extension-host#preferred-extension-location)). In a WSL window that is the remote extension host inside the distribution; "any terminal window you open … will automatically run in WSL" ([WSL](https://code.visualstudio.com/docs/remote/wsl#_opening-a-terminal-in-wsl)), and "the file watcher will run within the target file system … if the remote is Linux, the file watcher will run in the Linux environment" ([File Watcher Issues](https://github.com/microsoft/vscode/wiki/File-Watcher-Issues)).
- So in a WSL window everything is Linux: bash quoting, Linux paths, `inotify`. The Windows findings above do not apply. `vscode.env.remoteName` is `wsl` there ([vscode.d.ts](https://github.com/microsoft/vscode/blob/868a32d35dc4f489c0bf682ae8967afeb740c66e/src/vscode-dts/vscode.d.ts#L10834-L10843)).
- Claude Code and Node have to be installed inside WSL. The docs warn that WSL can pick up the Windows Node from `/mnt/c/` ([troubleshoot-install](https://code.claude.com/docs/en/troubleshoot-install#npm-install-errors-in-wsl)).
- Keep the events file on the Linux filesystem, such as the extension's storage folder in the VS Code server. A file under `/mnt/c` goes through a Windows file-system bridge, which falls under "third party file system drivers are not guaranteed to produce file events" (inferred; not tested).
- WSL 1: VS Code documents a file-watcher problem there and a polling setting, `remote.WSL.fileWatcher.polling` ([WSL](https://code.visualstudio.com/docs/remote/wsl)), and Claude Code's native binary has the `Exec format error` regression. WSL 2 only is the reasonable line.
- Not covered: a local Windows window that opens a WSL folder through a `\\wsl$` path. The extension would run on Windows against a UNC working directory.

## Needs a real Windows test

1. **Exec-form hook end to end.** On native Windows with and without Git for Windows: does `command: "node"`, `args: ["${CLAUDE_PLUGIN_ROOT}/report.mjs"]` run, with a plugin path that contains a space? This settles [#70150](https://github.com/anthropics/claude-code/issues/70150) for `node`.
2. **Console windows.** Does each hook firing flash a console window when the session runs in a VS Code terminal?
3. **`shellPath: 'claude'` with a `shellArgs` array.** Does it start `claude.exe` with the title and the `/wayfinder …` prompt intact (titles containing `"`, `'`, `$`, `%`, `&`, `` ` ``)? Does it start at all when only the npm `claude.cmd` shim exists, and what does `cmd.exe` do to those characters?
4. **`sendText` per shell**, if Option A is kept: the three quoting variants in Windows PowerShell 5.1, PowerShell 7, cmd and Git Bash, including whether Git Bash rewrites `/wayfinder …` into a Windows path.
5. **`SessionEnd` on Windows.** Does it produce a status event on `/exit`, on Ctrl+C twice, on closing the terminal, and on closing the window? Does `async: true` let the hook finish within the 1.5 second budget when `node.exe` starts slowly?
6. **`CLAUDE_CODE_PLUGIN_DIRS`** with a Windows path from `TerminalOptions.env`: does the plugin load, and do its hooks fire?
7. **Watching.** Does `createFileSystemWatcher(new RelativePattern(folder, 'events.jsonl'))` fire for each append from another process on NTFS, how late, and what happens under a OneDrive-synced profile folder?
8. **Concurrent appends.** `UserPromptSubmit`, `Notification` and `Stop` hooks firing close together: are lines ever interleaved or lost?
9. **Environment through Git Bash.** Does `HERO_SYNERGY_EVENTS` reach `node.exe` unchanged when the session was started from a Git Bash terminal?
10. **`-w` on Windows.** Worktree creation under `<repo>\.claude\worktrees\<slug>`: path length limits and slugs Windows cannot store. The docs cover only link handling on removal ([worktrees](https://code.claude.com/docs/en/worktrees)).
11. **The scout.** Spawning `claude -p … --json-schema …` from the extension host with `claude.exe` and with the npm shim ([#82447](https://github.com/anthropics/claude-code/issues/82447)).
12. **WSL window.** One full pass: launch, hooks, status events, with the events file in extension storage.

## Differences from the seed

Nothing I read contradicts a decision in `docs/seed.md`. The seed lists "Windows support for terminals and hook commands" as not yet specified, and these points refine it:

- **Sessions.** The launch command is written in bash quoting. It is not valid as-is for PowerShell or cmd, and Git Bash may convert the leading-slash prompt. The seed does not say whether the command is typed into a shell or run as the terminal's process; on Windows that choice decides how much quoting code exists.
- **Live status, `SessionEnd` → ended.** On Windows a closed terminal is killed forcefully, so "ended" cannot depend on the `SessionEnd` status event alone.
- **Appendix A.7.** The hooks need Claude Code 2.1.139 or later and `node` on `PATH`; the seed states neither. Claude Code itself does not require Node.
- **Appendix A.7 is otherwise what the docs recommend for Windows.** `node` plus `${CLAUDE_PLUGIN_ROOT}/…` in exec form is the documented cross-platform pattern.
- **Sessions, `--plugin-dir`.** `CLAUDE_CODE_PLUGIN_DIRS` is a documented alternative the seed does not mention.
- **The scout.** The example is a bash pipeline, and "the scout spawns the user's own `claude` binary" needs a rule for npm installs on Windows, where `claude` is a `.cmd` shim.
- **`extensionKind: ["workspace"]`.** Confirmed: it puts the whole pipeline inside WSL in WSL windows.

## Sources

Claude Code docs (read 2026-10-02):

- Setup: <https://code.claude.com/docs/en/setup>
- Troubleshoot installation: <https://code.claude.com/docs/en/troubleshoot-install>
- CLI reference: <https://code.claude.com/docs/en/cli-reference>
- Hooks reference: <https://code.claude.com/docs/en/hooks>
- Hooks guide: <https://code.claude.com/docs/en/hooks-guide>
- Plugins, create: <https://code.claude.com/docs/en/plugins/create>
- Plugin manifest reference: <https://code.claude.com/docs/en/plugins/manifest-reference>
- Plugin commands reference: <https://code.claude.com/docs/en/plugins/cli-reference>
- Plugin loading reference: <https://code.claude.com/docs/en/plugins/loading>
- Troubleshoot plugins: <https://code.claude.com/docs/en/plugins/troubleshooting>
- Environment variables: <https://code.claude.com/docs/en/env-vars>
- Worktrees: <https://code.claude.com/docs/en/worktrees>
- What's new, week 18 2026: <https://code.claude.com/docs/en/whats-new/2026-w18>

Claude Code changelog and issues:

- Changelog (2.1.120, 2.1.139 and 2.1.161 entries; `CLAUDE_CODE_PLUGIN_DIRS` has no changelog entry, its version comes from the docs): <https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md>
- <https://github.com/anthropics/claude-code/issues/77160> (exec form ignored before 2.1.139; maintainer reply)
- <https://github.com/anthropics/claude-code/issues/70150> (exec-form args lose backslashes on Windows)
- <https://github.com/anthropics/claude-code/issues/90495> (exec-form args dropped on Windows)
- <https://github.com/anthropics/claude-code/issues/85475> (app execution alias in exec form)
- <https://github.com/anthropics/claude-code/issues/70200>, <https://github.com/anthropics/claude-code/issues/14828> (console window flashes)
- <https://github.com/anthropics/claude-code/issues/77078> (suspended hook processes)
- <https://github.com/anthropics/claude-code/issues/82447> (`claude.cmd` versus `claude.exe` with `--json-schema`)
- <https://github.com/anthropics/claude-code/issues/38788> (WSL 1 `Exec format error`)

VS Code API docs and source (`microsoft/vscode` at `868a32d35dc4f489c0bf682ae8967afeb740c66e`):

- `src/vscode-dts/vscode.d.ts`: `TerminalOptions`, `Terminal.sendText`, `Terminal.shellIntegration`, `TerminalShellIntegration.executeCommand`, `TerminalState.shell`, `Terminal.exitStatus`, `env.remoteName`, `workspace.createFileSystemWatcher`
- `src/vs/platform/terminal/node/terminalProcess.ts`
- `src/vs/base/node/processes.ts`
- `src/vs/workbench/contrib/terminal/browser/terminalInstance.ts`
- `src/vs/workbench/contrib/terminal/common/terminalEnvironment.ts`
- `src/vs/platform/files/node/watcher/nodejs/nodejsWatcherLib.ts`
- File Watcher Internals: <https://github.com/microsoft/vscode/wiki/File-Watcher-Internals>
- File Watcher Issues: <https://github.com/microsoft/vscode/wiki/File-Watcher-Issues>
- Terminal profiles: <https://code.visualstudio.com/docs/terminal/profiles>
- Terminal shell integration: <https://code.visualstudio.com/docs/terminal/shell-integration>
- Extension host: <https://code.visualstudio.com/api/advanced-topics/extension-host>
- Developing in WSL: <https://code.visualstudio.com/docs/remote/wsl>

Primary sources outside the list the ticket named, used for the shells and the runtime underneath:

- node-pty (the terminal back end VS Code uses), `src/windowsPtyAgent.ts` at `d1b0fe9705daa3dc1a8b04bf60ced131a15728fe`: <https://github.com/microsoft/node-pty/blob/d1b0fe9705daa3dc1a8b04bf60ced131a15728fe/src/windowsPtyAgent.ts>
- Node.js `child_process`: <https://nodejs.org/api/child_process.html>
- Node.js `fs`: <https://nodejs.org/api/fs.html#caveats>
- libuv `src/win/fs.c` at `49b1c064714b412d7f7a2f5e7146c977554e57f9`: <https://github.com/libuv/libuv/blob/49b1c064714b412d7f7a2f5e7146c977554e57f9/src/win/fs.c>
- PowerShell about_Parsing: <https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_parsing>
- PowerShell about_Quoting_Rules: <https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_quoting_rules>
- MSYS2 filesystem paths: <https://www.msys2.org/docs/filesystem-paths/>
