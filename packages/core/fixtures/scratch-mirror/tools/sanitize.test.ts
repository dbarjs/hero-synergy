import { describe, expect, it } from '@effect/vitest'

import {
  classifyToken,
  type LineContext,
  PathPlan,
  relinker,
  sanitizeFile,
  sanitizeLine,
  sanitizeText,
  shiftDate,
} from './sanitize.ts'

const context: LineContext = { shiftDays: 10, relink: (target) => `<${target}>` }
const line = (text: string) => sanitizeLine(text, context)

describe('classifyToken', () => {
  it('keeps signal words, hard, and soft words and small numbers, soft', () => {
    expect(classifyToken('closed')).toEqual({ text: 'closed', hard: true })
    expect(classifyToken('Resolução')).toEqual({ text: 'Resolução', hard: true })
    expect(classifyToken('wayfinder:task')).toEqual({ text: 'wayfinder:task', hard: true })
    expect(classifyToken('ready-for-human')).toEqual({ text: 'ready-for-human', hard: true })
    expect(classifyToken('the')).toEqual({ text: 'the', hard: false })
    expect(classifyToken('07')).toEqual({ text: '07', hard: false })
    expect(classifyToken("map's")).toEqual({ text: "map's", hard: true })
  })

  it('replaces any other word, a compound holding one, and a token holding a date', () => {
    expect(classifyToken('invoices')).toBeNull()
    expect(classifyToken('useLedgerSort')).toBeNull()
    expect(classifyToken('closed-invoices')).toBeNull()
    expect(classifyToken('a1b2c3d')).toBeNull()
    expect(classifyToken('report-2026-01-02')).toBeNull()
  })

  it('writes a number of three digits or more as 100', () => {
    expect(classifyToken('1441')?.text).toBe('100')
    expect(classifyToken('96.44')?.text).toBe('96.44')
  })
})

