// PROTOTYPE (#202) — the raw issues the prototype draws: this repo's real ones from fixture.json,
// plus an invented repo's worth of maps and specs so the Tree can be judged at dozens of each.
// Invented issues start at #1000 and live at example/shop; everything below #1000 is real.
import type { SessionView } from '@hero-synergy/core'

import type { WorktreeView } from '../../../src/protocol.ts'
import fixture from './fixture.json'

export interface Pr {
  readonly number: number
  readonly title: string
  readonly url: string
  readonly state: 'open' | 'merged' | 'closed'
  readonly draft: boolean
  readonly branch: string
  /** Checks on an open pull request; null when merged or unknown. */
  readonly checks: 'passing' | 'failing' | 'pending' | null
}

export interface Issue {
  readonly number: number
  readonly title: string
  readonly url: string
  readonly state: 'open' | 'closed'
  readonly createdAt: string
  readonly closedAt: string | null
  readonly body: string
  readonly labels: ReadonlyArray<string>
  readonly assignees: ReadonlyArray<string>
  readonly blockedBy: ReadonlyArray<number>
  readonly parent: number | null
  readonly children: ReadonlyArray<number>
  readonly prs: ReadonlyArray<Pr>
  readonly lastComment: { body: string; at: string; author: string | null } | null
  /** Set on everything from #1000 up. */
  readonly invented?: boolean
}

/** What the prototype fakes about a ticket: its session, its worktree, an open pull request. */
export interface Fake {
  readonly session?: SessionView
  readonly worktree?: WorktreeView
  readonly pr?: Pr
}

const minutesAgo = (minutes: number): number => Date.now() - minutes * 60_000
export const live = (status: string | null, minutes: number, needsYou = false): SessionView => ({
  kind: 'live',
  status,
  needsYou,
  since: minutesAgo(minutes),
  focusable: true,
  warning: null,
})
export const ended = (detail: string, minutes: number): SessionView => ({
  kind: 'ended',
  detail,
  since: minutesAgo(minutes),
})

// ---------------------------------------------------------------------------------------------
// Real issues.

interface RawIssue extends Omit<Issue, 'prs'> {
  readonly prs: ReadonlyArray<Omit<Pr, 'checks'> & { mergedAt: string | null }>
}
const raw = fixture as unknown as {
  readAt: string
  issues: Record<string, RawIssue>
  openPullRequests: ReadonlyArray<{
    number: number
    title: string
    url: string
    branch: string
    draft: boolean
    checks: 'passing' | 'failing' | 'pending'
  }>
}

export const readAt = raw.readAt

export const realIssues: ReadonlyArray<Issue> = Object.values(raw.issues).map((issue) => ({
  ...issue,
  prs: issue.prs.map((pr) => ({ ...pr, checks: null })),
}))

/** Open pull requests on real `worktree-<n>` branches, by ticket number. */
export const realOpenPrs = new Map<number, Pr>(
  raw.openPullRequests
    .filter((pr) => /^worktree-\d+$/.test(pr.branch))
    .map((pr) => [
      Number(pr.branch.slice('worktree-'.length)),
      { ...pr, state: 'open' as const, checks: pr.checks },
    ]),
)

/** The real sessions are not readable from here: these stand in for what a live Cockpit would show. */
export const realFakes: Record<number, Fake> = {
  171: {
    session: live('working', 25),
    worktree: { branch: 'worktree-171', uncommitted: 3, ahead: 2 },
  },
  198: { session: live('working', 6) },
  199: { session: live('working', 11) },
  200: { session: live('waiting for you', 3, true) },
  201: {
    session: ended('exit 0', 40),
    worktree: { branch: 'worktree-201', uncommitted: 0, ahead: 1 },
  },
  202: {
    session: live('working', 1),
    worktree: { branch: 'worktree-202', uncommitted: 9, ahead: 0 },
  },
}

// ---------------------------------------------------------------------------------------------
// The invented repo.

const REPO = 'https://github.com/example/shop/issues'
const CREATED = '2026-09-01T09:00:00Z'
let next = 1000
const invented: Issue[] = []
export const inventedFakes: Record<number, Fake> = {}

let seed = 11
const random = (): number => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const pick = <T>(list: ReadonlyArray<T>): T => list[Math.floor(random() * list.length)]!

const DECISION_TITLES = [
  'Which provider do we build on?',
  'What does the data model look like?',
  'How do existing records migrate?',
  'Which cases are out of scope for the first version?',
  'What does the API return on partial failure?',
  'How is it rolled out, and to whom first?',
  'What do the vendor docs say about rate limits?',
  'Which screens change, and how?',
  'Who owns it after launch?',
  'How is it tested end to end?',
  'Which metrics tell us it worked?',
  'What happens to in-flight requests during the switch?',
]
const TYPES = ['grilling', 'grilling', 'grilling', 'research', 'research', 'prototype', 'task']

