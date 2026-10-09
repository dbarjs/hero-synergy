import { describe, expect, it } from '@effect/vitest'

import { readFileSync } from 'node:fs'

import { check, words } from './leak-check.ts'
import { SECOND_LANGUAGE_WORDS } from './vocabulary.ts'

describe('words', () => {
  it('splits camelCase, keeps accents, lower-cases and drops words under three letters', () => {
    expect(words('useLedgerSort é Resolução of 42x')).toEqual([
      'useledgersort',
      'use',
      'ledger',
      'sort',
      'resolução',
    ])
  })
})

describe('reviewed-words.txt', () => {
  it('names every word the mirror keeps from the second language', () => {
    const reviewed = new Set(
      readFileSync(new URL('reviewed-words.txt', import.meta.url), 'utf8').split('\n'),
    )
    const kept = [...SECOND_LANGUAGE_WORDS].filter((word) => word.length >= 3)
    expect(kept.filter((word) => !reviewed.has(word))).toEqual([])
  })
})

describe('check', () => {
  const sources = {
    corpus: ['The zorblax ledger syncs with quuxify on every night of the week, as planned.'],
    dictionary: [
      [
        'the',
        'ledger',
        'syncs',
        'with',
        'on',
        'every',
        'night',
        'of',
        'week',
        'as',
        'planned',
        'London',
      ].join('\n'),
    ],
    safe: ['quuxify'],
  }

  it('fails a corpus word that neither the dictionary nor a safe source holds', () => {
    const [report] = check(sources, [['mirror.md', 'closed: zorblax and quuxify']])
    expect(report!.leaks).toEqual(['zorblax'])
    expect(report!.review).toEqual(['quuxify'])
  })

  it('passes a word the corpus never uses, and reports six-word sequences shared with it', () => {
    const [report] = check(sources, [
      ['mirror.md', 'lorem: ledger syncs with lorem on every night of the week'],
    ])
    expect(report!.leaks).toEqual([])
    expect(report!.shared).toEqual(['on every night of the week'])
  })

  it('fails a URL off the allowed hosts and passes the placeholder', () => {
    const [report] = check(sources, [
      [
        'mirror.md',
        'https://example.com/ https://github.com/dbarjs/hero-synergy/issues/1 https://wiki.internal/x',
      ],
    ])
    expect(report!.outside).toEqual(['https://wiki.internal/x'])
  })
})
