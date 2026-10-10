import { describe, expect, test } from 'vite-plus/test'

import { readMapStatus } from './map-status.ts'

const map = (header: string, rest = '') =>
  `# Seed library\n\n${header}\n\n## Destination\n\nA seed library.\n${rest}`

describe('readMapStatus', () => {
  test.each([
    ['Status: DONE (2025-07-02) — all 1 tickets closed, no frontier.'],
    ['Status: **DONE 2025-07-01** — 01 closed. No frontier.'],
    ['Status: **DONE 2025-07-03 (second closing)** — 01 closed again after the redraw.'],
    ['Status: **DONE** 2025-03-28 — all tickets closed'],
    ['Status: done'],
    ['Status: DONE: shipped'],
    ['Status: **destination reached 2025-07-04** (by ticket 01) — no open tickets'],
    ['Status: Destination Reached'],
    ['**Status:** DONE 2025-07-01'],
  ])('closes the map on a Status line led by DONE or destination reached: %s', (header) => {
    expect(readMapStatus(map(header))).toEqual({ state: 'closed', unknown: null })
  })

  test.each([
    ['Status: in progress 2025-07-05 — frontier: [02](issues/02-fill-the-shelf.md)'],
    ['Status: **in progress 2025-07-06** — 01 + **02 DONE**; frontier = **03 ONLY**'],
    ['Status: charted 2025-07-07; frontier = only [Pick the shelf](issues/01-pick-the-shelf.md)'],
    ['Status: **REOPENED 2025-07-08 — destination redrawn for the autumn swap**'],
    ['Status: **route walked 2025-07-12** — 01 closed. **No frontier**.'],
    ['Status: Route Walked, every shelf full'],
    ['Label: wayfinder:map\nCharted: 2025-07-13'],
    [''],
    ['Status:'],
  ])('reads the map as open, raising nothing: %s', (header) => {
    expect(readMapStatus(map(header))).toEqual({ state: 'open', unknown: null })
  })

  test.each([
    ['Status: **01 + 02 DONE 2025-07-09** (built, uncommitted) — frontier **03 ONLY**', '01'],
    ['Status: **07 DONE 2025-04-19** (uncommitted)', '07'],
    ['Status: The shelf work **DONE 2025-07-10** — 02 closed.', 'The'],
    ['Status: tree work **DONE 2025-05-07** — 01 closed', 'tree'],
    ['Status: in-progress', 'in-progress'],
    ['Status: Done-ish', 'Done-ish'],
    ['Status: [the shelf](issues/01-pick-the-shelf.md) is done', '[the'],
  ])('reads any other first word as open, naming that word as written: %s', (header, word) => {
    expect(readMapStatus(map(header))).toEqual({ state: 'open', unknown: word })
  })

  test('reads only the Status header line, never a heading, prose or a later Status line', () => {
    const body = map(
      'Label: wayfinder:map\nFrontier: empty',
      '\n## Destination reached\n\nStatus: DONE 2025-07-04\n\n## Decisions so far\n\n- [Pick the shelf](issues/01-pick-the-shelf.md) — DONE: the top shelf.\n',
    )
    expect(readMapStatus(body)).toEqual({ state: 'open', unknown: null })
  })

  test('never reads a Status line inside a fence or quoted in inline code', () => {
    const body =
      '# Seed library\n\n```\nStatus: DONE\n```\n`Status: DONE`\n\n## Destination\n\nA.\n'
    expect(readMapStatus(body)).toEqual({ state: 'open', unknown: null })
  })

  test('takes the first Status line when the header holds two', () => {
    expect(readMapStatus(map('Status: in progress\nStatus: DONE'))).toEqual({
      state: 'open',
      unknown: null,
    })
  })
})
