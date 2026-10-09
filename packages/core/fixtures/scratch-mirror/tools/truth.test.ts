import { describe, expect, it } from '@effect/vitest'

import {
  assignee,
  decisions,
  headerLines,
  mapClosed,
  referencedTickets,
  resolution,
  splitItems,
  triageRole,
  typeAndMode,
} from './truth.ts'

const header = (...lines: string[]) => headerLines(lines.join('\n'))

describe('headerLines', () => {
  it('reads plain, bold and listed keys before the first H2, the first of each, outside fences', () => {
    const read = header(
      '# Ledger',
      'Status: closed',
      '**Blocked by:** 03',
      '- Map: [Ledger](../MAP.md)',
      'Status: open',
      '```',
      'Type: task',
      '```',
      '## Question',
      'Type: task',
    )
    expect(Object.fromEntries(read)).toEqual({
      status: 'closed',
      'blocked by': '03',
      map: '[Ledger](../MAP.md)',
    })
  })
})

describe('triageRole', () => {
  it('reads the role leading a Status line, after `open —` or `open (`, or on Labels', () => {
    expect(triageRole(header('Status: ready-for-human (charted 2026-01-02)'))).toBe(
      'ready-for-human',
    )
    expect(triageRole(header('**Status:** ready-for-agent'))).toBe('ready-for-agent')
    expect(triageRole(header('Status: open — needs-triage (blocked)'))).toBe('needs-triage')
    expect(triageRole(header('Status: open (ready-for-human — unblocked)'))).toBe('ready-for-human')
    expect(triageRole(header('Status: wontfix'))).toBe('wontfix')
    expect(triageRole(header('Labels: wayfinder:task, ready-for-agent'))).toBe('ready-for-agent')
    expect(triageRole(header('Status: closed (resolved)'))).toBeNull()
  })
})

describe('assignee', () => {
  it('reads the name before a parenthesis or a dash, and none for a dash or unclaimed', () => {
    expect(assignee('Ana (claimed 2026-01-02, grilling session)')).toBe('Ana')
    expect(assignee('research subagent (session 2026-01-02)')).toBe('research subagent')
    expect(assignee('Ana — claimed 2026-01-02')).toBe('Ana')
    expect(assignee('—')).toBeNull()
    expect(assignee('— (unclaimed)')).toBeNull()
    expect(assignee('(unclaimed)')).toBeNull()
    expect(assignee('')).toBeNull()
    expect(assignee(undefined)).toBeNull()
  })
})

describe('typeAndMode', () => {
  it('reads Type, Label and Labels with an optional wayfinder prefix, never the H1', () => {
    expect(typeAndMode(header('# Task: x', 'Type: grilling'))).toEqual({
      type: 'grilling',
      mode: null,
    })
    expect(typeAndMode(header('Label: wayfinder:task (AFK — takeable now)'))).toEqual({
      type: 'task',
      mode: 'AFK',
    })
    expect(typeAndMode(header('Type: wayfinder:research (HITL)'))).toEqual({
      type: 'research',
      mode: 'HITL',
    })
    expect(typeAndMode(header('Labels: wayfinder:prototype, ready-for-human'))).toEqual({
      type: 'prototype',
      mode: null,
    })
    expect(typeAndMode(header('# Research: x'))).toEqual({ type: null, mode: null })
    expect(typeAndMode(header('Type: bug'))).toEqual({ type: null, mode: null })
  })

  it('reads no type when the sources disagree, and one when they agree', () => {
    expect(typeAndMode(header('Type: task', 'Label: wayfinder:grilling'))).toEqual({
      type: null,
      mode: null,
    })
    expect(typeAndMode(header('Type: task', 'Label: wayfinder:task (HITL)'))).toEqual({
      type: 'task',
      mode: 'HITL',
    })
  })
})

describe('splitItems', () => {
  it('splits on commas outside brackets and parentheses', () => {
    expect(splitItems('[a, b](01-a.md), 02 (closed, done), 03')).toEqual([
      '[a, b](01-a.md)',
      '02 (closed, done)',
      '03',
    ])
  })

  it('splits on a semicolon only before a reference, else keeps it in the annotation', () => {
    expect(splitItems('[a](01-a.md) (closed); [b](02-b.md) (closed — done)')).toEqual([
      '[a](01-a.md) (closed)',
      '[b](02-b.md) (closed — done)',
    ])
    expect(splitItems('01 resolved 2026-01-02; frontier — next')).toEqual([
      '01 resolved 2026-01-02; frontier — next',
    ])
    expect(splitItems('01 (done); 03-c.md; #04')).toEqual(['01 (done)', '03-c.md', '#04'])
    expect(splitItems('01 (closed; done), 02')).toEqual(['01 (closed; done)', '02'])
  })
})

