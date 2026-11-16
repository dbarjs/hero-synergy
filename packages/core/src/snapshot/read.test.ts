import { describe, expect, test } from 'vite-plus/test'

import heroSynergy from '../../fixtures/snapshot/maps/hero-synergy-1.json' with { type: 'json' }
import legacyForms from '../../fixtures/snapshot/maps/legacy-forms.json' with { type: 'json' }
import { decodeSnapshot, encodeSnapshot } from './model.ts'
import { type Collected, readSnapshot } from './read.ts'

const codesOf = (item: { warnings: ReadonlyArray<{ code: string }> }): string[] =>
  item.warnings.map((warning) => warning.code)

describe("this repo's own map, recorded from the tracker", () => {
  const snapshot = readSnapshot(heroSynergy as Collected)
  const map = snapshot.maps[0]!

  test('is one map of 33 tickets in sub-issue order, nothing unmapped, no drift anywhere', () => {
    expect(snapshot.maps).toHaveLength(1)
    expect(snapshot.unmapped).toEqual([])
    expect(snapshot.warnings).toEqual([])
    expect(map.number).toBe(1)
    expect(map.title).toBe('hero-synergy v0.1.0, fully decided')
    expect(map.tickets.map((ticket) => ticket.number)).toEqual(heroSynergy.maps[0]!.children)
    expect(map.warnings).toEqual([])
    for (const ticket of map.tickets) expect(ticket.warnings).toEqual([])
  })

  test('reads the destination and the notes exactly', () => {
    expect(map.destination).toBe(
      'hero-synergy v0.1.0 fully decided: every question it depends on is resolved and every hard-to-reverse default has been challenged, so the result goes straight to `/to-spec`.\n\nThe product is the VS Code Cockpit described in [the seed](https://github.com/dbarjs/hero-synergy/blob/main/docs/seed.md#destination). Its five capabilities are the outer bound: a ticket may cut one down, but nothing is added.',
    )
    expect(map.notes?.startsWith('- **Domain.** An unofficial VS Code cockpit')).toBe(true)
    expect(map.notes?.endsWith('A claim is an assignment to him.')).toBe(true)
  })

  test('reads the 33 decisions with their numbers, titles and gists, splitting after the link', () => {
    expect(map.decisions.map((decision) => decision.number)).toEqual([
      10, 8, 9, 11, 13, 12, 2, 19, 6, 14, 3, 4, 15, 5, 17, 18, 7, 20, 16, 23, 21, 25, 24, 26, 27,
      29, 28, 30, 31, 35, 32, 34, 33,
    ])
    expect(map.decisions[0]).toEqual({
      number: 10,
      title: 'Which wayfinder conventions exist in the wild?',
      link: 'https://github.com/dbarjs/hero-synergy/issues/10',
      gist: 'three generations upstream (single file, early tracker map, current map); old forms are recognizable by headings and `Status:` lines, legacy claim labels were never released, and the tracker templates still lag behind `SKILL.md`',
    })
    // A gist that holds a colon keeps it: the split is at the first separator after the link.
    const interpret = map.decisions.find((decision) => decision.number === 16)
    expect(interpret?.gist.startsWith('no: the scout reads trackers with code only;')).toBe(true)
    expect(interpret?.gist.endsWith('0005-the-scout-reads-trackers-with-code.md))')).toBe(true)
  })

  test('reads the fog and the out-of-scope lines with the tickets they link', () => {
    expect(map.notYetSpecified).toEqual([
      {
        text: 'Nothing at the moment: every question in view is a ticket. New fog goes here as tickets resolve.',
        tickets: [],
      },
    ])
    expect(map.outOfScope.map((entry) => entry.tickets)).toEqual([
      [],
      [16],
      [21],
      [22],
      [],
      [3],
      [4],
      [17],
      [18],
      [24],
      [33, 34],
    ])
    expect(map.outOfScope[1]?.text.startsWith('**A model call anywhere in the scout')).toBe(true)
  })

  test('classifies every ticket as decided, with the gist from its own line and the last comment as the answer', () => {
    for (const ticket of map.tickets) {
      expect(ticket.state).toBe('closed')
      expect(ticket.outcome).toBe('decided')
      expect(ticket.gist).toBe(map.decisions.find((d) => d.number === ticket.number)?.gist)
      expect(ticket.claim).toEqual({ by: ['dbarjs'] })
      expect(ticket.resolution?.author).toBe('dbarjs')
      expect(ticket.ref).toEqual({
        tracker: 'github',
        url: `https://github.com/dbarjs/hero-synergy/issues/${ticket.number}`,
      })
    }
    const types = new Map(map.tickets.map((ticket) => [ticket.number, ticket.type]))
    expect(types.get(16)).toBe('prototype')
    expect(types.get(10)).toBe('research')
    expect(types.get(26)).toBe('grilling')
    expect(types.get(32)).toBe('task')
  })

  test('keeps native blockers, closed ones included, as the tracker reports them', () => {
    const interpret = map.tickets.find((ticket) => ticket.number === 16)!
    expect(interpret.blockedBy.map((blocker) => [blocker.number, blocker.state])).toEqual([
      [10, 'closed'],
      [9, 'closed'],
    ])
    expect(interpret.blockedBy[0]?.title).toBe('Which wayfinder conventions exist in the wild?')
  })

  test('is a valid snapshot that survives the JSON round trip', () => {
    expect(decodeSnapshot(encodeSnapshot(snapshot))).toEqual(snapshot)
  })
})

