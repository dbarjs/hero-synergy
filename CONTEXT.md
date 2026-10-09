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

**AFK ticket**:
A ticket the agent works alone: a research or task ticket, or any ticket marked ready for an agent, unless it is marked ready for a human. A ticket with no type is not one.
_Avoid_: autonomous ticket, unattended ticket

**Frontier**:
The open, unblocked, unclaimed tickets of a map. The first one in map order is next.
_Avoid_: backlog, ready list

**Claim**:
A ticket marked as taken, made by the session before any work: an assignee on GitHub, a `Status: claimed` line on a local tracker.
_Avoid_: lock, reservation

**Neighbourhood**:
A ticket's immediate neighbours: what it waits on (its blockers, wherever they live) and what it clears the way for (the tickets of its map that wait on it, found by inverting the blockers). Derived on every render, never stored.
_Avoid_: dependency graph, dependants

**Finished map**:
An open map with at least one ticket and every ticket closed: nothing left to decide, ready for `/to-spec`. Folded away in the Tree.
_Avoid_: done, complete, closed (a closed map is hidden)

**Stuck map**:
A map with open work but nothing takeable: every open ticket is claimed or blocked.
_Avoid_: blocked map, idle

**Needs you**:
A session waiting for you, needing approval or failed. It counts for the badge, puts its map first, and is the one session fact the host hands the derived functions.
_Avoid_: attention, alert

**Fog**:
In-scope work too vague to ticket yet, written in the map's "Not yet specified" section.
_Avoid_: backlog, unknowns

**Destination**:
What reaching the end of a map looks like. It fixes the map's scope.

**Tracker**:
Where a repo's issues live, as recorded by `/setup-matt-pocock-skills` in `docs/agents/issue-tracker.md`: GitHub, GitLab, local markdown or another tool.
_Avoid_: backend, issue host

**Scout**:
The code that turns a tracker's open maps and their tickets into a snapshot, reporting anything it cannot read as drift. It runs only when something causes a refresh, never on a timer.
_Avoid_: crawler, analyzer, sync

**Snapshot**:
The typed state of every open map in a repo at one moment: the facts the tracker reports, what code reads from map and ticket bodies, and drift warnings. It knows nothing about sessions.
_Avoid_: state dump, view model

**Drift**:
Any way a map or ticket differs from the current wayfinder conventions: legacy labels, text fallbacks, free-form markdown. Reported as a coded warning on the snapshot, the map or the ticket, never corrected.
_Avoid_: corruption, invalid map

**Warning**:
One coded point about the tracker or about the machine. _Drift_ is about the tracker: a map or ticket off the current conventions. _Health_ is about the machine: Claude Code, the skills, the registry. _Loud_ when what the Cockpit shows may be wrong or missing; _quiet_ when something old or odd was still read correctly.
_Avoid_: error, lint

**Isolated environment**:
A window whose extension host runs inside a container the Cockpit can recognise: a Dev Containers or Codespaces remote, or a Docker or Podman marker file that isn't a toolbx or distrobox. It says where the session runs, not what it can reach: the container's own config decides that.
_Avoid_: sandbox, safe environment

**Session**:
One live Claude Code CLI process in a VS Code terminal for one ticket or action, named `#<number> <title>` after it, whoever started it. The conversation claude keeps on disk is not a session: it is what Resume takes as an argument.
_Avoid_: agent, run, job, conversation

**Bypassed session**:
A session the Cockpit launched with Claude Code's permission prompts bypassed. It still stops for ask rules and questions.
_Avoid_: YOLO mode, skip-permissions, dangerous mode, sandboxed session

**Registry**:
Claude Code's own list of live sessions on the machine, read with `claude agents --json`: whether a session is alive and whether it is busy, idle or waiting, whoever started it.
_Avoid_: process list, session store

**Status event**:
One line the session plugin's hooks append when a session starts, fails or ends: what the registry cannot say.
_Avoid_: log line, heartbeat

**Worktree**:
The git worktree a ticket session runs in, created by `claude -w` at `.claude/worktrees/<slug>` on branch `worktree-<slug>`. Sessions on a local tracker have none.
_Avoid_: sandbox, checkout

**Action**:
Anything the Cockpit offers that spawns a process in a terminal, always shown with the exact command it will run. A user-invoked skill is the common case; Resume and an install command are Actions too. Opening an issue or focusing a terminal is a button, not an Action.
_Avoid_: command, launcher

