import { type Report, type Upstream, isGreen, upstreams } from './report.ts'

/** Labels every break carries; `canary` is created on first use. */
export const breakLabels = ['canary', 'ready-for-human'] as const

/** Longest slice of a capture shown inside an issue; the artifact holds the rest. */
export const inlineLimit = 2048

/** What the canary remembers of an upstream between runs, carried in the previous run's artifact. */
export interface UpstreamState {
  readonly version: string
  readonly green: boolean
  readonly lastGreen: { readonly version: string; readonly date: string } | null
  readonly firstRed: { readonly version: string; readonly date: string } | null
}

export type CanaryState = Partial<Record<Upstream, UpstreamState>>

/** The state of a run: green moves `lastGreen` and clears `firstRed`; red keeps the first red it saw. */
export function nextState(
  previous: CanaryState,
  reports: ReadonlyArray<Report>,
  date: string,
): CanaryState {
  const state: CanaryState = { ...previous }
  for (const report of reports) {
    const before = previous[report.upstream]
    state[report.upstream] = isGreen(report)
      ? {
          version: report.version,
          green: true,
          lastGreen: { version: report.version, date },
          firstRed: null,
        }
      : {
          version: report.version,
          green: false,
          lastGreen: before?.lastGreen ?? null,
          firstRed: before?.firstRed ?? { version: report.version, date },
        }
  }
  return state
}

/** What the last issue body or comment said about the upstream, read back from its hidden marker. */
export interface Marker {
  readonly version: string
  readonly failing: ReadonlyArray<string>
}

const markerPattern = /<!-- canary-state (\{.*?\}) -->/g

export const renderMarker = (marker: Marker): string =>
  `<!-- canary-state ${JSON.stringify(marker)} -->`

/** The newest marker among texts given oldest first: the issue body, then its comments. */
export function lastMarker(texts: ReadonlyArray<string>): Marker | null {
  let found: Marker | null = null
  for (const text of texts) {
    for (const match of text.matchAll(markerPattern)) {
      try {
        const parsed = JSON.parse(match[1] ?? '') as Marker
        if (typeof parsed.version === 'string' && Array.isArray(parsed.failing)) found = parsed
      } catch {
        // A marker someone edited by hand is skipped; the next run comments and writes a new one.
      }
    }
  }
  return found
}

/** The open issue for an upstream, as the tracker adapter found it. */
export interface OpenBreak {
  readonly number: number
  /** `null` when no marker survives in the body or the comments. */
  readonly marker: Marker | null
}

export interface Tracker {
  findOpenBreak(upstream: Upstream): Promise<OpenBreak | null>
  open(issue: {
    title: string
    body: string
    labels: ReadonlyArray<string>
    assignee: string
  }): Promise<number>
  comment(number: number, body: string): Promise<void>
}

export interface FileContext {
  readonly tracker: Tracker
  readonly assignee: string
  /** The run page, where the full capture is attached as an artifact. */
  readonly runUrl: string
  readonly previous: CanaryState
  readonly date: string
}

/** What the filing did for one upstream. */
export type Filed =
  | { upstream: Upstream; action: 'none' }
  | { upstream: Upstream; action: 'opened'; number: number }
  | { upstream: Upstream; action: 'commented'; number: number }

const failingOf = (report: Report): string[] =>
  [...new Set(report.failures.map((failure) => failure.contract))].sort()

const sameSet = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index])

/** The last `inlineLimit` characters of a capture: the end of a failing run is where the error is. */
export function tailOf(output: string): string {
  const trimmed = output.trim()
  if (trimmed.length <= inlineLimit) return trimmed
  return `… (${trimmed.length - inlineLimit} characters cut; the artifact has all of it)\n${trimmed.slice(-inlineLimit)}`
}

const fence = (text: string): string => {
  const ticks = '`'.repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map((m) => m[0].length + 1)))
  return `${ticks}text\n${text}\n${ticks}`
}

function failingSection(report: Report): string {
  return report.failures
    .map(
      (failure) =>
        `- \`${failure.contract}\`\n  - Register row: ${failure.row}\n  - Error: ${failure.error.split('\n')[0]}`,
    )
    .join('\n')
}

function window(state: UpstreamState | undefined, report: Report, date: string): string {
  const green = state?.lastGreen
  const red = state?.firstRed
  return [
    `Last green: ${green === null || green === undefined ? 'never seen by the canary' : `${green.version} (${green.date})`}`,
    `First red: ${red === null || red === undefined ? `${report.version} (${date})` : `${red.version} (${red.date})`}`,
  ].join('  \n')
}

