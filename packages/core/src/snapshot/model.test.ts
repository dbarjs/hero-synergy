import { describe, expect, test } from 'vite-plus/test'

import snapshotJson from '../../fixtures/snapshot/snapshot.json' with { type: 'json' }
import { decodeSnapshot, encodeSnapshot } from './model.ts'

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

  test('refuses a warning code outside the catalogue, naming where it sits', () => {
    const broken = structuredClone(snapshotJson) as unknown as {
      maps: Array<{ warnings: Array<{ code: string }> }>
    }
    broken.maps[1]!.warnings[0]!.code = 'map-body-odd'
    expect(() => decodeSnapshot(broken)).toThrow(/\["maps"\]\[1\]\["warnings"\]\[0\]\["code"\]/)
  })

  test('refuses a state outside open and closed', () => {
    const broken = structuredClone(snapshotJson) as unknown as {
      unmapped: Array<{ state: string }>
    }
    broken.unmapped[0]!.state = 'OPEN'
    expect(() => decodeSnapshot(broken)).toThrow(/"open" \| "closed"/)
  })
})
