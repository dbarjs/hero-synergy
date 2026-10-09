import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

/**
 * The demo workspace the capture run opens: one map on the local tracker that reads like real work,
 * with decisions, a frontier, two blocked tickets and some fog. The tickets the sessions sit on are
 * named here, so the run and its tests agree on them.
 */

export interface DemoTicket {
  readonly number: number
  readonly slug: string
  readonly title: string
  readonly type: 'research' | 'prototype' | 'grilling' | 'task'
  readonly status?: 'claimed' | 'resolved'
  readonly blockedBy?: ReadonlyArray<number>
  readonly question: string
  /** The answer of a resolved ticket, which is also its gist in the map's Decisions so far. */
  readonly answer?: string
}

export const DEMO_MAP = {
  slug: 'docs-search',
  title: 'Docs search',
  destination:
    'Search for the docs site that answers in under 100 ms on a phone, specced and ready for `/to-spec`.',
  notes: [
    'Domain: the static docs site, built and deployed by CI. No server of our own.',
    'Research tickets save their findings under `docs/research/`. Prototypes use `/prototype`.',
  ],
  fog: [
    'What people search for and do not find, once ranking is settled.',
    'Search inside code samples: whether it helps or only adds noise.',
  ],
  outOfScope: ['A hosted search service: the site stays static.'],
} as const

export const DEMO_TICKETS: ReadonlyArray<DemoTicket> = [
  {
    number: 1,
    slug: 'index-engine',
    title: 'Index engine',
    type: 'research',
    status: 'resolved',
    question: 'Which client-side index fits a static site of 1,200 pages?',
    answer: 'Pagefind: a static index split into chunks, no server to run',
  },
  {
    number: 2,
    slug: 'index-build',
    title: 'When the index is built',
    type: 'grilling',
    status: 'resolved',
    blockedBy: [1],
    question: 'Is the index built on every deploy, nightly, or by hand?',
    answer: 'On every deploy, in the same CI job as the site',
  },
  {
    number: 3,
    slug: 'result-shape',
    title: 'What a result shows',
    type: 'prototype',
    status: 'resolved',
    question: 'What does one search result show, and in what order?',
    answer: 'Page title, section heading, then a two-line snippet with the match marked',
  },
  {
    number: 4,
    slug: 'search-scope',
    title: 'Search scope',
    type: 'grilling',
    status: 'resolved',
    question: 'Does search cover every docs version, or only the one being read?',
    answer: 'The version being read; each older version keeps its own index',
  },
  {
    number: 5,
    slug: 'ranking-signals',
    title: 'Ranking signals',
    type: 'grilling',
    status: 'claimed',
    blockedBy: [1],
    question: 'Which signals rank a result: title match, heading depth, page views?',
  },
  {
    number: 6,
    slug: 'keyboard-shortcut',
    title: 'Keyboard shortcut',
    type: 'prototype',
    status: 'claimed',
    question: 'Which key opens search, and what does it do while focus is in a code block?',
  },
  {
    number: 7,
    slug: 'index-size',
    title: 'Measure the index',
    type: 'task',
    status: 'claimed',
    blockedBy: [1, 2],
    question: 'Build the index for the real docs and record its size and the chunk count.',
  },
  {
    number: 8,
    slug: 'typo-tolerance',
    title: 'Typo tolerance',
    type: 'research',
    blockedBy: [1],
    question: 'How does Pagefind handle typos, and what does a fuzzy match cost on a phone?',
  },
  {
    number: 9,
    slug: 'mobile-layout',
    title: 'Search on a phone',
    type: 'prototype',
    blockedBy: [3],
    question: 'Does search open as a full-screen sheet or drop down under the header?',
  },
  {
    number: 10,
    slug: 'query-syntax',
    title: 'Query syntax',
    type: 'grilling',
    blockedBy: [5],
    question: 'Do quotes, `-exclusions` or `in:api` filters belong in the first release?',
  },
  {
    number: 11,
    slug: 'empty-results',
    title: 'No results page',
    type: 'prototype',
    blockedBy: [9, 10],
    question: 'What does the page say and offer when nothing matches?',
  },
]

/** The ticket ▶ launches in the loop, and the ones the sessions sit on in every shot. */
export const SCENE = {
  launched: 8,
  ended: 9,
  working: 5,
  approval: 6,
  waiting: 7,
  /** The ticket whose Detail shows both columns of its neighbourhood. */
  neighbourhood: 10,
} as const

export function ticketById(number: number): DemoTicket {
  const ticket = DEMO_TICKETS.find((candidate) => candidate.number === number)
  if (ticket === undefined) throw new Error(`No demo ticket #${number}`)
  return ticket
}

/** `#<number> <title>`, the name the Cockpit gives a ticket's session and its terminal. */
export function sessionName(number: number): string {
  return `#${number} ${ticketById(number).title}`
}

const pad = (number: number): string => String(number).padStart(2, '0')

export function ticketPath(ticket: DemoTicket): string {
  return `issues/${pad(ticket.number)}-${ticket.slug}.md`
}

/** A ticket file in the local tracker's form: title, `Type:`, `Status:`, `Blocked by:`, question, answer. */
export function ticketFile(ticket: DemoTicket): string {
  const lines = [`# ${ticket.title}`, '', `Type: ${ticket.type}`]
  if (ticket.status !== undefined) lines.push(`Status: ${ticket.status}`)
  if (ticket.blockedBy !== undefined && ticket.blockedBy.length > 0) {
    lines.push(`Blocked by: ${ticket.blockedBy.map(pad).join(', ')}`)
  }
  lines.push('', '## Question', '', ticket.question, '')
  if (ticket.answer !== undefined) lines.push('## Answer', '', `${ticket.answer}.`, '')
  return lines.join('\n')
}