/** The body of a first break. */
export function breakBody(report: Report, context: FileContext): string {
  const marker: Marker = { version: report.version, failing: failingOf(report) }
  return [
    `The canary found ${report.failures.length === 1 ? 'a contract' : `${report.failures.length} contracts`} the Cockpit would choke on in **${report.upstream} ${report.version}**.`,
    '',
    '## Failing contracts',
    '',
    failingSection(report),
    '',
    '## Last green → first red',
    '',
    window(context.previous[report.upstream], report, context.date),
    '',
    '## Error',
    '',
    fence(
      report.failures
        .map((failure) => `${failure.contract}: ${failure.error}`)
        .join('\n\n')
        .slice(0, inlineLimit),
    ),
    '',
    '## Output',
    '',
    fence(tailOf(report.output)),
    '',
    `The full capture is in the \`canary-${report.upstream}*\` artifacts of [this run](${context.runUrl}).`,
    '',
    renderMarker(marker),
  ].join('\n')
}

function changeComment(report: Report, before: Marker | null, context: FileContext): string {
  const now = failingOf(report)
  const was = before?.failing ?? []
  const lines = [
    `Still failing on **${report.version}**${before === null ? '' : ` (was ${before.version})`}.`,
    '',
  ]
  const added = now.filter((name) => !was.includes(name))
  const gone = was.filter((name) => !now.includes(name))
  if (added.length > 0)
    lines.push(`Newly failing: ${added.map((name) => `\`${name}\``).join(', ')}`)
  if (gone.length > 0)
    lines.push(`No longer failing: ${gone.map((name) => `\`${name}\``).join(', ')}`)
  lines.push(
    '',
    '## Failing contracts',
    '',
    failingSection(report),
    '',
    '## Output',
    '',
    fence(tailOf(report.output)),
  )
  lines.push(
    '',
    `Full capture: the \`canary-${report.upstream}*\` artifacts of [this run](${context.runUrl}).`,
  )
  lines.push('', renderMarker({ version: report.version, failing: now }))
  return lines.join('\n')
}

function greenComment(report: Report, context: FileContext): string {
  return [
    `Green again on **${report.version}** (${context.date}): every watched contract passes. The issue stays open for a human to close.`,
    '',
    renderMarker({ version: report.version, failing: [] }),
  ].join('\n')
}

/**
 * One upstream's report to its issue. A first break opens one issue; a later run comments only
 * when the failing set or the version changed; a return to green comments and leaves it open.
 */
export async function fileBreak(report: Report, context: FileContext): Promise<Filed> {
  const { upstream } = report
  const open = await context.tracker.findOpenBreak(upstream)

  if (isGreen(report)) {
    if (open === null || open.marker === null || open.marker.failing.length === 0) {
      return { upstream, action: 'none' }
    }
    await context.tracker.comment(open.number, greenComment(report, context))
    return { upstream, action: 'commented', number: open.number }
  }

  if (open === null) {
    const number = await context.tracker.open({
      title: `Upstream break: ${upstream} ${report.version}`,
      body: breakBody(report, context),
      labels: breakLabels,
      assignee: context.assignee,
    })
    return { upstream, action: 'opened', number }
  }

  const failing = failingOf(report)
  const unchanged =
    open.marker !== null &&
    open.marker.version === report.version &&
    sameSet(open.marker.failing, failing)
  if (unchanged) return { upstream, action: 'none' }

  await context.tracker.comment(open.number, changeComment(report, open.marker, context))
  return { upstream, action: 'commented', number: open.number }
}

/** Every report to its issue, in upstream order, then the new state for the next run. */
export async function fileBreaks(
  reports: ReadonlyArray<Report>,
  context: FileContext,
): Promise<{ filed: Filed[]; state: CanaryState }> {
  const filed: Filed[] = []
  for (const upstream of upstreams) {
    const report = reports.find((candidate) => candidate.upstream === upstream)
    if (report !== undefined) filed.push(await fileBreak(report, context))
  }
  return { filed, state: nextState(context.previous, reports, context.date) }
}

/** The step summary: the versions every upstream ran against and how each did. */
export function summaryOf(
  reports: ReadonlyArray<Report>,
  filed: ReadonlyArray<Filed>,
  state: CanaryState,
): string {
  const rows = upstreams.flatMap((upstream) => {
    const report = reports.find((candidate) => candidate.upstream === upstream)
    if (report === undefined) return [`| ${upstream} | not run | | | |`]
    const seen = Object.entries(report.seen)
      .map(([name, value]) => `${name} ${value}`)
      .join(', ')
    const result = isGreen(report)
      ? 'green'
      : `red: ${[...new Set(report.failures.map((failure) => failure.contract))].map((name) => `\`${name}\``).join(', ')}`
    const issue = filed.find((entry) => entry.upstream === upstream)
    const link = issue !== undefined && issue.action !== 'none' ? `#${issue.number}` : ''
    const lastGreen = state[upstream]?.lastGreen
    return [
      `| ${upstream} | ${report.version} | ${result} | ${seen} | ${link} ${lastGreen === null || lastGreen === undefined ? '' : `last green ${lastGreen.version}`} |`,
    ]
  })
  return [
    '## Canary',
    '',
    '| Upstream | Version | Result | Also seen | Issue |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n')
}