describe("the scout prototype's legacy forms", () => {
  const snapshot = readSnapshot(legacyForms as Collected)
  const warnings = Object.fromEntries(
    [...snapshot.maps, ...snapshot.maps.flatMap((map) => map.tickets), ...snapshot.unmapped].map(
      (item) => [item.number, codesOf(item)],
    ),
  )

  test('raise the warnings the prototype reported, one per drift point', () => {
    expect(snapshot.warnings).toEqual([])
    expect(warnings).toEqual({
      1: [
        'map-body-legacy',
        'map-no-destination',
        'decision-line-unparsed',
        'children-as-task-list',
      ],
      2: ['parent-as-part-of-line', 'blockers-as-text-line'],
      3: ['parent-as-part-of-line', 'no-question-heading'],
      4: ['parent-as-part-of-line', 'blockers-as-text-line', 'claim-legacy-label'],
      5: ['parent-as-part-of-line', 'closed-unrecorded'],
      6: ['map-body-free-form', 'map-no-destination'],
      7: ['blockers-as-text-line', 'type-as-line', 'no-question-heading'],
      8: ['closed-unrecorded'],
      9: ['parent-as-part-of-line', 'type-several'],
    })
  })

  test('place every ticket on its map through the task list, the Part of line or the native parent', () => {
    expect(snapshot.unmapped).toEqual([])
    expect(snapshot.maps.map((map) => map.tickets.map((ticket) => ticket.number))).toEqual([
      [2, 3, 4, 5, 9],
      [7, 8],
    ])
  })

  test('read what the legacy map holds and leave the rest null', () => {
    const billing = snapshot.maps[0]!
    expect(billing.destination).toBeNull()
    expect(billing.notes).toBe(
      '- Domain: invoicing for a multi-tenant SaaS. Grilling tickets use /grilling.\n- Driver: Ana.',
    )
    expect(billing.decisions).toEqual([
      {
        number: 3,
        title: 'Which database holds the ledger?',
        link: 'https://github.com/acme/legacy/issues/3',
        gist: 'Postgres, one schema per tenant',
      },
    ])
    expect(billing.notYetSpecified.map((entry) => entry.text)).toEqual([
      'How invoice numbers stay unique across tenants once #2 is settled.',
      'Retry policy for failed charges.',
    ])
    const checkout = snapshot.maps[1]!
    expect(checkout.destination).toBeNull()
    expect(checkout.notes).toBeNull()
    expect(checkout.decisions).toEqual([])
  })

  test('read the text fallbacks as plain values: blockers resolve, the legacy label claims, the line types', () => {
    const tickets = new Map(snapshot.maps.flatMap((map) => map.tickets).map((t) => [t.number, t]))
    expect(tickets.get(2)?.blockedBy.map((b) => [b.number, b.state])).toEqual([[3, 'closed']])
    expect(tickets.get(4)?.blockedBy.map((b) => [b.number, b.state])).toEqual([[2, 'open']])
    expect(tickets.get(4)?.claim).toEqual({ by: [] })
    expect(tickets.get(7)?.type).toBe('prototype')
    expect(tickets.get(9)?.type).toBeNull()
    expect(tickets.get(3)?.outcome).toBe('decided')
    expect(tickets.get(3)?.gist).toBe('Postgres, one schema per tenant')
    expect(tickets.get(5)?.outcome).toBe('unrecorded')
    expect(tickets.get(8)?.resolution?.author).toBe('ana')
  })
})