const ROLES = ['a shopper', 'a store admin', 'a support agent', 'a finance lead', 'a developer']
const WANTS = [
  ['see what changed since my last visit', 'I do not miss anything'],
  ['undo the last change', 'a mistake costs me nothing'],
  ['export the list as CSV', 'I can work on it elsewhere'],
  ['get a notice when it fails', 'I can act before customers notice'],
  ['filter by date and status', 'I find the one I need'],
  ['set it up without asking engineering', 'I am not blocked'],
  ['see who changed it and when', 'I can answer questions about it'],
  ['keep my old settings after the switch', 'nothing breaks for me'],
]

const specBody = (title: string, map: Issue | null, stories: number): string => {
  const from = map
    ? `From the map [#${map.number} ${map.title}](${map.url}). Every decision below was settled there.`
    : 'From a `/grill-with-docs` session; there is no map.'
  const storyLines = Array.from({ length: stories }, (_, index) => {
    const [want, why] = WANTS[index % WANTS.length]!
    return `${index + 1}. As ${ROLES[index % ROLES.length]}, I want to ${want}, so that ${why}.`
  }).join('\n')
  return `${from}

## Problem Statement

${title.replace(/^Spec: /, '')} is the thing customers ask for most, and today it is done by hand. Support spends hours on it every week, and mistakes reach customers.

## Solution

Build it into the product, behind a flag, with the rollout decided on the map. The first version covers the cases the map kept in scope and nothing more.

## User Stories

${storyLines}

## Implementation Decisions

- The data lives in its own table, keyed by account.
- Every write goes through one service, which emits an event.
- The UI reads the events, never the table.

## Testing Decisions

- One integration test per user story, against a seeded database.
- The migration runs in CI against last month's snapshot.

## Out of Scope

- Bulk editing.
- A public API for it.

## Further Notes

Invented spec: the text is filler so the Detail can be judged at its real length.`
}

const buildBody = (
  spec: number,
  what: string,
  criteria: number,
  ticked: number,
  blockedBy: number[],
) =>
  `## Parent

#${spec}

## What to build

${what} End to end: the table, the service, the screen, and the tests that pin it.

## Acceptance criteria

${Array.from(
  { length: criteria },
  (_, index) =>
    `- [${index < ticked ? 'x' : ' '}] ${pick(['The happy path', 'An empty account', 'A failure', 'A retry', 'A migrated record', 'The permission check'])} is covered by a test`,
).join('\n')}

## Blocked by

${blockedBy.length === 0 ? 'None — can start immediately' : blockedBy.map((n) => `- #${n}`).join('\n')}`

const issue = (fields: Partial<Issue> & Pick<Issue, 'number' | 'title'>): Issue => {
  const made: Issue = {
    url: `${REPO}/${fields.number}`,
    state: 'open',
    createdAt: CREATED,
    closedAt: null,
    body: '',
    labels: [],
    assignees: [],
    blockedBy: [],
    parent: null,
    children: [],
    prs: [],
    lastComment: null,
    invented: true,
    ...fields,
  }
  invented.push(made)
  return made
}

type OpenTicket = [title: string, type: string, claimed: boolean, blockedBy: number[]]

interface MapPlan {
  title: string
  destination: string
  decided: number
  open?: OpenTicket[]
  fog?: string[]
}

const inventMap = (plan: MapPlan): Issue => {
  const number = next++
  const children: number[] = []
  const gists: string[] = []
  for (let index = 0; index < plan.decided; index++) {
    const n = next++
    const title = DECISION_TITLES[index % DECISION_TITLES.length]!
    children.push(n)
    gists.push(`- [${title}](${REPO}/${n}): decided (invented map, no detail).`)
    issue({
      number: n,
      title,
      state: 'closed',
      closedAt: CREATED,
      labels: [`wayfinder:${pick(TYPES)}`],
      assignees: ['dbarjs'],
      parent: number,
      body: `## Question\n\n${title}`,
      lastComment: { body: '## Answer\n\nDecided (invented).', at: CREATED, author: 'dbarjs' },
    })
  }
  const first = next
  for (const [title, type, claimed, blockedBy] of plan.open ?? []) {
    const n = next++
    children.push(n)
    issue({
      number: n,
      title,
      labels: [`wayfinder:${type}`],
      assignees: claimed ? ['dbarjs'] : [],
      blockedBy: blockedBy.map((index) => first + index),
      parent: number,
      body: `## Question\n\n${title}`,
    })
    if (claimed)
      inventedFakes[n] = { session: live(pick(['working', 'working', 'waiting for you']), 14) }
  }
  return issue({
    number,
    title: plan.title,
    labels: ['wayfinder:map'],
    children,
    body: `## Destination\n\n${plan.destination}\n\n## Notes\n\nInvented map.\n\n## Decisions so far\n\n${gists.join('\n')}\n\n## Not yet specified\n\n${(plan.fog ?? []).map((text) => `- **${text}.** Too vague to ticket yet.`).join('\n')}\n\n## Out of scope\n\n- Anything past the destination.`,
  })
}

