import { describe, expect, it } from '@effect/vitest'

import type { LineContext } from './sanitize.ts'
import { blockers, headerLines, resolutionLine, ticketType } from './truth.ts'

const context: LineContext = { shiftDays: 0, relink: (target) => target }
const tickets = new Set([1, 2, 3, 4, 7, 8, 12])

describe('headerLines', () => {
  it('reads plain, bold and listed keys before the first H2, the first of each', () => {
    const header = headerLines(
      [
        '# Ledger',
        'Status: closed',
        '**Blocked by:** 03',
        '- Map: [Ledger](../MAP.md)',
        'Status: open',
        '## Question',
        'Type: task',
      ].join('\n'),
    )
    expect(Object.fromEntries(header)).toEqual({
      status: 'closed',
      'blocked by': '03',
      map: '[Ledger](../MAP.md)',
    })
  })
})

describe('ticketType', () => {
  it('reads a wayfinder label first, then a Type line, then the H1 prefix', () => {
    const typed = (body: string) => ticketType(body, headerLines(body))
    expect(typed('# Task: x\nLabels: wayfinder:research, ready-for-agent\nType: grilling')).toBe(
      'research',
    )
    expect(typed('# Task: x\nType: grilling')).toBe('grilling')
    expect(typed('# Prototype: x\nStatus: open')).toBe('prototype')
    expect(typed('# x\nType: bug')).toBeNull()
  })
})

describe('blockers', () => {
  it('reads links, file names and bare numbers in list position', () => {
    expect(blockers('[Ledger](01-ledger.md), [Vault](03-vault.md)', tickets, 4)).toEqual([1, 3])
    expect(blockers('01-ledger.md (closed 2026-01-02), 02-vault.md', tickets, 4)).toEqual([1, 2])
    expect(blockers('03, 07', tickets, 4)).toEqual([3, 7])
    expect(blockers('— (ticket 01 closed 2026-01-02; 08 resolved)', tickets, 4)).toEqual([1, 8])
    expect(blockers('12 — ledger core, 07 — sync.', tickets, 4)).toEqual([7, 12])
  })

  it('reads no ticket from link text, prose numbers, dates or an empty value', () => {
    expect(blockers('— (01 closed 2026-01-02: steps 2–3 in table 8)', tickets, 4)).toEqual([1])
    expect(blockers('[Ledger 2 and 3](01-ledger.md)', tickets, 4)).toEqual([1])
    expect(blockers('none — frontier', tickets, 4)).toEqual([])
    expect(blockers('— (but read 12 below first)', tickets, 4)).toEqual([])
    expect(blockers('04, 99', tickets, 4)).toEqual([])
    expect(blockers(undefined, tickets, 4)).toEqual([])
  })
})

describe('resolutionLine', () => {
  it('finds the last resolution heading or bold lead, and the H2 it sits under', () => {
    const body = [
      '## Question',
      '',
      '## Comments',
      '',
      '### Resolution (2026-01-02)',
      '',
      '**Resolução — 2026-01-05 (reopened)**',
    ].join('\n')
    expect(resolutionLine(body, context)).toEqual({
      section: '## Comments',
      lead: '**Resolução — 2026-01-05 (reopened)**',
    })
    expect(resolutionLine('## Question\n\n## Answer\n\nYes.', context)).toEqual({
      section: null,
      lead: '## Answer',
    })
  })

  it('falls back to a Decision section, then to the last dated comment, for a closed ticket only', () => {
    const decided = '## Problem\n\n## Decision\n\nYes.\n\n## Comments\n\n- 2026-01-02 (Ana): done'
    expect(resolutionLine(decided, context)).toEqual({ section: null, lead: '## Decision' })
    const commented =
      '## Problem\n\n## Comments\n\n- 2026-01-02 (Ana): start\n- 2026-01-03 (Ana): done'
    expect(resolutionLine(commented, context)).toEqual({
      section: '## Comments',
      lead: '- 2026-01-03 (Lorem): done',
    })
    expect(resolutionLine(commented, context, false)).toBeNull()
  })

  it('ignores a heading inside a code fence', () => {
    expect(resolutionLine('## Question\n\n```md\n## Answer\n```', context)).toBeNull()
  })
})