describe('a local tracker', () => {
  const effort = (number: number, slug: string, body: string) => ({
    number,
    title: null,
    ref: { tracker: 'local' as const, path: `.scratch/cockpit/issues/0${number}-${slug}.md` },
    body,
    state: null,
    labels: [],
    assignees: [],
    parent: 1,
    blockedBy: [],
    lastComment: null,
  })
  const collected: Collected = {
    tracker: { kind: 'local' },
    repoRoot: '/home/ana/cockpit',
    collectedAt: '2026-10-07T12:00:00Z',
    labels: [],
    maps: [
      {
        number: 1,
        title: null,
        ref: { tracker: 'local', path: '.scratch/cockpit/map.md' },
        body: '# Cockpit v1\n\n## Destination\n\nA cockpit.\n\n## Notes\n\n- Local.\n\n## Decisions so far\n\n- [Which database?](issues/01-which-database.md): Postgres\n\n## Not yet specified\n\n## Out of scope\n',
        children: [1, 2, 3],
      },
    ],
    tickets: [
      effort(
        1,
        'which-database',
        '# Which database?\n\nType: research\nStatus: resolved\n\n## Question\n\nWhich?\n\n## Answer\n\nPostgres.\n',
      ),
      effort(
        2,
        'refund-policy',
        '# Refund policy\n\nType: grilling\nStatus: claimed\nBlocked by: 01\n\n## Question\n\nReopen or credit note?\n',
      ),
      effort(
        3,
        'invoice-numbers',
        '# Invoice numbers\n\nType: task\nBlocked by: 02, 01\n\n## Question\n\nOne sequence per tenant?\n',
      ),
    ],
  }
  const snapshot = readSnapshot(collected)
  const map = snapshot.maps[0]!
  const tickets = new Map(map.tickets.map((ticket) => [ticket.number, ticket]))

  test('reads titles from the H1 and the convention lines without a warning', () => {
    expect(map.title).toBe('Cockpit v1')
    expect(map.warnings).toEqual([])
    expect(map.tickets.map((ticket) => ticket.title)).toEqual([
      'Which database?',
      'Refund policy',
      'Invoice numbers',
    ])
    for (const ticket of map.tickets) expect(ticket.warnings).toEqual([])
  })

  test('takes state and claim from the Status line, the type from the Type line', () => {
    expect(tickets.get(1)?.state).toBe('closed')
    expect(tickets.get(1)?.claim).toBeNull()
    expect(tickets.get(2)?.state).toBe('open')
    expect(tickets.get(2)?.claim).toEqual({ by: [] })
    expect(tickets.get(3)?.claim).toBeNull()
    expect(map.tickets.map((ticket) => ticket.type)).toEqual(['research', 'grilling', 'task'])
  })

  test('resolves Blocked by numbers against the effort, with their file refs', () => {
    expect(tickets.get(2)?.blockedBy).toEqual([
      {
        number: 1,
        title: 'Which database?',
        state: 'closed',
        ref: { tracker: 'local', path: '.scratch/cockpit/issues/01-which-database.md' },
      },
    ])
    expect(tickets.get(3)?.blockedBy.map((blocker) => blocker.number)).toEqual([2, 1])
  })

  test('takes the answer from the Answer section and the outcome from the local link', () => {
    expect(tickets.get(1)?.resolution).toEqual({ body: 'Postgres.', author: null, at: null })
    expect(tickets.get(1)?.outcome).toBe('decided')
    expect(tickets.get(1)?.gist).toBe('Postgres')
    expect(map.decisions[0]?.link).toBe('issues/01-which-database.md')
  })
})

