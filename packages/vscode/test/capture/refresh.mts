/**
 * The way new shots reach the READMEs (#128): which files the capture run makes, which of them
 * `docs/media/` keeps, and `vp run refresh-media`, which copies the kept ones from a branch's latest
 * Capture run. Nothing here launches VS Code.
 */

import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

/** Every file `vp run capture` writes, besides its contact sheet. `launch.webp` needs an ffmpeg with a WebP encoder. */
export const CAPTURED = [
  'tree-dark.png',
  'badge.png',
  'badge-icon.png',
  'focus-pane.png',
  'focus-pane-session.png',
  'detail-map.png',
  'window-map.png',
  'detail-ticket.png',
  'launch.mp4',
  'launch.webp',
  'launch.gif',
  'terminal.png',
  'tree-light.png',
] as const

export type CapturedFile = (typeof CAPTURED)[number]

/** The captured files the READMEs show, copied into `docs/media/` under the same names. */
export const KEPT = [
  'window-map.png',
  'focus-pane.png',
  'focus-pane-session.png',
  'detail-ticket.png',
  'badge-icon.png',
  'launch.gif',
] as const satisfies ReadonlyArray<CapturedFile>

/** The artifact `refresh-media` copies from: the macOS set is the one #116 kept. */
export const ARTIFACT = 'capture-macos'

export const REFRESH_COMMAND = 'vp run refresh-media'

/**
 * The `docs/media/` files a README shows: by relative path, as the repository README does, or by
 * the raw URL pinned to a tag, as the listing does. Each file once, in order of first mention.
 */
export function mediaReferences(markdown: string): string[] {
  const pattern =
    /(?:\]\(|src=")(?:https:\/\/raw\.githubusercontent\.com\/dbarjs\/hero-synergy\/[^/"\s)]+\/|\.\/)?docs\/media\/([^"\s)?#]+)/g
  return [...new Set([...markdown.matchAll(pattern)].map((match) => match[1]!))]
}

export interface CaptureRun {
  readonly databaseId: number
  readonly headSha: string
  readonly status: string
  readonly conclusion: string
  readonly createdAt: string
}

/** The newest finished run; `gh run list` gives them newest first, but the order is not promised. */
export function latestFinishedRun(runs: ReadonlyArray<CaptureRun>): CaptureRun | undefined {
  return runs
    .filter((run) => run.status === 'completed')
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

export type Change = 'new' | 'updated' | 'unchanged'

export interface RefreshIo {
  /** Runs `gh` with these arguments and returns what it printed. */
  readonly gh: (args: ReadonlyArray<string>) => string
  readonly log: (line: string) => void
}

export interface RefreshOptions {
  readonly branch: string
  /** The commit checked out, to say when the shots were taken from another one. */
  readonly head: string
  readonly mediaDir: string
  /** A run to copy from instead of the branch's latest. */
  readonly runId?: number
}

/**
 * Downloads the branch's latest Capture run's macOS artifact and copies the kept files into
 * `mediaDir`. Refuses, copying nothing, when the run lacks one of them.
 */
export function refreshMedia(
  options: RefreshOptions,
  io: RefreshIo,
): Array<{ file: string; change: Change }> {
  const runId = options.runId ?? findRun(options, io)
  const scratch = mkdtempSync(path.join(tmpdir(), 'refresh-media-'))
  try {
    io.gh([
      'run',
      'download',
      String(runId),
      '--repo',
      'dbarjs/hero-synergy',
      '--name',
      ARTIFACT,
      '--dir',
      scratch,
    ])
    const missing = KEPT.filter((file) => !existsSync(path.join(scratch, file)))
    if (missing.length > 0) {
      throw new Error(
        `Capture run ${runId} has no ${missing.join(', ')} in ${ARTIFACT}: its macOS job failed, or it predates the file`,
      )
    }
    return KEPT.map((file) => {
      const from = path.join(scratch, file)
      const to = path.join(options.mediaDir, file)
      const change: Change = !existsSync(to)
        ? 'new'
        : readFileSync(from).equals(readFileSync(to))
          ? 'unchanged'
          : 'updated'
      copyFileSync(from, to)
      io.log(`${change.padEnd(9)} docs/media/${file}`)
      return { file, change }
    })
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

function findRun(options: RefreshOptions, io: RefreshIo): number {
  const runs = JSON.parse(
    io.gh([
      'run',
      'list',
      '--repo',
      'dbarjs/hero-synergy',
      '--workflow',
      'capture.yml',
      '--branch',
      options.branch,
      '--limit',
      '20',
      '--json',
      'databaseId,headSha,status,conclusion,createdAt',
    ]),
  ) as CaptureRun[]
  const run = latestFinishedRun(runs)
  if (run === undefined) {
    throw new Error(
      `No finished Capture run on ${options.branch}. Push a change to the Cockpit's UI, or run ` +
        `\`gh workflow run capture.yml --ref ${options.branch}\`, and wait for it.`,
    )
  }
  io.log(`Capture run ${run.databaseId} (${run.conclusion}) of ${run.headSha.slice(0, 7)}`)
  if (run.headSha !== options.head) {
    io.log(
      `note: ${options.head.slice(0, 7)} is checked out; the shots are of ${run.headSha.slice(0, 7)}`,
    )
  }
  return run.databaseId
}

/** The job summary of a Capture run: the kept files as taken, and how to bring them into the PR. */
export function jobSummary(outDir: string): string {
  const rows = KEPT.map((file) => {
    const at = path.join(outDir, file)
    return existsSync(at)
      ? `| \`${file}\` | ${Math.round(statSync(at).size / 1024)} KB |`
      : `| \`${file}\` | **missing** |`
  })
  return [
    '### README shots',
    '',
    `The files \`docs/media/\` keeps, as this run took them. If the Cockpit looks different, copy them into this PR from \`packages/vscode\`, on this branch, and commit \`docs/media/\`:`,
    '',
    '```sh',
    REFRESH_COMMAND,
    '```',
    '',
    '| File | Size |',
    '| --- | --- |',
    ...rows,
    '',
  ].join('\n')
}
