/** The five upstreams the Cockpit relies on, one canary job each. */
export const upstreams = ['claude', 'skills', 'vscode', 'gh', 'node'] as const
export type Upstream = (typeof upstreams)[number]

/** One contract that broke: its name here, the register row it protects and what went wrong. */
export interface Failure {
  readonly contract: string
  /** The register row, as "<section> › <what the row says>". */
  readonly row: string
  readonly error: string
}

/** What one canary job saw: the version it ran against and every contract that broke. */
export interface Report {
  readonly upstream: Upstream
  /** The version that identifies the break in its issue title: the tag, the release, the `x.y.z`. */
  readonly version: string
  /** Other versions seen, for the step summary only (a `main` commit never opens a comment). */
  readonly seen: Readonly<Record<string, string>>
  readonly failures: ReadonlyArray<Failure>
  /** The full capture; the artifact keeps all of it and the issue shows the tail. */
  readonly output: string
}

export const isGreen = (report: Report): boolean => report.failures.length === 0

export const isUpstream = (value: string): value is Upstream =>
  (upstreams as ReadonlyArray<string>).includes(value)

/** Several reports of one upstream (the VS Code job runs on two systems) as one. */
export function mergeReports(reports: ReadonlyArray<Report>): Report | null {
  const [first] = reports
  if (first === undefined) return null
  return {
    upstream: first.upstream,
    version: first.version,
    seen: Object.assign({}, ...reports.map((report) => report.seen)),
    failures: reports.flatMap((report) => report.failures),
    output: reports.map((report) => report.output).join('\n'),
  }
}
