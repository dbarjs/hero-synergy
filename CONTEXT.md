# hero-synergy

An unofficial VS Code cockpit for Matt Pocock's agent skills. It reads the wayfinder maps on a repo's issue tracker, shows which tickets can be taken right now, and opens one named Claude Code CLI session per ticket in a VS Code terminal, with live status for each.

## Language

**Cockpit**:
The whole hero-synergy UI in VS Code: the tree and the detail together, showing a repo's maps, live sessions and available actions.
_Avoid_: dashboard, control panel

**Tree**:
The Cockpit's side view: every open map unfolding into its tickets, with a focus pane under the selected row.
_Avoid_: sidebar, panel (VS Code lets the user host it in either)

**Detail**:
The Cockpit's editor tab, showing one map or one ticket in full and following the tree's selection.
_Avoid_: preview, page

**Focus pane**:
The compact block under the selected tree row: state, claim, session status and the actions for that row.
_Avoid_: popover, inspector

**Map**:
A wayfinder map: the issue labelled `wayfinder:map` (or `.scratch/<effort>/map.md` on a local tracker) that indexes one effort's decisions.
_Avoid_: board, plan, epic

**Ticket**:
A child issue of a map holding one question, typed by a `wayfinder:<type>` label: research, prototype, grilling or task.
_Avoid_: card, story

**Frontier**:
The open, unblocked, unclaimed tickets of a map. The first one in map order is next.
_Avoid_: backlog, ready list

**Claim**:
A ticket marked as taken, made by the session before any work: an assignee on GitHub, a `Status: claimed` line on a local tracker.
_Avoid_: lock, reservation

**Fog**:
In-scope work too vague to ticket yet, written in the map's "Not yet specified" section.
_Avoid_: backlog, unknowns

**Destination**:
What reaching the end of a map looks like. It fixes the map's scope.

**Tracker**:
Where a repo's issues live, as recorded by `/setup-matt-pocock-skills` in `docs/agents/issue-tracker.md`: GitHub, GitLab, local markdown or another tool.
_Avoid_: backend, issue host

**Scout**:
The background pipeline that turns a tracker's contents into a snapshot: collect with code, interpret with a fast model, reconcile with code.
_Avoid_: crawler, analyzer, sync

**Snapshot**:
The typed state of every open map in a repo at one moment: the facts the tracker reports, what code reads from map and ticket bodies, and drift warnings. It knows nothing about sessions.
_Avoid_: state dump, view model

**Drift**:
Any way a map or ticket differs from the current wayfinder conventions: legacy labels, text fallbacks, free-form markdown. Reported as a coded warning on the snapshot, the map or the ticket, never corrected.
_Avoid_: corruption, invalid map

**Session**:
One live Claude Code CLI process in a VS Code terminal for one ticket or action, named `#<number> <title>` after it, whoever started it. The conversation claude keeps on disk is not a session: it is what Resume takes as an argument.
_Avoid_: agent, run, job, conversation

**Status event**:
One line the session plugin's hooks append when a session starts, works, waits, needs approval, fails or ends.
_Avoid_: log line, heartbeat

**Worktree**:
The git worktree a ticket session runs in, created by `claude -w` at `.claude/worktrees/<slug>` on branch `worktree-<slug>`. Sessions on a local tracker have none.
_Avoid_: sandbox, checkout

**Action**:
Anything the Cockpit offers that spawns a process in a terminal, always shown with the exact command it will run. A user-invoked skill is the common case; Resume and an install command are Actions too. Opening an issue or focusing a terminal is a button, not an Action.
_Avoid_: command, launcher

### Relationships

- A tracker holds many maps; a map holds many tickets.
- The scout reads one tracker and produces one snapshot.
- An action spawns a process and shows its command; a button never spawns one.
- An action launches a session; a ticket has at most one live session.
- An action's command name follows where its skill was found: `/<name>` for a project or personal skill, `/<plugin>:<name>` for a plugin skill.
- A session emits status events.
- A ticket's session is none, starting, live or ended; the ticket and its terminal hold the status, never a session id.
- The Cockpit has one tree and at most one detail; both show the same selection.
- A ticket session on a GitHub tracker runs in its own worktree; the Cockpit shows the worktree but never creates, merges or removes it.

### Flagged ambiguities

- "task" is both a ticket type and everyday English: say "task ticket" for the type.
- "Background session" in this project means the scout's child process, never `claude --bg`.