/** The map file: Destination, Notes, Decisions so far (one line per resolved ticket), fog, out of scope. */
export function mapFile(tickets: ReadonlyArray<DemoTicket> = DEMO_TICKETS): string {
  const decisions = tickets
    .filter((ticket) => ticket.status === 'resolved')
    .map((ticket) => `- [${ticket.title}](${ticketPath(ticket)}) — ${ticket.answer ?? ''}`)
  const list = (items: ReadonlyArray<string>) => items.map((item) => `- ${item}`)
  return [
    `# ${DEMO_MAP.title}`,
    '',
    '## Destination',
    '',
    DEMO_MAP.destination,
    '',
    '## Notes',
    '',
    ...list(DEMO_MAP.notes),
    '',
    '## Decisions so far',
    '',
    ...decisions,
    '',
    '## Not yet specified',
    '',
    ...list(DEMO_MAP.fog),
    '',
    '## Out of scope',
    '',
    ...list(DEMO_MAP.outOfScope),
    '',
  ].join('\n')
}

const FIXTURES = path.join(import.meta.dirname, '../fixtures')

/**
 * Writes the demo repo into `parent/workspace` and returns its path: the local tracker doc the
 * fixture workspace carries, the wayfinder skill the launch checks for, the map, and a git repo of
 * its own so the scout does not resolve it to this repo.
 */
export function createDemoWorkspace(parent: string): string {
  const workspace = path.join(parent, 'workspace')
  const agents = path.join(workspace, 'docs', 'agents')
  mkdirSync(agents, { recursive: true })
  cpSync(
    path.join(FIXTURES, 'workspace/docs/agents/issue-tracker.md'),
    path.join(agents, 'issue-tracker.md'),
  )
  const skill = path.join(workspace, '.claude', 'skills', 'wayfinder')
  mkdirSync(skill, { recursive: true })
  writeFileSync(
    path.join(skill, 'SKILL.md'),
    '---\nname: wayfinder\ndescription: Plan a map.\ndisable-model-invocation: true\n---\n# Wayfinder\n',
  )
  writeFileSync(path.join(workspace, 'README.md'), '# Docs\n\nThe documentation site.\n')
  const effort = path.join(workspace, '.scratch', DEMO_MAP.slug)
  mkdirSync(path.join(effort, 'issues'), { recursive: true })
  writeFileSync(path.join(effort, 'map.md'), mapFile())
  for (const ticket of DEMO_TICKETS) {
    writeFileSync(path.join(effort, ticketPath(ticket)), ticketFile(ticket))
  }
  execFileSync('git', ['init', '--quiet', '--initial-branch=main', workspace])
  // Committed, so Source Control shows no badge and the status bar no dirty branch. A throwaway
  // repo in a temp dir: its one commit carries a demo identity and no signature.
  const git = (...args: string[]) =>
    execFileSync('git', [
      '-C',
      workspace,
      '-c',
      'user.name=Demo',
      '-c',
      'user.email=demo@example.com',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ])
  git('add', '--all')
  git('commit', '--quiet', '--message', 'Docs search map')
  return workspace
}

/** A live session as Claude Code's registry lists it: by `claude agents --json`. */
export interface RegistryEntry {
  readonly pid: number
  readonly cwd: string
  readonly kind: 'interactive'
  readonly startedAt: number
  readonly sessionId: string
  readonly name: string
  readonly status: 'busy' | 'idle' | 'waiting'
  readonly waitingFor?: string
}

export type ShownStatus = 'working' | 'waiting for you' | 'needs approval'

/** The registry's words for each status the Tree shows. */
const REGISTRY_STATUS: Record<ShownStatus, Pick<RegistryEntry, 'status' | 'waitingFor'>> = {
  working: { status: 'busy' },
  'waiting for you': { status: 'idle' },
  'needs approval': { status: 'waiting', waitingFor: 'permission prompt' },
}

/**
 * The registry for these sessions, one entry per ticket, named `#<number> <title>` like a session
 * the Cockpit launched. `startedAt` sets each session apart; `sessionId` is the stub's for the
 * ticket ▶ launched, so the registry's word reaches the session that has a terminal.
 */
export function registryEntries(
  cwd: string,
  sessions: ReadonlyArray<{
    readonly ticket: number
    readonly status: ShownStatus
    readonly sessionId?: string
  }>,
  startedAt: number,
): RegistryEntry[] {
  return sessions.map(({ ticket, status, sessionId }) => ({
    pid: 4200 + ticket,
    cwd,
    kind: 'interactive',
    startedAt: startedAt - ticket * 60_000,
    sessionId: sessionId ?? `demo-${ticket}`,
    name: sessionName(ticket),
    ...REGISTRY_STATUS[status],
  }))
}

/** Claims a ticket in the demo workspace the way a session's first step does: `Status: claimed`. */
export function claimTicket(workspace: string, number: number): void {
  const ticket = ticketById(number)
  const file = path.join(workspace, '.scratch', DEMO_MAP.slug, ticketPath(ticket))
  writeFileSync(file, ticketFile({ ...ticket, status: 'claimed' }))
}
