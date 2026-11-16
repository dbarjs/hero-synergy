import { describe, expect, it } from 'vite-plus/test'

import { DRIFT_TABLE, driftEntryOf } from './drift-table.ts'
import { isLoud, warningCodes } from './warnings.ts'

const LOUD = [
  'map-body-free-form',
  'map-body-partial',
  'map-no-destination',
  'decision-line-unparsed',
  'decision-links-open-ticket',
  'type-missing',
  'type-several',
  'blockers-as-slugs',
  'blocker-unread',
  'no-map',
  'map-line-disagrees',
  'closed-unrecorded',
  'closed-no-resolution',
  'unknown-status',
  'map-file-ambiguous',
  'mode-conflicts-type',
]

describe('the drift table', () => {
  it('covers the whole WarningCode union and nothing else', () => {
    expect(Object.keys(DRIFT_TABLE).toSorted()).toEqual([...warningCodes].toSorted())
  })

  it('gives every code a message, a hint and a level', () => {
    for (const code of warningCodes) {
      const entry = driftEntryOf({ code, detail: 'the detail' })
      expect(entry.code).toBe(code)
      expect(entry.message, code).not.toBe('')
      expect(entry.hint, code).not.toBe('')
      expect(['loud', 'quiet']).toContain(entry.level)
    }
  })

  it('is loud for exactly the codes where the Cockpit may be wrong or missing something', () => {
    const loud = warningCodes.filter((code) => DRIFT_TABLE[code].level === 'loud')
    expect(loud.toSorted()).toEqual(LOUD.toSorted())
    for (const code of warningCodes) {
      expect(isLoud(driftEntryOf({ code })), code).toBe(LOUD.includes(code))
    }
  })

  it('adds the newer-skills hint to the three codes a newer mattpocock-skills may write, and no others', () => {
    for (const code of warningCodes) {
      const mentions = driftEntryOf({ code }).hint.includes('check for a hero-synergy update')
      expect(mentions, code).toBe(
        ['map-body-partial', 'unknown-wayfinder-labels', 'decision-line-unparsed'].includes(code),
      )
    }
  })

  it('carries the scout’s detail into the message and the entry, and null when there is none', () => {
    expect(driftEntryOf({ code: 'blockers-as-slugs', detail: 'api, schema' })).toEqual({
      code: 'blockers-as-slugs',
      level: 'loud',
      message: 'The ticket is blocked by names, not numbers: api, schema.',
      detail: 'api, schema',
      hint: 'A blocker is a ticket number, or the tracker’s own blocked-by link.',
    })
    expect(driftEntryOf({ code: 'no-map' }).detail).toBeNull()
  })

  it.each([
    {
      code: 'header-key-bold',
      level: 'quiet',
      message: 'A header line has a bold key.',
      detail: 'Status, Parent',
      withDetail: 'A header line has a bold key: Status, Parent.',
      hint: 'A header line is a plain "Key: value" line before the first ## heading.',
    },
    {
      code: 'map-file-ambiguous',
      level: 'loud',
      message: 'The effort has more than one map file.',
      detail: 'MAP.md, map.md; read map.md',
      withDetail: 'The effort has more than one map file: MAP.md, map.md; read map.md.',
      hint: 'An effort keeps one map file, map.md.',
    },
    {
      code: 'map-status-unknown',
      level: 'quiet',
      message:
        "The map's Status line starts with a word this version does not read; the map reads as open.",
      detail: '01',
      withDetail:
        "The map's Status line starts with a word this version does not read; the map reads as open: 01.",
      hint: 'Only a Status line that starts with DONE or destination reached closes a local map.',
    },
    {
      code: 'blockers-not-template',
      level: 'quiet',
      message: "The ticket's Blocked by line is not in the template's form.",
      detail: '02 (closed 2026-10-02) — **UNBLOCKED**',
      withDetail:
        "The ticket's Blocked by line is not in the template's form: 02 (closed 2026-10-02) — **UNBLOCKED**.",
      hint: 'A local ticket lists its blockers as "Blocked by: NN, NN".',
    },
    {
      code: 'blocks-line',
      level: 'quiet',
      message: 'The ticket names the tickets it blocks.',
      detail: '03, 04',
      withDetail: 'The ticket names the tickets it blocks: 03, 04.',
      hint: 'Blockers go on the waiting ticket\'s "Blocked by:" line; the Cockpit reads both sides.',
    },
    {
      code: 'blocker-unread',
      level: 'loud',
      message: 'A Blocked by item names no ticket.',
      detail: 'the design review',
      withDetail: 'A Blocked by item names no ticket: the design review.',
      hint: 'Each item of a Blocked by line starts with a ticket number, a ticket file name or a link to one.',
    },
    {
      code: 'map-line-disagrees',
      level: 'loud',
      message: "The ticket's Map or Parent line points away from its effort's map.",
      detail: '../../garden/MAP.md',
      withDetail:
        "The ticket's Map or Parent line points away from its effort's map: ../../garden/MAP.md.",
      hint: 'A local ticket belongs to the map in its effort directory; the directory decides.',
    },
    {
      code: 'type-as-label',
      level: 'quiet',
      message: 'The ticket gives its type as a label.',
      detail: 'wayfinder:task (AFK)',
      withDetail: 'The ticket gives its type as a label: wayfinder:task (AFK).',
      hint: 'A local ticket names its type on a "Type: <type>" line.',
    },
    {
      code: 'mode-conflicts-type',
      level: 'loud',
      message: 'The ticket is marked AFK, but its type is HITL.',
      detail: 'wayfinder:grilling (AFK — quick call)',
      withDetail:
        'The ticket is marked AFK, but its type is HITL: wayfinder:grilling (AFK — quick call).',
      hint: 'Prototype and grilling tickets are HITL; only a research or task ticket runs AFK.',
    },
    {
      code: 'type-missing',
      level: 'loud',
      message: 'The ticket has no type.',
      detail: 'Type: discuss',
      // The message names no detail: the type line rides in the entry's detail alone.
      withDetail: 'The ticket has no type.',
      hint: 'A ticket carries one wayfinder:<type> label (a Type: line on a local tracker): research, prototype, grilling or task.',
    },
    {
      code: 'type-several',
      level: 'loud',
      message: 'The ticket has several types.',
      detail: 'task, research',
      withDetail: 'The ticket has several types: task, research.',
      hint: 'A ticket carries exactly one type: one wayfinder:<type> label, or one Type: line locally.',
    },
    {
      code: 'unknown-status',
      level: 'loud',
      message:
        "The ticket's Status line starts with a word this version does not read; the ticket reads as open.",
      detail: 'build half DONE 2026-10-02; check half OPEN',
      withDetail:
        "The ticket's Status line starts with a word this version does not read; the ticket reads as open: build half DONE 2026-10-02; check half OPEN.",
      hint: 'A Status line starts with open, claimed, closed, done, resolved or wontfix, or a triage role: needs-triage, needs-info, ready-for-agent or ready-for-human.',
    },
    {
      code: 'resolution-outside-answer',
      level: 'quiet',
      message: 'The resolution is not under ## Answer.',
      detail: 'Resolution heading under ## Comments',
      withDetail: 'The resolution is not under ## Answer: Resolution heading under ## Comments.',
      hint: "A local decision ticket's resolution goes under an ## Answer heading.",
    },
    {
      code: 'resolution-from-last-comment',
      level: 'quiet',
      message: 'The ticket has no Answer or Resolution section; its last comment stands in.',
      detail: 'dated comment',
      withDetail:
        'The ticket has no Answer or Resolution section; its last comment stands in: dated comment.',
      hint: "A local decision ticket's resolution goes under an ## Answer heading.",
    },
  ] as const)(
    '$code: words the local tracker reader raises',
    ({ code, level, message, detail, withDetail, hint }) => {
      expect(driftEntryOf({ code })).toEqual({ code, level, message, detail: null, hint })
      expect(driftEntryOf({ code, detail })).toEqual({
        code,
        level,
        message: withDetail,
        detail,
        hint,
      })
    },
  )

  it('names the Resolution heading in closed-no-resolution’s hint, and stays loud', () => {
    expect(driftEntryOf({ code: 'closed-no-resolution' })).toEqual({
      code: 'closed-no-resolution',
      level: 'loud',
      message: 'The ticket is closed with no answer.',
      detail: null,
      hint: 'A closed decision ticket ends with its resolution: a comment on GitHub; locally an ## Answer section or a Resolution heading.',
    })
  })
})
