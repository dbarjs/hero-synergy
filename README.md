<p align="center">
  <img src="docs/media/banner-3x1.jpg" width="960" alt="The Wayfinder Seal, a compass needle whose north point is a gold star, beside the name hero-synergy and the line: A VS Code cockpit for mattpocock/skills.">
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=dbarjs.hero-synergy"><img src="https://vsmarketplacebadges.dev/version-short/dbarjs.hero-synergy.svg?label=VS%20Code%20Marketplace&color=30258C" alt="VS Code Marketplace version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-MIT-30258C" alt="MIT licence"></a>
</p>

Hero Synergy is an unofficial Visual Studio Code cockpit for the wayfinder maps of [Matt Pocock's skills](https://github.com/mattpocock/skills). It shows each map's frontier, the tickets you can take right now, and starts any of them with one click as a [Claude Code](https://code.claude.com/docs) session named after the ticket. Every session's status stays in view, so you can see which one needs you.

Hero Synergy is a personal project and is not affiliated with or endorsed by Matt Pocock or Anthropic.

https://github.com/user-attachments/assets/e1d5cc19-a024-462d-8876-88391ef6157a

<img src="docs/media/window-map.png" width="880" alt="The Cockpit in VS Code: on the left, the Tree shows the map Docs search with 2 takeable and 4 of 11 decided, and its tickets: #5 working, #6 needs approval, #7 waiting for you, #8 next on the frontier, #9 ended, #10 and #11 waiting on others. On the right, the Detail shows the map's destination, decisions so far, not yet specified and out of scope.">

**One giant map. Too many terminals. Which one needs you?**

A wayfinder map holds more work than one agent session can, so you work its tickets in many sessions at once, often across several maps. Soon there are more terminals than you can watch, and the one waiting for you is somewhere among them.

## See the frontier

The Tree shows every open map of the repository, unfolded into its tickets. The frontier, the tickets you can take right now, each have a ▶, and the first in map order is marked NEXT. Blocked tickets say what they wait on.

<img src="docs/media/focus-pane.png" width="480" alt="The Tree with the frontier ticket #8 Typo tolerance selected: its Focus pane shows it unclaimed, a Work ticket button and the exact claude command it runs.">

## One click, one named session

▶ opens a terminal named `#<number> <title>` and starts the ticket's Claude Code session in it, running the wayfinder skill on that ticket. On a GitHub tracker the session gets its own worktree. The command is always shown before it runs.

<img src="docs/media/launch.gif" width="880" alt="A click on ▶ beside the frontier ticket #8 Typo tolerance opens a terminal named after the ticket. The row goes from starting to live, the session claims the ticket, and the row goes to working, then to waiting for you.">

## Live status for every session

Each session's status stays on its ticket: working, waiting for you, needs approval, failed or ended. The ones that need you count on the Activity Bar badge, and their map moves to the top.

<img src="docs/media/focus-pane-session.png" width="480" alt="The Tree with #5 working, #6 needs approval and #7 waiting for you, and the Focus pane of #7 showing its session waiting for you for 21 seconds.">

## Close one, unblock the rest

The Detail shows a ticket in full: what it waits on and what it clears the way for. When a ticket closes, the tickets it was blocking join the frontier at the next refresh.

<img src="docs/media/detail-ticket.png" width="880" alt="The Detail of the blocked ticket #10 Query syntax: it waits on #5 Ranking signals and clears the way for #11 No results page, above its question.">

## Install

Install [Hero Synergy from the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=dbarjs.hero-synergy), or run:

```sh
code --install-extension dbarjs.hero-synergy
```

It needs Claude Code, mattpocock-skills with the wayfinder skill, and `gh` for a GitHub tracker. The [extension's README](packages/vscode/README.md) has the requirements, a quick start from install to your first ticket session, and the settings, commands and conventions.

## How it works

```mermaid
flowchart TD
  tracker[("Tracker<br/>GitHub issues or .scratch/")]
  scout["Scout"]
  snapshot["Snapshot"]
  cockpit["Cockpit<br/>Tree · Focus pane · Detail"]
  session["Ticket session<br/>claude -n, in a VS Code terminal"]
  hooks["Status plugin<br/>hooks"]
  events["Status events"]
  registry["Registry<br/>claude agents --json"]

  tracker -->|on refresh| scout --> snapshot --> cockpit
  cockpit -->|"▶ Work ticket"| session
  session -->|claims and resolves| tracker
  session --> hooks --> events --> cockpit
  session -.-> registry --> cockpit
```

- **The scout** reads the tracker that `/setup-matt-pocock-skills` recorded in `docs/agents/issue-tracker.md`, GitHub through `gh` or local markdown under `.scratch/`, and turns its open maps and their tickets into a **snapshot**: the typed state of every map at one moment, with any **drift** from the wayfinder conventions as warnings. It runs when something causes a refresh, never on a timer.
- **The Cockpit** draws the snapshot as the Tree and the Detail, and works out the frontier, the next ticket and each ticket's neighbours from it.
- **A ticket session** is a `claude` process in a VS Code terminal, named `#<number> <title>`. The Cockpit starts it with the wayfinder skill and the ticket, and leaves the work, the claim and the resolution to the session. On a GitHub tracker it runs in its own worktree, which the Cockpit shows but never creates, merges or removes.
- **Status** comes from two places. Claude Code's **registry** says whether each session is alive and busy, idle or waiting, whoever started it. The **status plugin**, a hooks plugin the Cockpit passes to the sessions it starts, adds what the registry can't: that a session failed, and why it ended.
- The tracker alone says whether a ticket is claimed, open or blocked; the session side alone says whether it is alive. Neither overrides the other, and the Cockpit shows where they disagree.

The vocabulary is in [`CONTEXT.md`](CONTEXT.md), the decisions in [`docs/adr/`](docs/adr), and every upstream the Cockpit relies on, with its floor and tested ceiling, in [`docs/upstream.md`](docs/upstream.md).

## Built with its own maps

Hero Synergy was charted and built with wayfinder maps, on this repository's issues:

- [#1 hero-synergy v0.1.0, fully decided](https://github.com/dbarjs/hero-synergy/issues/1): 33 tickets that decided what v0.1.0 is.
- [#37 Spec: hero-synergy v0.1.0, the Cockpit](https://github.com/dbarjs/hero-synergy/issues/37): the spec, built in 26 tickets.
- [#64 next, the terminal pre-alpha of the Cockpit](https://github.com/dbarjs/hero-synergy/issues/64): 6 tickets.
- [#22 The front door: READMEs, Marketplace listing and repository cards](https://github.com/dbarjs/hero-synergy/issues/22): this page.

## Packages

| Package                              | What it is                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| [`packages/vscode`](packages/vscode) | The extension, published as `dbarjs.hero-synergy`: the Cockpit, its webviews and the status plugin. |
| [`packages/core`](packages/core)     | The wayfinder map model, the tracker adapters and the scout, with no dependency on VS Code.         |
| [`packages/canary`](packages/canary) | The daily canary: runs the Cockpit's contracts against the newest upstreams and files the breaks.   |
| [`packages/cli`](packages/cli)       | A private placeholder. No CLI ships.                                                                |

## Developing

```sh
pnpm install
pnpm exec vp run -r build
pnpm exec vp check
pnpm exec vp test
pnpm exec vp run --filter hero-synergy package
```

`pnpm exec vp run capture` in `packages/vscode` takes the screenshots and the loop on this page again from the packaged extension.

<p align="center"><em>A hero with this many skills needs synergy.</em></p>

## Credits

Hero Synergy relies on the wayfinder conventions of [Matt Pocock's skills](https://github.com/mattpocock/skills) (MIT) and launches your own [Claude Code](https://code.claude.com/docs) CLI. It ships neither.

## Licence

[MIT](LICENSE)