describe('membership and order', () => {
  const url = (n: number) => `https://github.com/acme/billing/issues/${n}`
  const ticket = (number: number, over: Partial<Collected['tickets'][number]> = {}) => ({
    number,
    title: `Ticket ${number}`,
    ref: { tracker: 'github' as const, url: url(number) },
    body: `## Question\n\nWhat about ${number}?\n`,
    state: 'open' as const,
    labels: ['wayfinder:grilling'],
    assignees: [],
    parent: 1,
    blockedBy: [],
    lastComment: null,
    ...over,
  })
  const base = {
    tracker: { kind: 'github' as const, owner: 'acme', repo: 'billing' },
    repoRoot: '/home/ana/billing',
    collectedAt: '2026-10-07T12:00:00Z',
    labels: [],
  }
  const body =
    '## Destination\n\nD.\n\n## Notes\n\nN.\n\n## Decisions so far\n\n## Not yet specified\n\n## Out of scope\n'

  test('follows the map order the tracker reports, then the task list, then the number', () => {
    const snapshot = readSnapshot({
      ...base,
      maps: [
        {
          number: 1,
          title: 'M',
          ref: { tracker: 'github', url: url(1) },
          body: `${body}\n- [ ] #6\n`,
          children: [4, 2],
        },
      ],
      tickets: [ticket(2), ticket(3), ticket(4), ticket(6, { parent: null })],
    })
    expect(snapshot.maps[0]?.tickets.map((t) => t.number)).toEqual([4, 2, 6, 3])
  })

  test("the tracker's parent wins over a task list and a Part of line that name another map", () => {
    const snapshot = readSnapshot({
      ...base,
      maps: [
        {
          number: 1,
          title: 'A',
          ref: { tracker: 'github', url: url(1) },
          body: `${body}\n- [ ] #3\n`,
          children: [],
        },
        { number: 2, title: 'B', ref: { tracker: 'github', url: url(2) }, body, children: [3] },
      ],
      tickets: [ticket(3, { parent: 2, body: 'Part of #1\n\n## Question\n\nQ?\n' })],
    })
    expect(snapshot.maps.map((map) => map.tickets.map((t) => t.number))).toEqual([[], [3]])
  })

  test('a parent the collect does not hold leaves the ticket unmapped', () => {
    const snapshot = readSnapshot({
      ...base,
      maps: [
        { number: 1, title: 'A', ref: { tracker: 'github', url: url(1) }, body, children: [] },
      ],
      tickets: [ticket(3, { parent: 9 })],
    })
    expect(snapshot.unmapped.map((t) => t.number)).toEqual([3])
  })

  test('a text blocker already native is not read twice, and an unknown one is named', () => {
    const snapshot = readSnapshot({
      ...base,
      maps: [
        { number: 1, title: 'A', ref: { tracker: 'github', url: url(1) }, body, children: [2, 3] },
      ],
      tickets: [
        ticket(2, {
          body: 'Blocked by: #3, #8\n\n## Question\n\nQ?\n',
          blockedBy: [
            {
              number: 3,
              title: 'Ticket 3',
              state: 'open',
              ref: { tracker: 'github', url: url(3) },
            },
          ],
        }),
        ticket(3),
      ],
    })
    const blocked = snapshot.maps[0]?.tickets[0]
    expect(blocked?.blockedBy.map((b) => b.number)).toEqual([3])
    expect(blocked?.warnings).toEqual([
      { code: 'blockers-as-text-line' },
      { code: 'blocker-outside-map', detail: '#8 is not a ticket of any open map' },
    ])
  })

  test('on GitHub, a Status line and bold keys in a body raise none of the local codes', () => {
    const snapshot = readSnapshot({
      ...base,
      maps: [
        {
          number: 1,
          title: 'A',
          ref: { tracker: 'github', url: url(1) },
          body: `**Status:** **07 DONE 2026-10-01**\n\n${body}`,
          children: [2],
        },
      ],
      tickets: [ticket(2, { body: '**Status:** closed\n**Owner**: ana\n\n## Question\n\nQ?\n' })],
    })
    expect(snapshot.maps.map((map) => map.warnings)).toEqual([[]])
    const [read] = snapshot.maps[0]!.tickets
    expect(read).toMatchObject({ state: 'open', claim: null, type: 'grilling', warnings: [] })
  })
})