interface BuildPlan {
  title: string
  role?: 'ready-for-agent' | 'ready-for-human' | 'needs-info'
  closed?: boolean
  claimed?: boolean
  blockedBy?: number[]
  fake?: Fake
  criteria?: number
  ticked?: number
}

interface SpecPlan {
  title: string
  map: Issue | null
  stories: number
  tickets: BuildPlan[]
  closed?: boolean
}

const inventSpec = (plan: SpecPlan): Issue => {
  const number = next++
  const first = next
  const children: number[] = []
  for (const ticket of plan.tickets) {
    const n = next++
    const blockedBy = (ticket.blockedBy ?? []).map((index) => first + index)
    children.push(n)
    issue({
      number: n,
      title: ticket.title,
      state: ticket.closed ? 'closed' : 'open',
      closedAt: ticket.closed ? CREATED : null,
      labels: [ticket.role ?? 'ready-for-agent'],
      assignees: ticket.claimed || ticket.closed ? ['dbarjs'] : [],
      blockedBy,
      parent: number,
      body: buildBody(number, ticket.title, ticket.criteria ?? 5, ticket.ticked ?? 0, blockedBy),
      prs: ticket.closed
        ? [
            {
              number: 4000 + n,
              title: ticket.title,
              url: `https://github.com/example/shop/pull/${4000 + n}`,
              state: 'merged',
              draft: false,
              branch: `worktree-${n}`,
              checks: null,
            },
          ]
        : [],
    })
    if (ticket.fake) inventedFakes[n] = ticket.fake
  }
  return issue({
    number,
    title: plan.title,
    state: plan.closed ? 'closed' : 'open',
    closedAt: plan.closed ? CREATED : null,
    labels: ['ready-for-agent'],
    children,
    body: specBody(plan.title, plan.map, plan.stories),
  })
}

const openPr = (n: number, checks: Pr['checks'], draft = false): Pr => ({
  number: 4000 + n,
  title: 'invented pull request',
  url: `https://github.com/example/shop/pull/${4000 + n}`,
  state: 'open',
  draft,
  branch: `worktree-${n}`,
  checks,
})

// Active maps, still deciding.
inventMap({
  title: 'Search relevance overhaul, decided',
  destination: 'A ranking approach chosen and its rollout decided.',
  decided: 4,
  open: [
    ['Does the reranker beat BM25 on our own queries?', 'prototype', true, []],
    ['Which index layout does the winner need?', 'grilling', false, [0]],
    ['How do we backfill embeddings without downtime?', 'grilling', false, [0]],
  ],
  fog: ['Synonyms and typo tolerance'],
})
inventMap({
  title: 'Billing data migration plan',
  destination: 'A cutover plan for billing data that finance has signed off.',
  decided: 11,
  open: [
    ['Which invoices are in scope for the first cutover?', 'grilling', false, []],
    ['Does the vendor API allow bulk imports with original dates?', 'research', true, []],
    ['What is the rollback point?', 'grilling', false, []],
    ['How long is the dual-write window?', 'grilling', false, [2]],
  ],
  fog: ['Reconciliation reports', 'Tax recalculation'],
})
inventMap({
  title: 'Checkout v2, ready to spec',
  destination: 'Checkout v2 decided end to end, ready for /to-spec.',
  decided: 12,
  open: [['Do saved cards survive the provider switch?', 'research', false, []]],
})

// Finished maps with no spec yet: To spec is the next step.
const invites = inventMap({
  title: 'Team invites, fully decided',
  destination: 'Invites by link and by email decided, ready for /to-spec.',
  decided: 9,
})
void invites
inventMap({
  title: 'Audit log export, decided',
  destination: 'What the export holds and who may run it.',
  decided: 6,
})

