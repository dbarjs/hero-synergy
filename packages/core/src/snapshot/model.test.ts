import { describe, expect, test } from 'vite-plus/test'

import localSnapshotJson from '../../fixtures/snapshot/local-snapshot.json' with { type: 'json' }
import snapshotJson from '../../fixtures/snapshot/snapshot.json' with { type: 'json' }
import { decodeSnapshot, encodeSnapshot, snapshotSchemaVersion } from './model.ts'

describe('the snapshot as JSON', () => {
  test('round-trips: the decoded and the encoded shapes are the same, timestamps stay strings', () => {
    const snapshot = decodeSnapshot(snapshotJson)
    expect(encodeSnapshot(snapshot)).toEqual(snapshotJson)
    expect(snapshot).toEqual(snapshotJson)
    expect(typeof snapshot.collectedAt).toBe('string')
    expect(typeof snapshot.maps[0]?.tickets[1]?.resolution?.at).toBe('string')
  })

  test('keeps nulls as nulls and absent details absent', () => {
    const snapshot = decodeSnapshot(snapshotJson)
    const closed = snapshot.maps[0]?.tickets[2]
    expect(closed?.type).toBeNull()
    expect(closed?.resolution?.author).toBeNull()
    expect(snapshot.maps[1]?.destination).toBeNull()
    expect('detail' in (snapshot.maps[1]?.warnings[0] ?? {})).toBe(false)
  })

  test('round-trips a local snapshot: a ticket’s role, Status line and HITL note, and an effort’s unmapped group', () => {
    const snapshot = decodeSnapshot(localSnapshotJson)
    expect(encodeSnapshot(snapshot)).toEqual(localSnapshotJson)
    expect(snapshot).toEqual(localSnapshotJson)
    const [waiting, moving] = snapshot.maps[0]?.tickets ?? []
    expect(waiting).toMatchObject({
      role: 'ready-for-human',
      statusLine: 'open, waiting on [the finance review](finance.md)',
      modeNote: 'HITL',
      claim: null,
    })
    expect(moving).toMatchObject({
      role: null,
      statusLine: 'claimed',
      modeNote: 'AFK',
      claim: { by: [] },
    })
    expect(snapshot.unmapped).toEqual([
      {
        effort: 'onboarding-spec',
        title: 'onboarding-spec',
        tickets: [expect.objectContaining({ number: 1, role: 'needs-triage', modeNote: null })],
      },
    ])
  })

  test('holds GitHub strays in one group with no effort and no title', () => {
    const snapshot = decodeSnapshot(snapshotJson)
    expect(
      snapshot.unmapped.map(({ effort, title, tickets }) => ({
        effort,
        title,
        tickets: tickets.map((ticket) => ticket.number),
      })),
    ).toEqual([{ effort: null, title: null, tickets: [9] }])
    for (const ticket of [
      ...snapshot.maps.flatMap((map) => map.tickets),
      ...snapshot.unmapped.flatMap((group) => group.tickets),
    ]) {
      expect([ticket.role, ticket.statusLine, ticket.modeNote]).toEqual([null, null, null])
    }
  })

  test('refuses a warning code outside the catalogue, naming where it sits', () => {
    const broken = structuredClone(snapshotJson) as unknown as {
      maps: Array<{ warnings: Array<{ code: string }> }>
    }
    broken.maps[1]!.warnings[0]!.code = 'map-body-odd'
    expect(() => decodeSnapshot(broken)).toThrow(/\["maps"\]\[1\]\["warnings"\]\[0\]\["code"\]/)
  })

  test('refuses a state outside open and closed', () => {
    const broken = structuredClone(snapshotJson) as unknown as {
      unmapped: Array<{ tickets: Array<{ state: string }> }>
    }
    broken.unmapped[0]!.tickets[0]!.state = 'OPEN'
    expect(() => decodeSnapshot(broken)).toThrow(/"open" \| "closed"/)
  })

  test('refuses a role outside the five triage roles, and a HITL note outside AFK and HITL', () => {
    const role = structuredClone(localSnapshotJson) as unknown as {
      maps: Array<{ tickets: Array<{ role: string; modeNote: string }> }>
    }
    role.maps[0]!.tickets[0]!.role = 'ready'
    expect(() => decodeSnapshot(role)).toThrow(/\["maps"\]\[0\]\["tickets"\]\[0\]\["role"\]/)

    const note = structuredClone(localSnapshotJson) as unknown as typeof role
    note.maps[0]!.tickets[0]!.modeNote = 'hitl'
    expect(() => decodeSnapshot(note)).toThrow(/\["maps"\]\[0\]\["tickets"\]\[0\]\["modeNote"\]/)
  })

  test('refuses the previous version’s shape: unmapped as a flat list of tickets', () => {
    const previous = structuredClone(snapshotJson) as unknown as { unmapped: unknown[] }
    previous.unmapped = (snapshotJson.unmapped[0]?.tickets ?? []).map((ticket) => {
      const { role: _role, statusLine: _statusLine, modeNote: _modeNote, ...rest } = ticket
      return rest
    })
    expect(() => decodeSnapshot(previous)).toThrow(/\["unmapped"\]\[0\]/)
  })

  test('is stored under schema version 3: version 2 added a ticket’s labels, 3 the triage role, Status line, HITL note and unmapped groups', () => {
    expect(snapshotSchemaVersion).toBe(3)
  })
})
