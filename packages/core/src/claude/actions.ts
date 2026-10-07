import type { Ref, Ticket, Tracker, WayfinderMap } from '../snapshot/model.ts'

/**
 * The command builder: from a ticket, its map, the tracker and the discovered
 * command names, what each Action launches. Pure: no process is spawned here.
 *
 * A {@link Launch} is the argv, env and cwd the host spawns (`argv[0]` is
 * `claude`; the host swaps in the resolved binary), and the one rendered form
 * the Focus pane shows and copies. The string is built once from the argv,
 * shell-quoted, with nothing elided. `--bg` is never used.
 */

export interface Launch {
  /** `claude` and its arguments, as spawned: never joined and re-split. */
  readonly argv: ReadonlyArray<string>
  /** Variables set for the process; empty for a plain, untracked terminal. */
  readonly env: Readonly<Record<string, string>>
  readonly cwd: string
  /** The argv as one shell-quoted string. */
  readonly command: string
  /** The muted `env:` line (`env: NAME=value …`), or null when there is no env. */
  readonly envLine: string | null
}

/** What every Action needs beyond its ticket. */
export interface LaunchContext {
  readonly repoRoot: string
  readonly tracker: Tracker['kind']
  /** The full path of the extension's `claude-plugin` directory. */
  readonly pluginPath: string
  /** The events file the status plugin appends to (`HERO_SYNERGY_EVENTS`). */
  readonly eventsFile: string
}

/** The command names discovery found: `/wayfinder` or `/mattpocock-skills:wayfinder`. */
export interface SkillCommands {
  readonly wayfinder: string
  readonly toSpec: string
}

export interface TicketTarget {
  readonly map: Pick<WayfinderMap, 'ref'>
  readonly ticket: Pick<Ticket, 'number' | 'title' | 'ref'>
}

const SAFE = /^[A-Za-z0-9_@%+=:,./-]+$/

/** One word for a POSIX shell: bare when it is plain, else in single quotes with embedded quotes closed and escaped. */
export function shellQuote(word: string): string {
  if (SAFE.test(word)) return word
  return `'${word.replaceAll("'", `'\\''`)}'`
}

/** The argv as one string, a space between shell-quoted words. */
export function renderCommand(argv: ReadonlyArray<string>): string {
  return argv.map(shellQuote).join(' ')
}

const renderEnv = (env: Readonly<Record<string, string>>): string | null => {
  const entries = Object.entries(env)
  if (entries.length === 0) return null
  return `env: ${entries.map(([name, value]) => `${name}=${shellQuote(value)}`).join(' ')}`
}

const launch = (
  argv: ReadonlyArray<string>,
  cwd: string,
  env: Readonly<Record<string, string>> = {},
): Launch => ({ argv, env, cwd, command: renderCommand(argv), envLine: renderEnv(env) })

/** What a launched or opened item is called on its tracker: a URL on GitHub, a repo-relative path locally. */
export const refText = (ref: Ref): string => (ref.tracker === 'github' ? ref.url : ref.path)

const sessionName = (ticket: Pick<Ticket, 'number' | 'title'>): string =>
  `#${ticket.number} ${ticket.title}`

const ticketEnv = (context: LaunchContext, ticket: Pick<Ticket, 'number'>) => ({
  HERO_SYNERGY_TICKET: String(ticket.number),
  HERO_SYNERGY_EVENTS: context.eventsFile,
})

/**
 * Work ticket: a named session in its own worktree (GitHub only; a local
 * tracker's gitignored `.scratch` would be invisible in one) with the status
 * plugin, started on the wayfinder command for this map and ticket.
 */
export function workTicket(
  context: LaunchContext,
  commands: Pick<SkillCommands, 'wayfinder'>,
  { map, ticket }: TicketTarget,
): Launch {
  return launch(
    [
      'claude',
      '-n',
      sessionName(ticket),
      ...(context.tracker === 'github' ? ['-w', String(ticket.number)] : []),
      '--plugin-dir',
      context.pluginPath,
      `${commands.wayfinder} ${refText(map.ref)} ${refText(ticket.ref)}`,
    ],
    context.repoRoot,
    ticketEnv(context, ticket),
  )
}

/** Launch fresh is the plain Work ticket line; it reopens an existing worktree. */
export const launchFresh = workTicket

/**
 * Resume by id, in a fresh terminal: the name and the plugin again, because
 * Claude Code does not restore `--plugin-dir`. `--session-id` is never passed.
 */
export function resumeById(
  context: LaunchContext,
  ticket: Pick<Ticket, 'number' | 'title'>,
  sessionId: string,
): Launch {
  return launch(
    [
      'claude',
      '--resume',
      sessionId,
      '-n',
      sessionName(ticket),
      '--plugin-dir',
      context.pluginPath,
    ],
    context.repoRoot,
    ticketEnv(context, ticket),
  )
}

/** Resume by name, for a session started by hand: the name alone, no plugin and no env. */
export function resumeByName(
  context: Pick<LaunchContext, 'repoRoot'>,
  ticket: Pick<Ticket, 'number' | 'title'>,
): Launch {
  return launch(['claude', '--resume', sessionName(ticket)], context.repoRoot)
}

/** To spec, from a finished map: the to-spec command with the map's URL or path. Plain terminal. */
export function toSpec(
  context: Pick<LaunchContext, 'repoRoot'>,
  commands: Pick<SkillCommands, 'toSpec'>,
  map: Pick<WayfinderMap, 'ref'>,
): Launch {
  return launch(['claude', `${commands.toSpec} ${refText(map.ref)}`], context.repoRoot)
}

/** Chart a map: the wayfinder command with no input; the session asks for the loose idea. Plain terminal. */
export function chartMap(
  context: Pick<LaunchContext, 'repoRoot'>,
  commands: Pick<SkillCommands, 'wayfinder'>,
): Launch {
  return launch(['claude', '-n', 'Chart a map', commands.wayfinder], context.repoRoot)
}

/** Run skill…: any discovered command by itself. Plain terminal. */
export function runSkill(context: Pick<LaunchContext, 'repoRoot'>, command: string): Launch {
  return launch(['claude', command], context.repoRoot)
}
