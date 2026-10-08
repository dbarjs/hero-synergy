#!/usr/bin/env node
// `next`, the terminal pre-alpha of the Cockpit: it lists and launches the tickets of spec #37 and
// of its own map #64 from the terminal, by hand, until v0.1.0 ships. It grows with that map, ticket
// by ticket, and after the release it is the prior art the official CLI map starts from; nothing in
// it ships. Reads and launches, never writes (ADR 0003).
//
//   node scripts/next.mjs --list            print the open tickets of the spec and of the map, `next` on the first takeable
//   node scripts/next.mjs                   print the launch command, then launch the first takeable ticket
//   node scripts/next.mjs <number>          launch that ticket
//   node scripts/next.mjs resume <number>   print the Resume command, then run it, for a ticket whose session ended
//
// --list shows each ticket's session as the Focus pane does (starting, working, waiting for you,
// needs approval, failed, ended with its reason), derived by core from the status events and the
// registry; a ticket whose session is ended is takeable again. Under a ticket whose worktree
// exists it shows what the Focus pane shows of it: path, branch, and what it holds that is not on
// `main` (uncommitted files, commits ahead), read through git's read-only commands (ADR 0003).
// `next` never creates, merges or removes a worktree.
//
// --list also prints every warning the Cockpit shows, in the Cockpit's codes and words, all from
// core's tables. Health comes first, from the machine: Claude Code against the floor, the plugin
// and the skills, then what the registry and the status hooks gave. Drift sits under the map or
// ticket row it is about, one line per loud warning and one muted count of the old forms per map
// (closed tickets included, listed under the open ones when they have a line). The disagreements
// between the tracker and the session side sit under their ticket, and a live session whose ticket
// is in neither list closes the output. A warning never gates: `next` still lists and still
// launches, and the decoders' own warnings on a launch stay a line on stderr.
//
// `resume` is the Cockpit's Resume: core builds the command from the ended session's id and the
// same context a launch uses (by name, a plain session, when no id is on record). A ticket with no
// ended session is refused, as the Cockpit's row offers no Resume there; when nothing is running on
// it, `resume` says so and offers the relaunch the Cockpit offers in its place.
//
// Add --implement to a launch to start the session on /implement <ticket URL> instead of the
// wayfinder form; everything else on the command stays core's Work ticket command.
//
// Plain Node, no package.json and no dependencies of its own, not part of any workspace package. It
// imports core's built `dist/` (@hero-synergy/core) by relative path, so `pnpm install` and
// `pnpm exec vp run build` come first, as the worktree routine in CLAUDE.md already requires.
// Needs `gh` (logged in) and `claude`.
//
// The launch goes through an interactive zsh and the `cc` alias, not straight from node: Claude
// Code writes the session name into the terminal title only when it runs as the shell's foreground
// job. Spawned from node, VS Code's tab keeps saying `node` and `/rename` changes nothing.

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  checkClaudeVersion,
  collectGitHubPromise,
  commandOf,
  disagreementOf,
  discoverSkillsPromise,
  driftEntryOf,
  groupByTicket,
  healthEntryList,
  healthLabel,
  isClaimed,
  isLoud,
  isRunning,
  openBlockers,
  placeOf,
  raise,
  readPluginList,
  readRegistry,
  readSnapshot,
  readStatusEvents,
  readWorktreesPromise,
  renderCommand,
  resumeEnded,
  sessionsOf,
  sessionText,
  sessionTitleOf,
  sessionView,
  workTicket,
  worktreeText,
} from '../packages/core/dist/index.mjs'

const OWNER = 'dbarjs'
const REPO = 'hero-synergy'
const SPEC = 37
const MAP = 64

// The parents whose tickets `next` works, in order: a spec ticket while the spec has a takeable one,
// a ticket of this script's own map otherwise. The map is read through core; a spec is not a map and
// core never reads one, so its sub-issues keep this script's own query, the one thing `next` does
// that the Cockpit never will.
const PARENTS = [SPEC, MAP]

// The launch is core's Work ticket command, the one the Cockpit runs: the skill line, the name, the
// worktree, the plugin dir and the env all come from `workTicket`. `--implement` swaps only the
// skill line, to the implement form with the ticket's URL. URLs, not `#n`, so the session never
// resolves a number against the wrong list.
const IMPLEMENT = 'implement'
const WAYFINDER = 'wayfinder'
const TO_SPEC = 'to-spec'

