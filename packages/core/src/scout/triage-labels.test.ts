import { readFileSync } from 'node:fs'
import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import { FileSystem } from '../file-system.ts'
import {
  DEFAULT_TRIAGE_LABELS,
  readTriageLabels,
  TRIAGE_LABELS_PATH,
  triageLabelsOf,
} from './triage-labels.ts'

const OWN = readFileSync(new URL(`../../../../${TRIAGE_LABELS_PATH}`, import.meta.url), 'utf8')

const RENAMED = `# Triage Labels

| Label in mattpocock/skills | Label in our tracker | Meaning |
| --- | --- | --- |
| \`needs-triage\` | \`triage\` | Maintainer needs to evaluate this issue |
| \`ready-for-agent\` | \`agent: go\` | Fully specified |
| \`ready-for-human\` | \`human only\` | Requires a human |
`

describe('readTriageLabels', () => {
  it("reads this repo's own file as the defaults", () => {
    expect(readTriageLabels(OWN)).toEqual(DEFAULT_TRIAGE_LABELS)
  })

  it('reads the right-hand column of a renamed table', () => {
    expect(readTriageLabels(RENAMED)).toEqual({
      readyForAgent: 'agent: go',
      readyForHuman: 'human only',
    })
  })

  it('keeps the default for a row the table lacks or leaves empty', () => {
    const partial = `| Role | Label |
| --- | --- |
| \`ready-for-agent\` | \`afk\` |
| \`ready-for-human\` |  |
`
    expect(readTriageLabels(partial)).toEqual({
      readyForAgent: 'afk',
      readyForHuman: 'ready-for-human',
    })
  })

  it('reads the defaults from a file with no table', () => {
    expect(readTriageLabels('# Triage Labels\n\nNothing here yet.\n')).toEqual(
      DEFAULT_TRIAGE_LABELS,
    )
  })
})

describe('triageLabelsOf', () => {
  const ROOT = '/work/billing'
  const read = (files: Record<string, string>) =>
    triageLabelsOf(ROOT).pipe(Effect.provide(FileSystem.inMemory(files)))

  it.effect('reads the repo root’s triage-labels doc', () =>
    Effect.gen(function* () {
      expect(yield* read({ [`${ROOT}/${TRIAGE_LABELS_PATH}`]: RENAMED })).toEqual({
        readyForAgent: 'agent: go',
        readyForHuman: 'human only',
      })
    }),
  )

  it.effect('falls back to the defaults, silently, when there is no file', () =>
    Effect.gen(function* () {
      expect(yield* read({})).toEqual(DEFAULT_TRIAGE_LABELS)
    }),
  )

  it.effect('falls back to the defaults when the path is a directory', () =>
    Effect.gen(function* () {
      expect(yield* read({ [`${ROOT}/${TRIAGE_LABELS_PATH}/nested.md`]: 'not the doc' })).toEqual(
        DEFAULT_TRIAGE_LABELS,
      )
    }),
  )
})
