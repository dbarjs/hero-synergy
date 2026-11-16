import { describe, expect, test } from 'vite-plus/test'

import { boldKeysOf, headerValue, readHeaderLines } from './header-lines.ts'

describe('readHeaderLines', () => {
  test('reads the Key: value lines before the first H2, in order, past the H1 and blank lines', () => {
    const body =
      '# Pick the shelf\n\nLabel: wayfinder:task (AFK)\nStatus: open\n\nBlocked by: 01, 02\n\n## Question\n\nType: grilling\n'
    expect(readHeaderLines(body)).toEqual([
      { key: 'Label', value: 'wayfinder:task (AFK)', bold: false },
      { key: 'Status', value: 'open', bold: false },
      { key: 'Blocked by', value: '01, 02', bold: false },
    ])
  })

  test('reads a bold key in both styles like a plain one, and marks it bold', () => {
    const body = '# T\n\n**Status:** closed\n**Blocked by**: 03\nAssignee: wren\n'
    expect(readHeaderLines(body)).toEqual([
      { key: 'Status', value: 'closed', bold: true },
      { key: 'Blocked by', value: '03', bold: true },
      { key: 'Assignee', value: 'wren', bold: false },
    ])
  })

  test('keeps an empty value and a value that is itself bold', () => {
    expect(readHeaderLines('Assignee:\nStatus: **DONE 2025-07-01** — 01 closed.\n')).toEqual([
      { key: 'Assignee', value: '', bold: false },
      { key: 'Status', value: '**DONE 2025-07-01** — 01 closed.', bold: false },
    ])
  })

  test('never reads a list item, a quote, inline code, a heading or a line inside a fence', () => {
    const body = [
      '# Task: the H1 is no header line',
      '- Status: closed',
      '* Status: closed',
      '1. Status: closed',
      '> Status: closed',
      '`Status: resolved`',
      'Use `Status: resolved` to close.',
      '```md',
      'Status: done',
      '```',
      '~~~',
      'Status: done',
      '~~~',
      '<!-- Status: done -->',
      'Type: task',
    ].join('\n')
    expect(readHeaderLines(body)).toEqual([{ key: 'Type', value: 'task', bold: false }])
  })

  test('stops at the first H2, even when the file has more key lines below it', () => {
    expect(readHeaderLines('# T\n\n## Question\n\nStatus: closed\n')).toEqual([])
    expect(readHeaderLines('Status: open\n## Notes\nStatus: closed\n')).toEqual([
      { key: 'Status', value: 'open', bold: false },
    ])
  })

  test('reads a whole file with no H2 as its header', () => {
    expect(readHeaderLines('# T\n\nStatus: closed\n\nSome prose.\n\nAssignee: wren\n')).toEqual([
      { key: 'Status', value: 'closed', bold: false },
      { key: 'Assignee', value: 'wren', bold: false },
    ])
  })

  test('reads an H2 inside a fence as text, not as the end of the header', () => {
    expect(readHeaderLines('```\n## not a heading\n```\nStatus: open\n')).toEqual([
      { key: 'Status', value: 'open', bold: false },
    ])
  })
})

describe('headerValue', () => {
  const lines = readHeaderLines(
    'STATUS: closed\nstatus: open\nBlocked_by: 04\n**Map:** [x](../MAP.md)\n',
  )

  test('matches a key in any case, and the first line of a key wins', () => {
    expect(headerValue(lines, 'Status')).toBe('closed')
    expect(headerValue(lines, 'map')).toBe('[x](../MAP.md)')
  })

  test('reads an underscore in a key as a space', () => {
    expect(headerValue(lines, 'blocked by')).toBe('04')
  })

  test('is null for a key no line has', () => {
    expect(headerValue(lines, 'Assignee')).toBeNull()
  })
})

describe('boldKeysOf', () => {
  test('lists the bold keys in order, each once', () => {
    const lines = readHeaderLines(
      '**Status:** open\nType: task\n**Parent**: [p](../PRD.md)\n**status:** closed\n',
    )
    expect(boldKeysOf(lines)).toEqual(['Status', 'Parent'])
  })

  test('is empty when every key is plain', () => {
    expect(boldKeysOf(readHeaderLines('Status: open\n'))).toEqual([])
  })
})
