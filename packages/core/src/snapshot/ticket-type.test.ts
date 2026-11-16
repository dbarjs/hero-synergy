import { describe, expect, test } from 'vite-plus/test'

import { readHeaderLines } from './header-lines.ts'
import { readTicketType } from './ticket-type.ts'

const ticket = (header: string, title = 'Weigh the packets') =>
  `# ${title}\n\n${header}\nStatus: open\n\n## Question\n\nBy packet or by weight?\n`

const read = (header: string, title?: string) =>
  readTicketType(readHeaderLines(ticket(header, title)))

describe('readTicketType', () => {
  describe('the sources', () => {
    test.each([
      ['Type: task', 'task'],
      ['Type: Research', 'research'],
      ['Type: GRILLING', 'grilling'],
      ['**Type:** prototype', 'prototype'],
      ['type: task', 'task'],
    ] as const)('a plain Type line gives the type and raises nothing: %s', (header, type) => {
      expect(read(header)).toEqual({ type, modeNote: null, warnings: [] })
    })

    test.each([
      ['Label: wayfinder:grilling', 'grilling', 'wayfinder:grilling'],
      ['Labels: wayfinder:prototype', 'prototype', 'wayfinder:prototype'],
      ['Labels: wayfinder:task, ready-for-agent', 'task', 'wayfinder:task'],
      ['Labels: ready-for-human, wayfinder:research', 'research', 'wayfinder:research'],
      ['Labels: `wayfinder:task`, `ready-for-agent`', 'task', '`wayfinder:task`'],
      ['Type: wayfinder:research', 'research', 'wayfinder:research'],
      ['Label: Wayfinder:Task', 'task', 'Wayfinder:Task'],
    ] as const)(
      'a Label or Labels line, or a wayfinder: prefix, gives the type and a quiet type-as-label with the value: %s',
      (header, type, detail) => {
        expect(read(header)).toEqual({
          type,
          modeNote: null,
          warnings: [{ code: 'type-as-label', detail }],
        })
      },
    )

    test('every wayfinder:<type> item of a Labels line counts, and a role or other label is no type', () => {
      expect(read('Labels: good first issue, wayfinder:task, ready-for-agent').type).toBe('task')
      expect(read('Labels: ready-for-agent, needs-info')).toEqual({
        type: null,
        modeNote: null,
        warnings: [{ code: 'type-missing' }],
      })
    })

    test('the same type named twice is that type, noted once for every label source', () => {
      expect(read('Type: task\nLabel: wayfinder:task\nLabels: wayfinder:task')).toEqual({
        type: 'task',
        modeNote: null,
        warnings: [{ code: 'type-as-label', detail: 'wayfinder:task, wayfinder:task' }],
      })
    })

    test('only the first line of each key is read', () => {
      expect(read('Type: research\nType: grilling')).toEqual({
        type: 'research',
        modeNote: null,
        warnings: [],
      })
    })

    test.each([['Grilling: Packet or weight'], ['Research: Packet sizes elsewhere']])(
      'the H1 is never a type, whatever its prefix: # %s',
      (title) => {
        expect(read('Assignee: —', title)).toEqual({
          type: null,
          modeNote: null,
          warnings: [{ code: 'type-missing' }],
        })
        expect(read('Type: task', title).type).toBe('task')
      },
    )

    test('a type line after the first H2, in a fence or quoted in inline code is never read', () => {
      const body =
        '# Weigh the packets\n\nStatus: open\n`Type: task`\n```\nType: research\n```\n\n## Question\n\nType: grilling\n'
      expect(readTicketType(readHeaderLines(body))).toEqual({
        type: null,
        modeNote: null,
        warnings: [{ code: 'type-missing' }],
      })
    })
  })

  describe('the value', () => {
    test.each([
      ['Type: task (the grilling in 03 decides how)', 'task', null],
      ['Label: wayfinder:task (AFK — ready once 01 closes)', 'task', 'AFK'],
      ['Labels: wayfinder:task (HITL, wayfinder:grilling later), ready-for-agent', 'task', 'HITL'],
      ['Type: research (prototype it after 02; then 04)', 'research', null],
    ] as const)(
      'never searches the parenthesis for a type or a number: %s',
      (header, type, modeNote) => {
        const reading = read(header)
        expect([reading.type, reading.modeNote]).toEqual([type, modeNote])
        expect(reading.warnings.map((warning) => warning.code)).not.toContain('type-several')
      },
    )

    test.each([['Type: task-force'], ['Type: tasks'], ['Type: discuss'], ['Type: 03 research']])(
      'needs the first word to be one of the four types: %s',
      (header) => {
        expect(read(header)).toEqual({
          type: null,
          modeNote: null,
          warnings: [{ code: 'type-missing', detail: header }],
        })
      },
    )

    test('an empty Type line names nothing', () => {
      expect(read('Type:').warnings).toEqual([{ code: 'type-missing' }])
    })
  })

  describe('a conflict', () => {
    test.each([
      [
        'Type: task\nLabel: wayfinder:research',
        'task, research',
        [{ code: 'type-as-label', detail: 'wayfinder:research' }],
      ],
      [
        'Labels: wayfinder:grilling, wayfinder:task',
        'grilling, task',
        [{ code: 'type-as-label', detail: 'wayfinder:grilling, wayfinder:task' }],
      ],
      [
        'Labels: wayfinder:task\nType: grilling\nLabel: wayfinder:task',
        'grilling, task',
        [{ code: 'type-as-label', detail: 'wayfinder:task, wayfinder:task' }],
      ],
    ] as const)('gives no type and a loud type-several listing them: %s', (header, types, rest) => {
      expect(read(header)).toEqual({
        type: null,
        modeNote: null,
        warnings: [{ code: 'type-several', detail: types }, ...rest],
      })
    })

    test('still keeps a HITL note, so a ticket marked for a person is never read as AFK', () => {
      expect(read('Type: task (HITL)\nLabel: wayfinder:research')).toMatchObject({
        type: null,
        modeNote: 'HITL',
      })
    })
  })

  describe('unknown wayfinder labels', () => {
    test.each([
      ['Label: wayfinder:spike', [{ code: 'type-missing' }], 'wayfinder:spike'],
      [
        'Type: wayfinder:blocked (AFK)',
        [{ code: 'type-missing', detail: 'Type: wayfinder:blocked (AFK)' }],
        'wayfinder:blocked',
      ],
      [
        'Labels: wayfinder:task, wayfinder:blocked, wayfinder:later',
        [{ code: 'type-as-label', detail: 'wayfinder:task' }],
        'wayfinder:blocked, wayfinder:later',
      ],
    ] as const)(
      'raises unknown-wayfinder-labels on the ticket, naming them: %s',
      (header, before, unknown) => {
        expect(read(header).warnings).toEqual([
          ...before,
          { code: 'unknown-wayfinder-labels', detail: unknown },
        ])
      },
    )

    test('a known label that is no type, wayfinder:map or wayfinder:claimed, is no type and raises nothing more', () => {
      expect(read('Label: wayfinder:map').warnings).toEqual([{ code: 'type-missing' }])
      expect(read('Labels: wayfinder:claimed, wayfinder:task')).toEqual({
        type: 'task',
        modeNote: null,
        warnings: [{ code: 'type-as-label', detail: 'wayfinder:task' }],
      })
    })

    test('a label without the prefix is never a wayfinder label', () => {
      expect(read('Type: task\nLabel: prd')).toEqual({ type: 'task', modeNote: null, warnings: [] })
    })
  })

  describe('the HITL note', () => {
    test.each([
      ['Type: task (HITL)', 'task', 'HITL'],
      ['Type: research (HITL — a member reads the result)', 'research', 'HITL'],
      ['Type: task (AFK)', 'task', 'AFK'],
      ['Type: research ( afk once the scale is in)', 'research', 'AFK'],
      ['Type: task (AFK for the counting; HITL for the sign-off)', 'task', 'AFK'],
      ['Type: task (HITL for the sign-off; AFK for the counting)', 'task', 'HITL'],
      ['Type: grilling (HITL)', 'grilling', 'HITL'],
    ] as const)(
      'is a leading AFK or HITL inside the parenthesis right after the type word: %s',
      (header, type, modeNote) => {
        expect(read(header)).toEqual({ type, modeNote, warnings: [] })
      },
    )

    test.each([
      ['Type: task (a member does the HITL part)'],
      ['Type: task — HITL'],
      ['Type: task HITL'],
      ['Type: task (AFKish)'],
      ['Type: task ((HITL))'],
    ])('is read only from the start of that parenthesis: %s', (header) => {
      expect(read(header)).toEqual({ type: 'task', modeNote: null, warnings: [] })
    })

    test.each([
      ['Type: task\nLabel: wayfinder:task (HITL)', 'HITL'],
      ['Type: task (AFK)\nLabel: wayfinder:task (HITL)', 'AFK'],
      ['Labels: wayfinder:task (HITL)\nLabel: wayfinder:task (AFK)', 'AFK'],
      ['Labels: wayfinder:task (HITL)\nType: task (AFK)', 'AFK'],
      ['Label: wayfinder:task\nLabels: wayfinder:task (HITL)', 'HITL'],
    ] as const)(
      'is the first source’s that carries one, in the order Type, Label, Labels: %s',
      (header, modeNote) => {
        expect(read(header).modeNote).toBe(modeNote)
      },
    )

    test.each([
      ['Type: grilling (AFK)', 'grilling', [], 'grilling (AFK)'],
      [
        'Label: wayfinder:prototype (AFK — quick sketch)',
        'prototype',
        [{ code: 'type-as-label', detail: 'wayfinder:prototype (AFK — quick sketch)' }],
        'wayfinder:prototype (AFK — quick sketch)',
      ],
      [
        'Type: prototype\nLabel: wayfinder:prototype (AFK)',
        'prototype',
        [{ code: 'type-as-label', detail: 'wayfinder:prototype (AFK)' }],
        'wayfinder:prototype (AFK)',
      ],
    ] as const)(
      'AFK on a prototype or grilling ticket keeps the note and raises a loud mode-conflicts-type with the value: %s',
      (header, type, before, detail) => {
        expect(read(header)).toEqual({
          type,
          modeNote: 'AFK',
          warnings: [...before, { code: 'mode-conflicts-type', detail }],
        })
      },
    )
  })
})