// Finished maps whose spec is being built, in each state a spec can be in.
const notifications = inventMap({
  title: 'Notifications rework, fully decided',
  destination: 'One notification service, its channels and its preferences decided.',
  decided: 14,
})
inventSpec({
  title: 'Spec: Notifications rework',
  map: notifications,
  stories: 48,
  tickets: [
    { title: 'Move every notification behind one service', closed: true, criteria: 6 },
    { title: 'Store preferences per channel', closed: true, criteria: 5, ticked: 5 },
    { title: 'Send email through the new service', closed: true },
    {
      title: 'Send push through the new service',
      claimed: true,
      blockedBy: [0],
      fake: {
        session: live('waiting for you', 4, true),
        worktree: { branch: 'worktree-1043', uncommitted: 5, ahead: 3 },
      },
    },
    {
      title: 'Show the preferences screen',
      claimed: true,
      blockedBy: [1],
      fake: {
        session: ended('exit 0', 55),
        worktree: { branch: 'worktree-1044', uncommitted: 0, ahead: 4 },
        pr: openPr(1044, 'failing'),
      },
    },
    { title: 'Digest emails for low-priority events', blockedBy: [0] },
    { title: 'Quiet hours', role: 'ready-for-human', blockedBy: [1] },
    { title: 'Retire the old mailer', blockedBy: [2, 3] },
    { title: 'Document the service for other teams', role: 'needs-info' },
  ],
})

const pricing = inventMap({
  title: 'Usage-based pricing, decided',
  destination: 'Metering, plans and invoices for usage-based pricing decided.',
  decided: 18,
})
inventSpec({ title: 'Spec: Usage-based pricing', map: pricing, stories: 61, tickets: [] })

const roles = inventMap({
  title: 'Admin roles and permissions, decided',
  destination: 'Roles, their permissions and the migration of existing admins.',
  decided: 10,
})
inventSpec({
  title: 'Spec: Admin roles and permissions',
  map: roles,
  stories: 33,
  tickets: [
    { title: 'Model roles and permissions', closed: true },
    {
      title: 'Check permissions on every admin endpoint',
      claimed: true,
      blockedBy: [0],
      fake: {
        session: live('needs approval', 2, true),
        worktree: { branch: 'worktree-1062', uncommitted: 2, ahead: 0 },
      },
    },
    { title: 'Migrate existing admins to the owner role', blockedBy: [1] },
    { title: 'Show roles on the team screen', blockedBy: [1] },
  ],
})

const webhooks = inventMap({
  title: 'Webhooks v2, decided',
  destination: 'Signed, retried, replayable webhooks decided.',
  decided: 8,
})
inventSpec({
  title: 'Spec: Webhooks v2',
  map: webhooks,
  stories: 22,
  tickets: [
    { title: 'Sign every webhook', closed: true },
    { title: 'Retry with backoff', closed: true },
    { title: 'Replay from the dashboard', closed: true },
    {
      title: 'Show delivery history',
      closed: true,
      fake: { pr: { ...openPr(1074, null), state: 'merged' }, session: ended('exit 0', 30) },
    },
  ],
})

// Specs with no map: an idea small enough for /grill-with-docs.
inventSpec({
  title: 'Dark mode for the storefront',
  map: null,
  stories: 12,
  tickets: [
    { title: 'Theme tokens for both schemes', closed: true },
    { title: 'Switch on the system setting', blockedBy: [0] },
    { title: 'A toggle in the account menu', blockedBy: [0], role: 'ready-for-human' },
  ],
})
inventSpec({ title: 'Rate-limit the public API', map: null, stories: 9, tickets: [] })

// The long tail: maps finished and built long ago, their specs closed. Eduardo's repos hold dozens.
const DONE = [
  'Guest checkout',
  'Gift cards',
  'Order history redesign',
  'Inventory sync with the warehouse',
  'Address autocomplete',
  'Two-factor sign-in',
  'Store credit',
  'Product reviews moderation',
  'Shipping rate cards',
  'Returns portal',
  'Coupon stacking rules',
  'Abandoned cart emails',
  'Wishlist sharing',
  'Bulk product import',
  'Multi-currency prices',
  'Tax exemptions',
  'Customer segments',
  'Loyalty points',
  'Subscription boxes',
  'Image CDN migration',
  'Search autocomplete',
  'Store locator',
  'Back-in-stock alerts',
  'Fraud screening',
  'Invoice PDFs',
  'Staff accounts',
]
for (const title of DONE) {
  const map = inventMap({
    title: `${title}, fully decided`,
    destination: `${title} decided.`,
    decided: 3 + Math.floor(random() * 12),
  })
  inventSpec({
    title: `Spec: ${title}`,
    map,
    stories: 20,
    closed: true,
    tickets: [{ title: `Build ${title.toLowerCase()}`, closed: true }],
  })
}

export const inventedIssues: ReadonlyArray<Issue> = invented
