# Hero Synergy

An unofficial VS Code cockpit for [Matt Pocock's agent skills](https://github.com/mattpocock/skills). It reads the wayfinder maps on your repo's issue tracker, shows which tickets can be taken right now, and opens one named Claude Code session per ticket in a VS Code terminal, with live status for each.

Hero Synergy is a personal project and is not affiliated with or endorsed by Matt Pocock or Anthropic.

## Requirements

- **VS Code 1.105 or later.** Built for VS Code; forks are expected to work.
- **macOS and Linux** are supported, dev containers and SSH remotes included. On Windows, use the WSL remote. Native Windows is untested and best-effort, with the native Claude Code installer.
- **Claude Code 2.1.212 or later.**
- **mattpocock-skills with the `wayfinder` skill**: any release from 1.1.0; built and tested against 1.2.3 and 1.3.1. Install it as a plugin or with skills.sh, never both.
- **Node 22.18 or later** on `PATH` in the session's environment.
- **`gh`, authenticated**, for a GitHub tracker.

## Settings

| Setting                                 | Default | What it does                                                                       |
| --------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| `heroSynergy.sessions.terminalLocation` | `panel` | Open ticket sessions in the terminal panel (`panel`) or in editor tabs (`editor`). |
| `heroSynergy.claude.path`               | empty   | Location of the `claude` executable. Empty resolves `claude` on `PATH`.            |

## Commands

- **Hero Synergy: Open Cockpit Detail** opens the Detail for the selected map or ticket.
- **Hero Synergy: Run skill…** lists every user-invoked skill and runs the one you pick in a new terminal.
- **Hero Synergy: Refresh** reads the tracker and the sessions again.

## Conventions

**Naming a session you start by hand.** The Cockpit matches a session to a ticket by the leading `#<number>` of the session's name, so start it with `claude -n "#<number> <title>"`. A session named that way is shown as that ticket's session, whoever started it.

**Pushing a worktree session back.** A ticket session on a GitHub tracker runs in its own worktree. The Cockpit shows the worktree but never creates, merges or removes it. When the ticket closes, the session commits on the worktree branch, rebases onto `origin/main` with `git pull --rebase origin main`, and pushes with `git push origin HEAD:main`.

## Links

- [Source and issues](https://github.com/dbarjs/hero-synergy)
- [Changelog](https://github.com/dbarjs/hero-synergy/blob/main/packages/vscode/CHANGELOG.md)
- [Licence](https://github.com/dbarjs/hero-synergy/blob/main/LICENSE)
