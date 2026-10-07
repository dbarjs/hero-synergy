import { describe, expect, it } from 'vite-plus/test'

import {
  type CanaryState,
  type FileContext,
  type OpenBreak,
  type Tracker,
  fileBreaks,
  inlineLimit,
  lastMarker,
  renderMarker,
  summaryOf,
} from '../src/file-breaks.ts'
import type { Report, Upstream } from '../src/report.ts'

/** A tracker that keeps issues in memory, the way GitHub would answer the adapter. */
function memoryTracker() {
  const issues: Array<{
    number: number
    upstream: Upstream
    title: string
    body: string
    labels: ReadonlyArray<string>
    assignee: string
    comments: string[]
  }> = []
  const tracker: Tracker = {
    async findOpenBreak(upstream): Promise<OpenBreak | null> {
      const issue = issues.find((candidate) => candidate.upstream === upstream)
      if (issue === undefined) return null
      return { number: issue.number, marker: lastMarker([issue.body, ...issue.comments]) }
    },
    async open({ title, body, labels, assignee }) {
      const number = 100 + issues.length
      const upstream = title.split(' ')[2] as Upstream
      issues.push({ number, upstream, title, body, labels, assignee, comments: [] })
      return number
    },
    async comment(number, body) {
      issues.find((issue) => issue.number === number)?.comments.push(body)
    },
  }
  return { tracker, issues }
}

const context = (tracker: Tracker, previous: CanaryState = {}): FileContext => ({
  tracker,
  assignee: 'eduardo',
  runUrl: 'https://github.com/dbarjs/hero-synergy/actions/runs/1',
  previous,
  date: '2026-10-08',
})

const red = (upstream: Upstream, version: string, ...contracts: string[]): Report => ({
  upstream,
  version,
  seen: {},
  failures: contracts.map((contract) => ({
    contract,
    row: `Launch flags › ${contract}`,
    error: `${contract} is gone\nat somewhere`,
  })),
  output: 'recorded output of the failing job',
})

const green = (upstream: Upstream, version: string): Report => ({
  upstream,
  version,
  seen: {},
  failures: [],
  output: '',
})

describe('filing upstream breaks', () => {
  it('opens one issue per upstream on a first break, with title, labels, assignee and sections', async () => {
    const { tracker, issues } = memoryTracker()
    const previous: CanaryState = {
      claude: {
        version: '2.1.292',
        green: true,
        lastGreen: { version: '2.1.292', date: '2026-10-07' },
        firstRed: null,
      },
    }

    const { filed } = await fileBreaks(
      [
        red('claude', '2.1.300', '--worktree', 'agents-json'),
        red('skills', '1.4.0', 'wayfinder-headings'),
        green('node', '26.10.0'),
      ],
      context(tracker, previous),
    )

    expect(filed.map((entry) => [entry.upstream, entry.action])).toEqual([
      ['claude', 'opened'],
      ['skills', 'opened'],
      ['node', 'none'],
    ])
    expect(issues).toHaveLength(2)

    const [claude, skills] = issues
    expect(claude?.title).toBe('Upstream break: claude 2.1.300')
    expect(skills?.title).toBe('Upstream break: skills 1.4.0')
    expect(claude?.labels).toEqual(['canary', 'ready-for-human'])
    expect(claude?.assignee).toBe('eduardo')
    for (const heading of [
      '## Failing contracts',
      '## Last green → first red',
      '## Error',
      '## Output',
    ]) {
      expect(claude?.body).toContain(heading)
    }
    expect(claude?.body).toContain('`--worktree`')
    expect(claude?.body).toContain('Register row: Launch flags › --worktree')
    expect(claude?.body).toContain('Last green: 2.1.292 (2026-10-07)')
    expect(claude?.body).toContain('First red: 2.1.300 (2026-10-08)')
    expect(claude?.body).toContain('actions/runs/1')
    expect(skills?.body).toContain('Last green: never seen by the canary')
  })

  it('shows at most 2 KB of output inline', async () => {
    const { tracker, issues } = memoryTracker()
    const report = { ...red('gh', '2.101.0', 'live'), output: 'x'.repeat(10_000) + 'THE-END' }

    await fileBreaks([report], context(tracker))

    const body = issues[0]?.body ?? ''
    expect(body).toContain('THE-END')
    expect(body).toContain('the artifact has all of it')
    expect(body.length).toBeLessThan(inlineLimit * 2 + 2_000)
  })

  it('comments nothing when the failing set and the version are unchanged', async () => {
    const { tracker, issues } = memoryTracker()
    await fileBreaks([red('claude', '2.1.300', 'a', 'b')], context(tracker))

    const { filed } = await fileBreaks([red('claude', '2.1.300', 'b', 'a')], context(tracker))

    expect(filed).toEqual([{ upstream: 'claude', action: 'none' }])
    expect(issues).toHaveLength(1)
    expect(issues[0]?.comments).toEqual([])
  })

  it('comments when the version changes, and again only when it changes again', async () => {
    const { tracker, issues } = memoryTracker()
    await fileBreaks([red('claude', '2.1.300', 'a')], context(tracker))

    const changed = await fileBreaks([red('claude', '2.1.301', 'a')], context(tracker))
    const repeated = await fileBreaks([red('claude', '2.1.301', 'a')], context(tracker))

    expect(changed.filed[0]).toMatchObject({ action: 'commented' })
    expect(repeated.filed[0]).toEqual({ upstream: 'claude', action: 'none' })
    expect(issues).toHaveLength(1)
    expect(issues[0]?.comments).toHaveLength(1)
    expect(issues[0]?.comments[0]).toContain('2.1.301')
    expect(issues[0]?.comments[0]).toContain('was 2.1.300')
  })

  it('comments when the failing set changes, naming what is new and what cleared', async () => {
    const { tracker, issues } = memoryTracker()
    await fileBreaks([red('claude', '2.1.300', 'a', 'b')], context(tracker))

    await fileBreaks([red('claude', '2.1.300', 'b', 'c')], context(tracker))

    const comment = issues[0]?.comments[0] ?? ''
    expect(comment).toContain('Newly failing: `c`')
    expect(comment).toContain('No longer failing: `a`')
  })

  it('comments on a return to green, leaves the issue open, and stays quiet afterwards', async () => {
    const { tracker, issues } = memoryTracker()
    await fileBreaks([red('claude', '2.1.300', 'a')], context(tracker))

    const back = await fileBreaks([green('claude', '2.1.301')], context(tracker))
    const after = await fileBreaks([green('claude', '2.1.302')], context(tracker))

    expect(back.filed[0]).toMatchObject({ action: 'commented', number: 100 })
    expect(after.filed[0]).toEqual({ upstream: 'claude', action: 'none' })
    expect(issues[0]?.comments).toHaveLength(1)
    expect(issues[0]?.comments[0]).toContain('Green again on **2.1.301**')
    expect(issues[0]?.comments[0]).toContain('stays open')
  })

  it('comments when a break returns after a green comment', async () => {
    const { tracker, issues } = memoryTracker()
    await fileBreaks([red('claude', '2.1.300', 'a')], context(tracker))
    await fileBreaks([green('claude', '2.1.301')], context(tracker))

    await fileBreaks([red('claude', '2.1.301', 'a')], context(tracker))

    expect(issues).toHaveLength(1)
    expect(issues[0]?.comments).toHaveLength(2)
  })

  it('opens nothing on green', async () => {
    const { tracker, issues } = memoryTracker()

    const { filed } = await fileBreaks(
      [green('claude', '2.1.292'), green('skills', '1.3.1'), green('node', '26.10.0')],
      context(tracker),
    )

    expect(filed.every((entry) => entry.action === 'none')).toBe(true)
    expect(issues).toEqual([])
  })
})