describe('referencedTickets', () => {
  it('reads a link, a bare file name or a leading number at the start of each item', () => {
    expect(referencedTickets('[Ledger 2 and 3](01-ledger.md), [Vault](03-vault.md)')).toEqual([
      1, 3,
    ])
    expect(referencedTickets('01-ledger.md (closed 2026-01-02), 02-vault.md')).toEqual([1, 2])
    expect(referencedTickets('03, #07')).toEqual([3, 7])
    expect(referencedTickets('12 — ledger core, 07 — sync.')).toEqual([12, 7])
    expect(referencedTickets('04 (closed 2026-01-02) — **UNBLOCKED**')).toEqual([4])
  })

  it('reads none from a none marker, an annotation or an item with no reference at its start', () => {
    expect(referencedTickets('— (ticket 01 closed 2026-01-02)')).toEqual([])
    expect(referencedTickets('(none — frontier)')).toEqual([])
    expect(referencedTickets('nothing yet')).toEqual([])
    expect(referencedTickets('')).toEqual([])
    expect(referencedTickets(undefined)).toEqual([])
    expect(referencedTickets('every ticket on the map (01, 02)')).toEqual([])
    expect(referencedTickets('03, 04 (all done), and the ledger decision')).toEqual([3, 4])
  })
})

describe('resolution', () => {
  it('takes `## Answer` first, then the last Resolution heading or bold label', () => {
    const answered =
      '## Question\n\n## Answer\n\nYes.\n\n## Comments\n\n### Resolution (2026-01-02)\n\nNo.'
    expect(resolution(answered, true)).toEqual({
      placement: 'answer',
      firstLine: 'Yes.',
      at: null,
      author: null,
    })
    const relabelled = [
      '## Comments',
      '',
      '### Resolution (2026-01-02)',
      '',
      'First.',
      '',
      '**Resolução — 2026-01-05 (reopened):** second.',
    ].join('\n')
    expect(resolution(relabelled, true)).toEqual({
      placement: 'bold-paragraph',
      firstLine: 'second.',
      at: '2026-01-05',
      author: null,
    })
  })

  it('tells a Resolution heading under `## Comments` from one standing alone', () => {
    expect(resolution('## Comments\n\n### Resolution (2026-01-02)\n\nYes.', true)?.placement).toBe(
      'comments-resolution',
    )
    expect(resolution('## Resolution (2026-01-02)\n\nYes.', true)).toEqual({
      placement: 'resolution',
      firstLine: 'Yes.',
      at: '2026-01-02',
      author: null,
    })
  })

  it('falls back to the last entry under the last `## Comments`: a dated item or trailing text', () => {
    const dated = '## Comments\n\n- 2026-01-02 (Ana): start\n- 2026-01-03 (Ana): done'
    expect(resolution(dated, true)).toEqual({
      placement: 'comments-item',
      firstLine: '- 2026-01-03 (Ana): done',
      at: '2026-01-03',
      author: 'Ana',
    })
    expect(resolution('## Comments\n\nShipped as planned.', true)).toEqual({
      placement: 'comments-text',
      firstLine: 'Shipped as planned.',
      at: null,
      author: null,
    })
  })

  it('gives none to a ticket that is not closed, to `## Decision`, and inside a code fence', () => {
    expect(resolution('## Comments\n\n### Resolution (2026-01-02)\n\nYes.', false)).toBeNull()
    expect(resolution('## Decision\n\nYes.', true)).toBeNull()
    expect(resolution('## Question\n\n```md\n## Answer\n```', true)).toBeNull()
  })
})

describe('maps', () => {
  it('closes a map only with a Status line led by DONE or destination reached', () => {
    expect(mapClosed(header('Status: **DONE 2026-01-02** — all closed'))).toBe(true)
    expect(mapClosed(header('Status: **destination reached 2026-01-02**'))).toBe(true)
    expect(mapClosed(header('Status: **route walked** — every ticket closed'))).toBe(false)
    expect(mapClosed(header('Status: **03 + 04 DONE 2026-01-02**'))).toBe(false)
    expect(mapClosed(header('Label: wayfinder:map'))).toBe(false)
  })

  it('lists the tickets Decisions so far links, in order, once each', () => {
    const body = [
      '## Decisions so far',
      '',
      '- [Vault](issues/03-vault.md) — kept; see [Ledger](issues/01-ledger.md)',
      '- [Ledger](issues/01-ledger.md) — done',
      '',
      '## Not yet specified',
      '',
      '- [Later](issues/09-later.md)',
    ].join('\n')
    expect(decisions(body)).toEqual([3, 1])
  })
})
