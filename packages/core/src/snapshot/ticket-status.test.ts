import { describe, expect, test } from 'vite-plus/test'

import { readHeaderLines } from './header-lines.ts'
import { readTicketStatus } from './ticket-status.ts'

const ticket = (header: string, rest = '') =>
  `# Pick the shelf\n\nType: task\n${header}\n\n## Question\n\nWhich shelf?\n${rest}`

const read = (header: string, rest = '') => readTicketStatus(readHeaderLines(ticket(header, rest)))

/** The reading without its Status line, which every case keeps verbatim. */
const facts = (header: string, rest = '') => {
  const { state, claim, role, warnings } = read(header, rest)
  return { state, claim, role, warnings }
}

const OPEN = { state: 'open', claim: null, role: null, warnings: [] } as const
const CLOSED = { state: 'closed', claim: null, role: null, warnings: [] } as const

describe('readTicketStatus', () => {
  describe('the first word', () => {
    test.each([
      ['Status: closed'],
      ['Status: closed (2025-07-02)'],
      ['Status: closed 2025-07-02 (reopened and re-closed after a recount)'],
      ['Status: closed (superseded 2025-07-03 — the swap moved to spring)'],
      ['Status: closed — DONE 2025-07-04 (uncommitted)'],
      ['Status: **closed 2025-07-05** (resolved — turned twice)'],
      ['Status: Closed.'],
      ['Status: done'],
      ['Status: DONE 2025-07-06 (closed)'],
      ['Status: done (implemented 2025-07-07 on the sorting branch)'],
      ['Status: resolved'],
      ['Status: resolved 2025-07-08 (closed)'],
      ['Status: RESOLVED'],
      ['**Status:** done'],
      ['**Status**: closed'],
    ])(
      'closes the ticket on closed, done or resolved, in any case, whatever follows: %s',
      (header) => {
        expect(facts(header)).toEqual(CLOSED)
      },
    )

    test.each([['Status: wontfix'], ['Status: WontFix (2025-07-09 — the shelf is gone)']])(
      'closes the ticket on wontfix, and makes wontfix its role: %s',
      (header) => {
        expect(facts(header)).toEqual({ ...CLOSED, role: 'wontfix' })
      },
    )

    test.each([
      ['Status: needs-triage', 'needs-triage'],
      ['Status: needs-info (asked the members 2025-07-10)', 'needs-info'],
      ['Status: ready-for-agent', 'ready-for-agent'],
      ['**Status:** ready-for-human', 'ready-for-human'],
      ['Status: Ready-For-Human (charted 2025-07-11 by 01 — HITL)', 'ready-for-human'],
    ] as const)(
      'leaves the ticket open on a triage role, and sets that role: %s',
      (header, role) => {
        expect(facts(header)).toEqual({ ...OPEN, role })
      },
    )

    test.each([['Status: open'], ['Status: OPEN'], ['Status: open 2025-07-12'], [''], ['Status:']])(
      'leaves the ticket open on open, an empty value or no Status line: %s',
      (header) => {
        expect(facts(header)).toEqual(OPEN)
      },
    )

    test.each([['Status: claimed'], ['Status: Claimed 2025-07-13']])(
      'reads claimed as open and claimed by nobody named: %s',
      (header) => {
        expect(facts(header)).toEqual({ ...OPEN, claim: { by: [] } })
      },
    )

    test.each([
      ['Status: in-progress'],
      ['Status: in progress 2025-07-14'],
      [
        'Status: build half DONE 2025-07-15 (uncommitted); check half OPEN (HITL — a member walks it)',
      ],
      ['Status: **07 DONE 2025-07-16**'],
      ['Status: `closed`'],
      ['Status: closed-ish'],
    ])(
      'reads any other first word as open, with a loud unknown-status whose detail is the value: %s',
      (header) => {
        const value = header.slice('Status: '.length)
        expect(facts(header)).toEqual({
          ...OPEN,
          warnings: [{ code: 'unknown-status', detail: value }],
        })
      },
    )
  })

  describe('the word after open', () => {
    test.each([
      ['Status: open — needs-triage (blocked)', 'needs-triage'],
      [
        'Status: open (ready-for-human — unblocked 2025-07-17: 01/02 all closed)',
        'ready-for-human',
      ],
      ['Status: open – needs-info', 'needs-info'],
      ['Status: open - ready-for-agent', 'ready-for-agent'],
      ['Status: open—ready-for-human', 'ready-for-human'],
      ['Status: open ( Ready-For-Agent )', 'ready-for-agent'],
      ['Status: **open — needs-triage**', 'needs-triage'],
      ['Status: open — wontfix', 'wontfix'],
    ] as const)('sets the role a dash or a parenthesis leads with: %s', (header, role) => {
      expect(facts(header)).toEqual({ ...OPEN, role })
    })

    test.each([
      ['Status: open — claimed 2025-07-18 (HITL: waiting on the roster)'],
      ['Status: open (claimed 2025-07-19, a member on it)'],
      ['Status: open - claimed'],
    ])('claims the ticket when claimed follows the dash or the parenthesis: %s', (header) => {
      expect(facts(header)).toEqual({ ...OPEN, claim: { by: [] } })
    })

    test.each([
      // Only one word is read: a claim after the role is annotation.
      ['Status: open — ready-for-human (claimed 2025-07-20, being worked)', 'ready-for-human'],
      ['Status: open 2025-07-21 — claimed', null],
      ['Status: open -claimed', null],
      ['Status: open, claimed', null],
      ['Status: open — shelved (claimed 2025-07-22)', null],
      ['Status: open (see 01 — claimed)', null],
    ] as const)('reads nothing else from the annotation: %s', (header, role) => {
      expect(facts(header)).toEqual({ ...OPEN, role })
    })

    test.each([
      ['Status: closed — claimed 2025-07-23'],
      ['Status: closed (open — needs-triage)'],
      ['Status: done (reopened — claimed, then closed)'],
    ])('never reopens, claims or sets a role after a closing word: %s', (header) => {
      expect(facts(header)).toEqual(CLOSED)
    })

    test('reads no word after a role or claimed, only after open', () => {
      expect(facts('Status: needs-info — ready-for-agent')).toEqual({ ...OPEN, role: 'needs-info' })
      expect(facts('Status: claimed — ready-for-human')).toEqual({ ...OPEN, claim: { by: [] } })
    })
  })

  describe('the role from a Labels line', () => {
    test.each([
      ['Labels: wayfinder:task, ready-for-agent', 'ready-for-agent'],
      ['Labels: `needs-info`', 'needs-info'],
      ['Labels: wayfinder:task, Ready-For-Human, ready-for-agent', 'ready-for-human'],
      ['Labels: wontfix', 'wontfix'],
    ] as const)('takes the first item that is exactly a role: %s', (header, role) => {
      expect(facts(header)).toEqual({ ...OPEN, role })
    })

    test.each([
      ['Labels: ready-for-agent (afk)'],
      ['Labels: wayfinder:ready-for-agent'],
      ['Labels: ready for agent'],
      ['Labels: wayfinder:task'],
    ])('reads no role from an item that only contains one: %s', (header) => {
      expect(facts(header)).toEqual(OPEN)
    })

    test('loses to a role on the Status line', () => {
      expect(facts('Status: open — needs-triage\nLabels: ready-for-agent')).toEqual({
        ...OPEN,
        role: 'needs-triage',
      })
      expect(facts('Status: wontfix\nLabels: ready-for-agent')).toEqual({
        ...CLOSED,
        role: 'wontfix',
      })
    })

    test('gives the role when the Status line gives none, closed, claimed or unread', () => {
      const labels = 'Labels: ready-for-human'
      expect(facts(`Status: closed\n${labels}`)).toEqual({ ...CLOSED, role: 'ready-for-human' })
      expect(facts(`Status: open — claimed\n${labels}`)).toEqual({
        ...OPEN,
        claim: { by: [] },
        role: 'ready-for-human',
      })
      expect(facts(`Status: in-progress\n${labels}`)).toEqual({
        ...OPEN,
        role: 'ready-for-human',
        warnings: [{ code: 'unknown-status', detail: 'in-progress' }],
      })
    })
  })

  describe('the Assignee line', () => {
    test.each([
      ['Assignee: wren', 'wren'],
      ['Assignee: wren (claimed 2025-07-24, wayfinder session)', 'wren'],
      ['Assignee: agent (wren) — claimed 2025-07-25', 'agent'],
      ['Assignee: agent – watering roster', 'agent'],
      ['Assignee: Wren Lee - session 2025-07-26', 'Wren Lee'],
      ['Assignee: research-subagent (2025-07-27)', 'research-subagent'],
      ['Assignee: **wren**', 'wren'],
      ['**Assignee:** wren', 'wren'],
    ])('claims an open ticket by the name before any parenthesis or dash: %s', (header, name) => {
      expect(facts(`Status: open\n${header}`)).toEqual({ ...OPEN, claim: { by: [name] } })
      expect(facts(header)).toEqual({ ...OPEN, claim: { by: [name] } })
    })

    test.each([
      ['Assignee: —'],
      ['Assignee: –'],
      ['Assignee: -'],
      ['Assignee:'],
      ['Assignee: (unclaimed)'],
      ['Assignee: — (unclaimed)'],
    ])('names nobody and claims nothing: %s', (header) => {
      expect(facts(`Status: open\n${header}`)).toEqual(OPEN)
    })

    test('names who holds a claim the Status line makes', () => {
      expect(facts('Status: claimed\nAssignee: wren')).toEqual({ ...OPEN, claim: { by: ['wren'] } })
      expect(facts('Status: open — claimed 2025-07-28\nAssignee: — (unclaimed)')).toEqual({
        ...OPEN,
        claim: { by: [] },
      })
    })

    test('claims a ticket whose Status line is unread', () => {
      expect(
        facts(
          'Status: build half DONE 2025-07-29; check half OPEN\nAssignee: wren (claimed 2025-07-29)',
        ),
      ).toEqual({
        ...OPEN,
        claim: { by: ['wren'] },
        warnings: [
          { code: 'unknown-status', detail: 'build half DONE 2025-07-29; check half OPEN' },
        ],
      })
    })

    test.each([
      ['Status: closed 2025-07-30\nAssignee: wren (claimed 2025-07-01)'],
      ['Status: done\nAssignee: agent (agent session 2025-07-02)'],
      ['Status: resolved — claimed 2025-07-03\nAssignee: wren'],
    ])('never claims a closed ticket, whatever its Assignee line says: %s', (header) => {
      expect(facts(header)).toEqual(CLOSED)
    })
  })

  describe('the Status line', () => {
    test.each([
      ['Status: open', 'open'],
      [
        'Status: **closed 2025-07-04** (resolved — the cold shelf wins)',
        '**closed 2025-07-04** (resolved — the cold shelf wins)',
      ],
      ['**Status:** ready-for-human', 'ready-for-human'],
      ['Status:   open — claimed 2025-07-05   ', 'open — claimed 2025-07-05'],
      ['Status: in-progress', 'in-progress'],
    ])('keeps the value as written, trimmed: %s', (header, line) => {
      expect(read(header).statusLine).toBe(line)
    })

    test.each([[''], ['Status:']])('is null with no Status value: %s', (header) => {
      expect(read(header).statusLine).toBeNull()
    })

    test('reads the first Status header line, and raises unknown-status for a second', () => {
      expect(read('Status: closed 2025-07-06\nStatus: open — claimed')).toEqual({
        ...CLOSED,
        statusLine: 'closed 2025-07-06',
        warnings: [
          { code: 'unknown-status', detail: 'open — claimed (a second Status line, ignored)' },
        ],
      })
      expect(read('Status: open\n**Status:** done\nstatus: wontfix')).toEqual({
        ...OPEN,
        statusLine: 'open',
        warnings: [
          { code: 'unknown-status', detail: 'done (a second Status line, ignored)' },
          { code: 'unknown-status', detail: 'wontfix (a second Status line, ignored)' },
        ],
      })
    })

    test('raises one unknown-status for an unread first line and one for a second line', () => {
      expect(read('Status: shelved\nStatus: closed').warnings).toEqual([
        { code: 'unknown-status', detail: 'shelved' },
        { code: 'unknown-status', detail: 'closed (a second Status line, ignored)' },
      ])
    })

    test('never reads a Status line after the first H2, in a fence, or quoted in inline code', () => {
      const header = '```\nStatus: closed\n```\n`Status: closed`\nNote: `Status: done` closes it'
      expect(read(header, '\nStatus: closed\nAssignee: wren\n')).toEqual({
        ...OPEN,
        statusLine: null,
      })
    })
  })
})