describe('the state carried between runs', () => {
  it('keeps the first red across red runs and clears it on green', async () => {
    const { tracker } = memoryTracker()
    const first = await fileBreaks([green('claude', '2.1.292')], context(tracker))
    const second = await fileBreaks([red('claude', '2.1.300', 'a')], {
      ...context(tracker, first.state),
      date: '2026-10-09',
    })
    const third = await fileBreaks([red('claude', '2.1.301', 'a')], {
      ...context(tracker, second.state),
      date: '2026-10-10',
    })
    const fourth = await fileBreaks([green('claude', '2.1.302')], {
      ...context(tracker, third.state),
      date: '2026-10-11',
    })

    expect(third.state.claude?.firstRed).toEqual({ version: '2.1.300', date: '2026-10-09' })
    expect(third.state.claude?.lastGreen).toEqual({ version: '2.1.292', date: '2026-10-08' })
    expect(fourth.state.claude?.firstRed).toBeNull()
    expect(fourth.state.claude?.lastGreen).toEqual({ version: '2.1.302', date: '2026-10-11' })
  })
})

describe('the step summary', () => {
  it('lists every upstream with the version it ran against', () => {
    const reports = [green('claude', '2.1.292'), red('skills', '1.3.1', 'wayfinder-headings')]
    const text = summaryOf(
      [{ ...reports[0]!, seen: { installer: 'latest' } }, reports[1]!],
      [{ upstream: 'skills', action: 'opened', number: 101 }],
      {},
    )

    expect(text).toContain('| claude | 2.1.292 | green | installer latest |')
    expect(text).toContain('| skills | 1.3.1 | red: `wayfinder-headings` |')
    expect(text).toContain('#101')
    expect(text).toContain('| vscode | not run |')
  })
})

describe('markers', () => {
  it('reads the newest marker and skips one that was edited by hand', () => {
    const older = renderMarker({ version: '1', failing: ['a'] })
    const newer = renderMarker({ version: '2', failing: [] })

    expect(lastMarker([older, 'text', newer])?.version).toBe('2')
    expect(lastMarker([older, '<!-- canary-state {broken} -->'])?.version).toBe('1')
    expect(lastMarker(['no marker here'])).toBeNull()
  })
})