describe('shiftDate', () => {
  it('moves a date by whole days across months and years', () => {
    expect(shiftDate('2026-12-28', 10)).toBe('2027-01-07')
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('leaves a string that is no date as it is', () => {
    expect(shiftDate('2026-13-45', 10)).toBe('2026-13-45')
  })
})

describe('sanitizeText', () => {
  it('folds each run of replaced words into one placeholder, keeping its capital', () => {
    expect(sanitizeText('Invoices, refunds; ledgers', context).text).toBe('Lorem')
    expect(sanitizeText('Invoices and refunds', context).text).toBe('Lorem and lorem')
  })

  it('shifts dates, a month-day range end and a day-first date', () => {
    expect(sanitizeText('closed 2026-01-02', context).text).toBe('closed 2026-01-12')
    expect(sanitizeText('closed 2026-01-02T10:30', context).text).toBe('closed 2026-01-12T10:30')
    expect(sanitizeText('open 2026-01-02→01-05', context).text).toBe('open 2026-01-12→01-15')
    expect(sanitizeText('done 02/01/2026', context).text).toBe('done 12/01/2026')
  })

  it('relinks a bare numbered file name, as a blocker line writes it', () => {
    expect(sanitizeText('Blocked by: 03-ledger-sync.md (closed)', context).text).toBe(
      'Blocked by: <03-ledger-sync.md> (closed)',
    )
  })

  it('relinks a relative target and replaces a URL off the allowed hosts', () => {
    expect(sanitizeText('[03](03-ledger.md)', context).text).toBe('[03](<03-ledger.md>)')
    expect(sanitizeText('see https://intranet.example.org/x', context).text).toBe(
      'see https://example.com/',
    )
    expect(sanitizeText('https://github.com/mattpocock/skills/tree/main', context).text).toBe(
      'https://github.com/mattpocock/skills/tree/main',
    )
  })

  it('with soft, drops soft words far from a signal word and reports what carries state', () => {
    const near = sanitizeText('closed by 07 after the ledger sync', context, { soft: true })
    expect(near).toEqual({ text: 'closed by 07 after lorem', hard: true })
    const far = sanitizeText('the ledger is in the vault and on the shelf', context, { soft: true })
    expect(far).toEqual({ text: 'lorem', hard: false })
  })
})

describe('sanitizeLine', () => {
  it('keeps the type of an H1 and replaces its title', () => {
    expect(line('# Research: Which ledger?')).toBe('# Research: Lorem ipsum')
    expect(line('# Which ledger?')).toBe('# Lorem ipsum')
  })

  it('keeps every kept word of a heading and of a header line', () => {
    expect(line('## Not yet specified')).toBe('## Not yet specified')
    expect(line('### Resolution (2026-01-02, grilling with Ana)')).toBe(
      '### Resolution (2026-01-12, grilling with Lorem)',
    )
    expect(line('**Status:** ready-for-human')).toBe('**Status:** ready-for-human')
    expect(line('Labels: wayfinder:task, ready-for-agent')).toBe(
      'Labels: wayfinder:task, ready-for-agent',
    )
    expect(line('Blocked by: 03, 07 (closed 2026-01-02)')).toBe(
      'Blocked by: 03, 07 (closed 2026-01-12)',
    )
  })

  it('collapses a prose line to its prefix and Lorem ipsum., numbered or checked', () => {
    expect(line('The ledger syncs every night from the vault.')).toBe('Lorem ipsum.')
    expect(line('1. The ledger syncs nightly.')).toBe('1. Lorem ipsum.')
    expect(line('- [x] Ledger syncs nightly.')).toBe('- [x] Lorem ipsum.')
  })
})

describe('sanitizeFile', () => {
  it('collapses a paragraph to one line, keeps list items, fences and safe fence languages', () => {
    const body = [
      '# Task: Ledger sync',
      '',
      'Status: closed',
      '',
      '## Question',
      '',
      'The ledger syncs every night.',
      'It reads from the vault.',
      '- One ledger.',
      '- Two vaults.',
      '```nginx',
      'server { listen 80; }',
      'server { listen 81; }',
      '```',
      '```ts',
      '```',
    ].join('\n')
    expect(sanitizeFile(body, context).split('\n')).toEqual([
      '# Task: Lorem ipsum',
      '',
      'Status: closed',
      '',
      '## Question',
      '',
      'Lorem ipsum.',
      '- Lorem ipsum.',
      '- Lorem ipsum.',
      '```',
      'lorem',
      '```',
      '```ts',
      '```',
    ])
  })
})

describe('PathPlan', () => {
  const plan = new PathPlan()
  plan.plan('', [
    { name: 'zeta-ledger', directory: true },
    { name: 'alpha-sync', directory: true },
  ])
  plan.plan('alpha-sync', [
    { name: 'MAP.md', directory: false },
    { name: 'issues', directory: true },
    { name: 'assets', directory: true },
    { name: 'handoff-ana.md', directory: false },
  ])
  plan.plan('alpha-sync/issues', [
    { name: '02-vault.md', directory: false },
    { name: '01-ledger.md', directory: false },
    { name: '01-ledger-take-two.md', directory: false },
  ])
  plan.plan('alpha-sync/assets', [
    { name: '01-smoke', directory: true },
    { name: 'shot.png', directory: false },
  ])

  it('names efforts by sorted position and keeps the names a reader looks for', () => {
    expect(plan.rename('alpha-sync')).toBe('effort-01')
    expect(plan.rename('zeta-ledger')).toBe('effort-02')
    expect(plan.rename('alpha-sync/MAP.md')).toBe('effort-01/MAP.md')
  })

  it('keeps ticket numbers, and tells apart two files with the same one in their sorted order', () => {
    expect(plan.rename('alpha-sync/issues/02-vault.md')).toBe('effort-01/issues/02-ticket.md')
    expect(plan.rename('alpha-sync/issues/01-ledger-take-two.md')).toBe(
      'effort-01/issues/01-ticket-a.md',
    )
    expect(plan.rename('alpha-sync/issues/01-ledger.md')).toBe('effort-01/issues/01-ticket-b.md')
  })

  it('names other files and directories generically, and an unplanned path with a placeholder', () => {
    expect(plan.rename('alpha-sync/handoff-ana.md')).toBe('effort-01/note-1.md')
    expect(plan.rename('alpha-sync/assets/01-smoke')).toBe('effort-01/assets/01-folder')
    expect(plan.rename('alpha-sync/assets/shot.png')).toBe('effort-01/assets/file-1.png')
    expect(plan.rename('alpha-sync/issues/07-gone.md')).toBe('effort-01/issues/07-lorem.md')
  })

  it('relinks a target relative to the renamed file, inside or outside the corpus', () => {
    const relink = relinker(plan, 'alpha-sync/issues/02-vault.md')
    expect(relink('01-ledger.md')).toBe('01-ticket-b.md')
    expect(relink('../MAP.md#decisions-so-far')).toBe('../MAP.md#decisions-so-far')
    expect(relink('../MAP.md#ledger-notes')).toBe('../MAP.md#section')
    expect(relink('../assets/01-smoke/')).toBe('../assets/01-folder/')
    expect(relink('../../../src/ledger.ts')).toBe('../../../path/to/lorem.ts')
    expect(relink('/home/ana/ledger.md')).toBe('/path/to/lorem.md')
  })
})