// Where the skills plugin comes from, in the Cockpit's words (never gating: a warning only).
const INSTALL_HINT =
  'install with `claude plugins install mattpocock-skills` or `npx skills@latest add mattpocock/skills`, one of them, never both'

// The word the launch is typed with, resolved by the interactive shell (alias or function).
const LAUNCHER = 'cc'
const SHELL = 'zsh'
// Flags the launcher gets before core's argv. NEXT_LAUNCH_FLAGS replaces them (empty for none), so a
// launch can be made to receive core's argv alone.
const LAUNCH_FLAGS =
  process.env.NEXT_LAUNCH_FLAGS === undefined
    ? ['--dangerously-skip-permissions']
    : process.env.NEXT_LAUNCH_FLAGS.split(/\s+/).filter(Boolean)

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// The status plugin the Cockpit passes with `--plugin-dir`, so its hooks fire in a session started
// from the terminal, and the events file those hooks append to (`.scratch` is gitignored).
const PLUGIN_PATH = join(REPO_ROOT, 'packages', 'vscode', 'claude-plugin')
const EVENTS_FILE = join(REPO_ROOT, '.scratch', 'hero-synergy-events.jsonl')
// What core's builders take beyond a ticket, the same for a launch and a resume.
const LAUNCH_CONTEXT = {
  repoRoot: REPO_ROOT,
  tracker: 'github',
  pluginPath: PLUGIN_PATH,
  eventsFile: EVENTS_FILE,
}
const issueUrl = (number) => `https://github.com/${OWNER}/${REPO}/issues/${number}`

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.error) throw new Error(`${command}: ${result.error.message}`)
  return result
}

// `claude` is run by name, as the launch is. One that cannot be started is `claude-not-found` on
// the Health line and an empty answer here, never a stop.
function runClaude(args) {
  const result = spawnSync('claude', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.error) {
    const missing =
      result.error.code === 'ENOENT' ? 'claude was not found on PATH.' : result.error.message
    return { missing, status: null, stdout: '', stderr: '' }
  }
  return result
}

function graphql(query, variables) {
  const args = ['api', 'graphql', '-f', `query=${query}`]
  for (const [key, value] of Object.entries(variables)) args.push('-F', `${key}=${value}`)
  const result = run('gh', args)
  // gh exits 1 for nearly everything on GraphQL; the body still carries the errors.
  let body
  try {
    body = JSON.parse(result.stdout)
  } catch {
    throw new Error(
      `gh api graphql failed (exit ${result.status}):\n${result.stderr || result.stdout}`,
    )
  }
  if (body.errors?.length)
    throw new Error(`GraphQL: ${body.errors.map((e) => e.message).join('; ')}`)
  return body.data
}

// The spec's sub-issues in one request: in sub-issue order, with each blocker's state and the
// assignees. Core never reads a spec, so this reading stays here.
async function readSpec(number) {
  const data = graphql(
    `
      query ($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            title
            subIssues(first: 100) {
              nodes {
                number
                title
                state
                assignees(first: 10) {
                  nodes {
                    login
                  }
                }
                blockedBy(first: 50) {
                  nodes {
                    number
                    state
                  }
                }
              }
            }
          }
        }
      }
    `,
    { owner: OWNER, repo: REPO, number },
  )
  const parent = data.repository.issue
  if (!parent) throw new Error(`#${number} not found on ${OWNER}/${REPO}`)
  const tickets = parent.subIssues.nodes.map((node) => {
    const claimedBy = node.assignees.nodes.map((a) => a.login)
    const waitsOn = node.blockedBy.nodes.filter((b) => b.state === 'OPEN').map((b) => b.number)
    return {
      number: node.number,
      title: node.title,
      parent: number,
      open: node.state === 'OPEN',
      state: node.state === 'OPEN' ? 'open' : 'closed',
      claim: claimedBy.length > 0 ? { by: claimedBy } : null,
      claimed: claimedBy.length > 0,
      claimedBy,
      waitsOn,
      takeable: claimedBy.length === 0 && waitsOn.length === 0,
      // A spec is not a map: the scout reads none, so its tickets carry no drift.
      warnings: [],
    }
  })
  return {
    number,
    title: parent.title,
    tickets,
    warnings: [],
    snapshotWarnings: [],
    readAt: Date.now(),
  }
}

