// PROTOTYPE — a repo with 45 maps, 38 of them finished. Only this repo's own map is real; the
// other 44 are invented so the many-maps variants can be judged at Eduardo's usual scale.
import type { MapData, Ticket } from './data.ts'
import { fixture } from './map-fixture.ts'

const REPO = 'https://github.com/example/shop/issues'
let nextNumber = 1000

// Small seeded generator, so the invented maps are the same on every reload.
let seed = 7
function random(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const pick = <T>(list: T[]): T => list[Math.floor(random() * list.length)]!

const TYPES = ['grilling', 'grilling', 'grilling', 'research', 'research', 'prototype', 'task']
const CLOSED_TITLES = [
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
  'What happens to in-flight requests during the switch?',
  'Which metrics tell us it worked?',
]

type OpenSpec = [title: string, type: string, claimed: boolean, blockedBy: number[]]
type FogSpec = [title: string, waitsOn: number[]]
interface Spec {
  title: string
  destination: string
  closed: number
  open?: OpenSpec[]
  fog?: FogSpec[]
  finishedDays?: number
}

function build(spec: Spec): MapData {
  const number = nextNumber++
  const closed: Ticket[] = Array.from({ length: spec.closed }, (_, i) => {
    const n = nextNumber++
    return {
      number: n,
      title: CLOSED_TITLES[i % CLOSED_TITLES.length]!,
      url: `${REPO}/${n}`,
      state: 'CLOSED',
      type: pick(TYPES),
      assignee: 'dbarjs',
      blockedBy: [],
      question: '',
      gist: 'decided (invented map, no detail)',
    }
  })
  const first = nextNumber
  const open: Ticket[] = (spec.open ?? []).map(([title, type, isClaimed, blockedBy]) => {
    const n = nextNumber++
    return {
      number: n,
      title,
      url: `${REPO}/${n}`,
      state: 'OPEN',
      type,
      assignee: isClaimed ? 'dbarjs' : null,
      blockedBy: blockedBy.map((i) => first + i),
      question: title,
      gist: null,
    }
  })
  return {
    number,
    title: spec.title,
    url: `${REPO}/${number}`,
    destination: spec.destination,
    tickets: [...closed, ...open],
    fog: (spec.fog ?? []).map(([title, waitsOn]) => ({
      title,
      text: 'Too vague to ticket yet (invented map).',
      waitsOn: waitsOn.map((i) => first + i),
    })),
    outOfScope: [],
    finishedDays: spec.finishedDays,
  }
}

// Six invented active maps, each a state the Cockpit must show well.
const ACTIVE: Spec[] = [
  {
    // Nearly there: one ticket left.
    title: 'Checkout v2, ready to spec',
    destination: 'Checkout v2 decided end to end, ready for /to-spec.',
    closed: 13,
    open: [['Do saved cards survive the provider switch?', 'research', false, []]],
  },
  {
    // Stuck: nothing takeable, everything waits on one session.
    title: 'Search relevance overhaul, decided',
    destination: 'A ranking approach chosen and its rollout decided.',
    closed: 4,
    open: [
      ['Does the reranker beat BM25 on our own queries?', 'prototype', true, []],
      ['Which index layout does the winner need?', 'grilling', false, [0]],
      ['How do we backfill embeddings without downtime?', 'grilling', false, [0]],
      ['What is the latency budget per query?', 'grilling', false, [0]],
      ['How is the rollout staged?', 'grilling', false, [1, 2]],
    ],
    fog: [
      ['Synonyms and typo tolerance', [1]],
      ['Relevance metrics in production', [4]],
    ],
  },
  {
    // Early: more fog than tickets.
    title: 'Mobile offline mode, fully decided',
    destination: 'Offline mode scoped and its sync model decided.',
    closed: 0,
    open: [
      ['Which screens must work offline?', 'grilling', false, []],
      ['What do the platform storage limits allow?', 'research', true, []],
      ['Is last-write-wins acceptable for carts?', 'grilling', false, []],
      ['Which sync engine?', 'grilling', false, [1, 2]],
    ],
    fog: [
      ['Conflict resolution UI', [3]],
      ['Background sync on iOS', [1]],
      ['Encryption at rest', [3]],
      ['Offline analytics', [0]],
      ['Migration of existing installs', [3]],
    ],
  },
  {
    // Large and busy.
    title: 'Billing data migration plan',
    destination: 'A cutover plan for billing data that finance has signed off.',
    closed: 17,
    open: [
      ['Which invoices are in scope for the first cutover?', 'grilling', false, []],
      ['How are credits and refunds represented in the new ledger?', 'grilling', true, []],
      ['Does the vendor API allow bulk imports with original dates?', 'research', false, []],
      ['What is the rollback point?', 'grilling', false, []],
      ['Provision a sandbox ledger with last year’s data', 'task', true, []],
      ['Which reconciliation report does finance trust?', 'grilling', false, []],
      ['How is tax recalculated for migrated invoices?', 'grilling', false, [1]],
      ['How long is the dual-write window?', 'grilling', false, [3]],
      ['What does a dry run look like?', 'prototype', false, [4]],
      ['Which customers move first?', 'grilling', false, [0, 3]],
      ['How are failures surfaced to support?', 'grilling', false, [8]],
    ],
    fog: [
      ['Archiving the old system', [7]],
      ['Audit trail requirements', [5]],
      ['Currency rounding differences', [6]],
    ],
  },
  {
    title: 'Permissions model, decided',
    destination: 'Roles, scopes and their storage decided.',
    closed: 8,
    open: [
      ['Are permissions per workspace or per project?', 'grilling', false, []],
      ['How do API keys inherit scopes?', 'grilling', false, []],
      ['How are existing admins migrated?', 'grilling', false, [0]],
    ],
    fog: [['Audit log of permission changes', [0]]],
  },
  {
    // Freshly charted: no decisions yet.
    title: 'Onboarding email sequence, outlined',
    destination: 'An outline of the onboarding emails, with triggers decided.',
    closed: 0,
    open: [
      ['Which moments in the first week deserve an email?', 'grilling', false, []],
      ['What do competitors send?', 'research', false, []],
      ['What does the first email look like?', 'prototype', false, []],
      ['Which events trigger each email?', 'grilling', false, [0]],
      ['How is the sequence measured?', 'grilling', false, [0]],
      ['Who writes the copy?', 'grilling', false, [2]],
    ],
    fog: [
      ['Localization', [5]],
      ['Unsubscribe and preferences', [3]],
    ],
  },
]

const FINISHED_TITLES = [
  'Auth provider switch',
  'Product page redesign',
  'Inventory sync with the warehouse',
  'Shipping rate calculator',
  'Returns flow',
  'Gift cards',
  'Coupon engine rewrite',
  'Order history export',
  'Guest checkout',
  'Tax handling for the EU',
  'Image pipeline',
  'Review moderation',
  'Wishlist',
  'Abandoned cart emails',
  'Admin audit log',
  'Rate limiting',
  'Webhook delivery guarantees',
  'Multi-currency pricing',
  'Search filters',
  'Customer support inbox',
  'Feature flag cleanup',
  'CI speedup',
  'Monorepo split',
  'Error reporting',
  'Analytics events taxonomy',
  'Accessibility audit fixes',
  'Dark mode',
  'Address validation',
  'Subscription pause and resume',
  'Stock alerts',
  'Bundle products',
  'Affiliate links',
  'Invoice PDFs',
  'Two-factor authentication',
  'Data retention policy',
  'Staging environment rebuild',
  'Design tokens',
  'Cache invalidation strategy',
]
const FINISHED: Spec[] = FINISHED_TITLES.map((title, i) => ({
  title: `${title}, decided`,
  destination: `${title}: every open question resolved.`,
  closed: 4 + Math.floor(random() * 19),
  finishedDays: 3 + i * 9 + Math.floor(random() * 6),
}))

/** Tracker order: the real map first, as the newest; invented ones after it. */
export const allMaps: MapData[] = [fixture, ...ACTIVE.map(build), ...FINISHED.map(build)]
export const realMap: MapData = fixture