**Upstream**:
A tool the Cockpit relies on but does not ship: Claude Code, mattpocock-skills, VS Code, `gh` and Node. Each has a floor, a tested ceiling and its contracts listed in the upstream register, `docs/upstream.md`.
_Avoid_: dependency (a package in `package.json`), integration

**Contract**:
One thing the Cockpit reads from an upstream or passes to it and would break on if it changed: a flag, a JSON field, a hook event, a heading, a label, a frontmatter key, an API.
_Avoid_: dependency, API surface

**Floor**:
The lowest version of an upstream the Cockpit works on. The README states it as a requirement; the Cockpit never gates on it.
_Avoid_: minimum version, requirement

**Tested ceiling**:
The newest version of an upstream the Cockpit's behaviour was actually run or measured on. Newer versions are expected to work and are not promised.
_Avoid_: maximum version, latest supported

**Canary**:
The scheduled CI workflow that runs the Cockpit's parsers and test suites against the newest version of each upstream, while nobody is working on the repo. It watches the codebase, not any user's tracker or machine.
_Avoid_: nightly, smoke test, upstream drift

**Upstream review**:
A dated pass over every upstream since its last-checked version, run by hand when Eduardo comes back and never on a schedule. It sorts each change into upstream break, opportunity or irrelevant, moves the register's dates and files one issue per upstream break and opportunity.
_Avoid_: audit, sync, dependency update

**Upstream break**:
An upstream change that means something in this repo must change to stay correct: a schema that no longer decodes, a flag gone from the help, a suite that fails, a contract's shape, the floor, a file the register says is owed. Found by the canary while nobody is here, one issue per upstream, or by an upstream review when Eduardo is back, one issue per break; never a warning in the Cockpit, never fixed by the finder.
_Avoid_: drift (about the tracker), health (about the machine), regression, "break" on its own

**Opportunity**:
An upstream change the Cockpit could use: a new capability, or one that lets a cut feature return. Found only by an upstream review, since the canary ignores what is new, and filed as an issue for triage to weigh.
_Avoid_: feature request, enhancement

### Relationships

- A tracker holds many maps; a map holds many tickets.
- The scout reads one tracker and produces one snapshot.
- An action spawns a process and shows its command; a button never spawns one.
- An action launches a session; a ticket has at most one live session.
- Whether a session is bypassed follows its ticket, not the action: every action on an AFK ticket, resumes too, bypasses alike. Bypass is off unless the user turns it on, and by default happens only in an isolated environment.
- An action's command name follows where its skill was found: `/<name>` for a project or personal skill, `/<plugin>:<name>` for a plugin skill.
- A session emits status events.
- A ticket's session is none, starting, live or ended; the ticket and its terminal hold the status, never a session id.
- A live session's status comes from the registry; status events add failed, the ended reason and the session id.
- The tracker alone says claimed, open or closed and blocked; the session side alone says alive and what status. Neither overrides the other.
- The scout reports drift; the extension host reports health; both are warnings, shown in the same places. A warning never gates: the Cockpit says, it never stops.
- The Cockpit has one tree and at most one detail; both show the same selection.
- A ticket session on a GitHub tracker runs in its own worktree; the Cockpit shows the worktree but never creates, merges or removes it.
- An upstream has one floor and one tested ceiling; the Cockpit relies on its contracts and never gates on its version.
- The canary runs the Cockpit's own checks against the newest upstreams and files an upstream break on the tracker; the Cockpit at runtime reports health. The same contract can surface as either, in different places.
- An upstream review moves an upstream's last-checked date and tested ceiling; it never moves the floor, and the canary never writes the register.
- An upstream review starts from what the canary last passed and files issues; it never charts a map, changes code or updates the machine.

### Flagged ambiguities

- "task" is both a ticket type and everyday English: say "task ticket" for the type.
- "Background session" in this project means the scout's child process, never `claude --bg`.
- "Register" and "registry" are different things: the upstream register is the document `docs/upstream.md`; the registry is Claude Code's list of live sessions. Say "upstream register" and "the registry".
- "Drift" is only ever about the tracker. A newer Claude Code or skills release breaking the codebase is an upstream break, found by the canary while nobody is here or by an upstream review when Eduardo is back; the same thing found on a user's machine is health, shown by the Cockpit at runtime.
- "Status" is a session's registry status (busy, idle, waiting). On a local tracker the `Status:` line carries a ticket's state, its claim or its triage role: say "state" for open or closed, and "Status line" for the line itself.