// The map through core: its collect, its snapshot and its frontier rules, so `next` and the Tree
// agree on what is takeable, a blocker outside the map included.
async function readMap(number) {
  const { collected } = await collectGitHubPromise(REPO_ROOT)
  const snapshot = readSnapshot(collected)
  const map = snapshot.maps.find((m) => m.number === number)
  if (!map) throw new Error(`#${number} is not an open wayfinder map on ${OWNER}/${REPO}`)
  const tickets = map.tickets.map((ticket) => ({
    number: ticket.number,
    title: ticket.title,
    parent: number,
    open: ticket.state === 'open',
    state: ticket.state,
    claim: ticket.claim,
    claimed: isClaimed(ticket),
    claimedBy: ticket.claim?.by ?? [],
    waitsOn: openBlockers(ticket).map((blocker) => blocker.number),
    takeable: placeOf(ticket) === 'frontier',
    warnings: ticket.warnings,
  }))
  return {
    number,
    title: map.title,
    tickets,
    warnings: map.warnings,
    // The repo-level drift, which the Cockpit lists in its Health row.
    snapshotWarnings: snapshot.warnings,
    readAt: Date.parse(snapshot.collectedAt),
  }
}

function readParents() {
  return Promise.all(PARENTS.map((number) => (number === MAP ? readMap(number) : readSpec(number))))
}

function readTicket(number) {
  const data = graphql(
    `
      query ($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            number
            title
            state
            parent {
              number
            }
          }
        }
      }
    `,
    { owner: OWNER, repo: REPO, number },
  )
  const issue = data.repository.issue
  if (!issue) throw new Error(`#${number} not found on ${OWNER}/${REPO}`)
  return issue
}

// One run, one read of what the Focus pane reads: the events file the status plugin's hooks append
// to (start, failure, end; a missing file is an empty one), then the registry, `claude agents
// --json`, whose entries belong to the ticket their name starts with. Core derives each ticket's
// session from the two, the Cockpit's own derivation. What cannot be read comes back as `raised`
// health warnings (the Cockpit's own codes) and `notes`, the lines the Cockpit logs to its output
// channel.
function readSessions() {
  const notes = []
  let text = ''
  try {
    text = readFileSync(EVENTS_FILE, 'utf8')
  } catch (error) {
    if (error?.code !== 'ENOENT') notes.push(`could not read ${EVENTS_FILE}: ${error.message}`)
  }
  // A line still being appended is not read yet.
  const events = readStatusEvents(text.slice(0, text.lastIndexOf('\n') + 1))
  // One entry per code, without the chunk's own line number: the same fault is the same entry.
  const hooks = new Map()
  for (const warning of events.warnings)
    hooks.set(warning.code, raise(warning.code, warning.detail?.replace(/^line \d+: /, '')))
  const result = runClaude(['agents', '--json'])
  let registry = readRegistry('[]')
  if (!result.missing) {
    if (result.status === 0) registry = readRegistry(result.stdout)
    else notes.push(`claude agents --json exited with ${result.status ?? 'a timeout'}`)
  }
  const fromRegistry = registry.warnings.map((warning) =>
    raise(warning.code, warning.detail, result.stdout),
  )
  return {
    sessions: sessionsOf(events.value, groupByTicket(registry.value), Date.now()),
    raised: [...fromRegistry, ...hooks.values()],
    // A registry that cannot be read says nothing about the sessions: they show status unknown.
    registryUnreadable: registry.warnings.some((warning) => warning.code === 'registry-unreadable'),
    notes,
  }
}

// The sessions of a launch or a resume; what could not be read is a line on stderr, as it always was.
function readSessionsForLaunch() {
  const read = readSessions()
  for (const note of read.notes) console.error(`warning: ${note}`)
  for (const raised of read.raised) warnLine(raised)
  return read
}

const entryLine = (entry) => `${isLoud(entry) ? '⚠' : '·'} ${entry.code}: ${entry.message}`

const disagreementLine = (disagreement) =>
  `${disagreement.level === 'warning' ? '⚠' : '·'} ${disagreement.kind}: ${disagreement.text}`

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

// The open tickets of every parent with their notes; `next` marks the first takeable one across all
// parents in parent order. Under a row go its lines: what the tracker and the session side
// disagree about, then its loud drift. A closed ticket is listed after the open ones only when it
// has a line. A map's own loud drift and one count of all the old forms, its tickets' included,
// are lines of the map.
function annotate(parents, { sessions, registryUnreadable }, me) {
  const now = Date.now()
  let nextSeen = false
  return parents.map((parent) => {
    const rows = parent.tickets.map((ticket) => {
      const entries = ticket.warnings.map(driftEntryOf)
      const disagreement = disagreementOf(ticket, sessions.get(ticket.number), parent.readAt, me)
      const lines = [
        ...(disagreement === null ? [] : [disagreementLine(disagreement)]),
        ...entries.filter(isLoud).map(entryLine),
      ]
      return { ticket, lines, quiet: entries.filter((entry) => !isLoud(entry)).length }
    })
    const own = parent.warnings.map(driftEntryOf)
    const quiet =
      own.filter((entry) => !isLoud(entry)).length + rows.reduce((n, r) => n + r.quiet, 0)
    return {
      ...parent,
      lines: [
        ...own.filter(isLoud).map(entryLine),
        ...(quiet === 0 ? [] : [`· ${plural(quiet, 'old form', 'old forms')}`]),
      ],
      tickets: rows
        .filter(({ ticket }) => ticket.open)
        .map(({ ticket, lines }) => {
          const notes = []
          if (ticket.waitsOn.length)
            notes.push(`waits on ${ticket.waitsOn.map((n) => `#${n}`).join(' ')}`)
          if (ticket.claimed)
            notes.push(
              ticket.claimedBy.length ? `claimed by ${ticket.claimedBy.join(', ')}` : 'claimed',
            )
          const session = sessionText(
            sessionView(sessions.get(ticket.number), registryUnreadable),
            now,
          )
          if (session !== null) notes.push(session)
          // As in the Cockpit: a ticket is takeable again once its session is ended or gone.
          const takeable = ticket.takeable && !isRunning(sessions.get(ticket.number))
          if (takeable && !nextSeen) {
            notes.push('next')
            nextSeen = true
          }
          return { ...ticket, takeable, notes, lines }
        }),
      closed: rows
        .filter(({ ticket, lines }) => !ticket.open && lines.length > 0)
        .map(({ ticket, lines }) => {
          const session = sessionText(
            sessionView(sessions.get(ticket.number), registryUnreadable),
            now,
          )
          return { ...ticket, notes: ['closed', ...(session === null ? [] : [session])], lines }
        }),
    }
  })
}

// The sessions still running on a ticket that is in neither list, by number. An ended record of a
// ticket in some other map is not worth a line here.
function withoutTicket(parents, sessions) {
  const inView = new Set(parents.flatMap((parent) => parent.tickets.map((t) => t.number)))
  return [...sessions]
    .filter(([number, state]) => !inView.has(number) && isRunning(state))
    .sort(([a], [b]) => a - b)
}

function warnLine(warning) {
  const detail = warning.detail ? `: ${warning.detail}` : ''
  console.error(`warning: ${warning.code}${detail}`)
}

// Which plugins and skills are installed, from `claude plugin list --json` and the skill folders;
// what cannot be read comes back as the decoders' own warnings. A `claude` that is missing or
// fails to list reads as no plugins, as in the Cockpit.
async function readSkills() {
  const list = runClaude(['plugin', 'list', '--json'])
  const plugins = readPluginList(list.status === 0 ? list.stdout : '[]')
  const inventory = await discoverSkillsPromise({
    repoRoot: REPO_ROOT,
    home: homedir(),
    plugins: plugins.value,
  })
  return { inventory, warnings: [...plugins.warnings, ...inventory.warnings] }
}

// What the Cockpit's Health row says about the machine: Claude Code against the floor, the plugin
// and the skills, then what the registry and the status hooks gave, and the repo-level drift the
// row lists too. Core's table words each entry; none of it gates.
async function readHealth({ raised: fromSessions }, snapshotWarnings) {
  const raised = []
  const version = runClaude(['--version'])
  let claude = null
  if (version.missing) raised.push(raise('claude-not-found', version.missing))
  else {
    const checked = checkClaudeVersion({
      exitCode: version.status,
      stdout: version.stdout,
      stderr: version.stderr,
    })
    claude = checked.version
    raised.push(...checked.raised)
  }
  raised.push(...fromSessions)
  const { inventory, warnings } = await readSkills()
  raised.push(...warnings.map((warning) => raise(warning.code, warning.detail)))
  if (commandOf(inventory.skills, WAYFINDER) === null)
    raised.push(raise('skill-missing', undefined))
  return healthEntryList(raised, snapshotWarnings, { claude })
}

// The GitHub login of the person at this machine, as the Cockpit asks it, so a claim by someone
// else is told from one of this machine's own. Null when `gh` gives none.
function readMe() {
  const result = run('gh', ['api', 'user', '--jq', '.login'])
  const login = result.status === 0 ? result.stdout.trim() : ''
  if (login === '') {
    console.error('warning: gh api user gave no login; claims are not compared with this machine')
    return null
  }
  return login
}

// Core's skill discovery, before the launch: which skills are installed, and as which command. It
// says what is wrong in the Cockpit's words and never gates. A skill that is missing falls back to
// the plugin's namespaced command, which is what the launch would have used.
async function discoverCommands(needs) {
  const { inventory, warnings } = await readSkills()
  for (const warning of warnings) warnLine(warning)
  const commands = {}
  for (const name of [WAYFINDER, TO_SPEC, IMPLEMENT]) {
    const command = commandOf(inventory.skills, name)
    if (command === null && needs.includes(name)) {
      const worth =
        name === WAYFINDER || name === IMPLEMENT ? 'Work ticket unavailable' : 'unavailable'
      console.error(`warning: no \`${name}\`, ${worth}; ${INSTALL_HINT}`)
    }
    commands[name] = command ?? `/mattpocock-skills:${name}`
  }
  return commands
}

// Prints a core `Launch`, then runs it: the one tail of a launch and of a resume.
function start(built) {
  const args = [...LAUNCH_FLAGS, ...built.argv.slice(1)]
  if (built.envLine) console.log(built.envLine)
  console.log(renderCommand([LAUNCHER, ...args]))
  console.log()
  // `zsh -ic '<launcher> "$@"' <argv0> <args…>`: interactive so the alias expands, args passed
  // positionally so the title and the skill line never go through a second layer of quoting.
  const shellArgs = ['-ic', `${LAUNCHER} "$@"`, LAUNCHER, ...args]
  const result = spawnSync(SHELL, shellArgs, {
    cwd: built.cwd,
    env: { ...process.env, ...built.env },
    stdio: 'inherit',
  })
  if (result.error) throw new Error(`${SHELL}: ${result.error.message}`)
  process.exit(result.status ?? 1)
}

async function launch(ticket, { implement }) {
  const commands = await discoverCommands([implement ? IMPLEMENT : WAYFINDER])
  const built = workTicket(
    LAUNCH_CONTEXT,
    { wayfinder: commands[WAYFINDER], toSpec: commands[TO_SPEC] },
    {
      map: { ref: { tracker: 'github', url: issueUrl(ticket.parent) } },
      ticket: {
        number: ticket.number,
        title: ticket.title,
        ref: { tracker: 'github', url: issueUrl(ticket.number) },
      },
    },
  )
  // The skill line is the builder's last word; the implement form swaps it and nothing else.
  const argv = implement
    ? [...built.argv.slice(0, -1), `${commands[IMPLEMENT]} ${issueUrl(ticket.number)}`]
    : built.argv
  return start({ ...built, argv })
}

// Under a ticket whose worktree exists: where it is, its branch, and what it holds that is not on
// `main`, as core words it for the Focus pane. Read through core's read-only git reads.
//
// The warnings are the Cockpit's: Health at the top, a map's drift under its row, a ticket's
// disagreement and drift under its row, and the sessions with no ticket in view at the bottom.
async function list() {
  const read = readSessions()
  for (const note of read.notes) console.error(`warning: ${note}`)
  const found = await readParents()
  const health = await readHealth(
    read,
    found.flatMap((parent) => parent.snapshotWarnings),
  )
  const parents = annotate(found, read, readMe())
  const worktrees = await readWorktreesPromise(
    REPO_ROOT,
    parents.flatMap((parent) => parent.tickets.map((t) => t.number)),
  )
  const label = healthLabel(health)
  if (label !== null) {
    console.log(`${health.some(isLoud) ? '⚠ ' : ''}${label}`)
    for (const entry of health) console.log(`    ${entryLine(entry)}`)
    console.log()
  }
  const row = (t) => {
    const notes = t.notes.length ? `  (${t.notes.join(', ')})` : ''
    console.log(`  #${t.number} ${t.title}${notes}`)
    for (const line of t.lines) console.log(`      ${line}`)
  }
  parents.forEach((parent, i) => {
    if (i > 0) console.log()
    console.log(`#${parent.number} ${parent.title}`)
    for (const line of parent.lines) console.log(`    ${line}`)
    for (const t of parent.tickets) {
      row(t)
      const worktree = worktrees.get(t.number)
      if (worktree) console.log(`      worktree ${worktree.path} · ${worktreeText(worktree)}`)
    }
    for (const t of parent.closed) row(t)
  })
  const stray = withoutTicket(found, read.sessions)
  if (stray.length > 0) {
    const now = Date.now()
    console.log()
    console.log('Sessions without a ticket in view')
    for (const [number, state] of stray) {
      const title = sessionTitleOf(state)
      const session = sessionText(sessionView(state, read.registryUnreadable), now)
      console.log(`  #${number}${title === null ? '' : ` ${title}`}  (${session})`)
    }
  }
}

function launchNumber(number, options) {
  if (isRunning(readSessionsForLaunch().sessions.get(number))) {
    console.error(
      `#${number} already has a live session; resume it with: claude --resume '#${number} …'`,
    )
    process.exit(1)
  }
  const issue = readTicket(number)
  if (issue.state !== 'OPEN') console.error(`warning: #${number} is ${issue.state.toLowerCase()}`)
  if (!issue.parent)
    console.error(`warning: #${number} has no parent issue; the session gets the spec, #${SPEC}`)
  return launch(
    { number: issue.number, title: issue.title, parent: issue.parent?.number ?? SPEC },
    options,
  )
}

async function launchNext(options) {
  const parents = annotate(await readParents(), readSessionsForLaunch(), null)
  const next = parents.flatMap((p) => p.tickets).find((t) => t.takeable)
  if (!next) {
    const names = parents.map((p) => `#${p.number} ${p.title}`).join(' or ')
    console.error(`nothing takeable on ${names}; see --list`)
    process.exit(1)
  }
  return launch(next, options)
}

// The Cockpit's Resume, for a ticket whose session ended. The id comes from the status events or
// the registry the way the Focus pane reads it; core picks by id, with the plugin and env set
// again, or by name, a plain session, when no id is on record.
function resumeNumber(number) {
  const state = readSessionsForLaunch().sessions.get(number)
  if (state?.kind !== 'ended') return refuseResume(number, state)
  const { title } = readTicket(number)
  const resuming = resumeEnded(LAUNCH_CONTEXT, { number, title }, state.sessionId)
  if (resuming.by === 'name')
    console.error(
      `warning: no session id is on record for #${number}; resuming by name, as a plain session without the status plugin`,
    )
  return start(resuming.launch)
}

// The Cockpit's row offers Resume only on an ended session. A session still running gets no Action
// there; with none running the Cockpit relaunches (Work ticket, or Launch fresh on a claimed
// ticket) and `next <number>` is that relaunch.
function refuseResume(number, state) {
  if (isRunning(state)) {
    const session = sessionText(sessionView(state), Date.now())
    console.error(
      `#${number} has no ended session to resume: its session is still running (${session})`,
    )
  } else {
    console.error(
      `#${number} has no ended session to resume: no session of it is on record in the status events or the registry`,
    )
    console.error(
      `the Cockpit relaunches it instead; to do the same: node scripts/next.mjs ${number}`,
    )
  }
  process.exit(1)
}

const USAGE = 'usage: node scripts/next.mjs [--list | resume <number> | [--implement] [<number>]]'

const ticketNumber = (arg) => {
  const number = Number(arg)
  return Number.isInteger(number) && number > 0 ? number : null
}

async function main(argv) {
  const implement = argv.includes('--implement')
  const rest = argv.filter((arg) => arg !== '--implement')
  const [arg] = rest
  if (arg === '--list') return list()
  if (arg === undefined) return launchNext({ implement })
  if (arg === 'resume') {
    const number = ticketNumber(rest[1])
    if (implement || rest.length !== 2 || number === null) {
      console.error(USAGE)
      process.exit(2)
    }
    return resumeNumber(number)
  }
  const number = ticketNumber(arg)
  if (rest.length > 1 || number === null) {
    console.error(USAGE)
    process.exit(2)
  }
  return launchNumber(number, { implement })
}

try {
  await main(process.argv.slice(2))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
