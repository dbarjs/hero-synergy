import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'

import {
  ARTIFACT,
  CAPTURED,
  type CaptureRun,
  jobSummary,
  KEPT,
  latestFinishedRun,
  mediaReferences,
  REFRESH_COMMAND,
  refreshMedia,
} from './refresh.mts'

const repoRoot = path.resolve(import.meta.dirname, '../../../..')
const mediaDir = path.join(repoRoot, 'docs/media')

describe('mediaReferences', () => {
  it('reads relative paths and tag-pinned raw URLs, each file once', () => {
    const markdown = [
      '<img src="docs/media/window-map.png" width="880" alt="x">',
      '<img src="https://raw.githubusercontent.com/dbarjs/hero-synergy/v0.1.3/docs/media/launch.gif" width="880">',
      '![loop](./docs/media/launch.gif)',
      '[the map](https://raw.githubusercontent.com/dbarjs/hero-synergy/v0.2.0/docs/media/badge-icon.png)',
      '<img src="docs/media/window-map.png">',
    ].join('\n')
    expect(mediaReferences(markdown)).toEqual(['window-map.png', 'launch.gif', 'badge-icon.png'])
  })

  it('leaves other images and links alone', () => {
    expect(
      mediaReferences(
        '<img src="https://img.shields.io/badge/x.svg"> [ADR](docs/adr/0003.md) media/icon.png',
      ),
    ).toEqual([])
  })
})

describe('the media the READMEs show', () => {
  // The one check that fails on media: a shot renamed or dropped in a refresh breaks a README.
  for (const readme of ['README.md', 'packages/vscode/README.md']) {
    it(`exists for every docs/media/ file ${readme} references`, () => {
      const references = mediaReferences(readFileSync(path.join(repoRoot, readme), 'utf8'))
      expect(references.length).toBeGreaterThan(0)
      const missing = references.filter((file) => !existsSync(path.join(mediaDir, file)))
      expect(missing).toEqual([])
    })
  }

  it('keeps only files the capture run makes', () => {
    const captured: ReadonlyArray<string> = CAPTURED
    expect(KEPT.filter((file) => !captured.includes(file))).toEqual([])
  })

  it('has every kept file in docs/media/', () => {
    expect(KEPT.filter((file) => !existsSync(path.join(mediaDir, file)))).toEqual([])
  })
})

describe('latestFinishedRun', () => {
  const run = (databaseId: number, createdAt: string, status = 'completed'): CaptureRun => ({
    databaseId,
    headSha: `sha${databaseId}`,
    status,
    conclusion: status === 'completed' ? 'success' : '',
    createdAt,
  })

  it('takes the newest finished run, whatever order gh gives', () => {
    expect(
      latestFinishedRun([
        run(1, '2026-10-09T10:00:00Z'),
        run(3, '2026-10-09T12:00:00Z'),
        run(2, '2026-10-09T11:00:00Z'),
      ])?.databaseId,
    ).toBe(3)
  })

  it('skips a run still in progress', () => {
    expect(
      latestFinishedRun([
        run(4, '2026-10-09T13:00:00Z', 'in_progress'),
        run(3, '2026-10-09T12:00:00Z'),
      ])?.databaseId,
    ).toBe(3)
  })

  it('finds none in an empty list', () => {
    expect(latestFinishedRun([])).toBeUndefined()
  })
})

describe('refreshMedia', () => {
  let root: string
  let media: string
  let calls: string[][]
  let lines: string[]

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'refresh-test-'))
    media = path.join(root, 'media')
    mkdirSync(media)
    calls = []
    lines = []
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  /** A `gh` that lists these runs and downloads an artifact holding these files. */
  const fakeGh =
    (runs: CaptureRun[], artifact: Record<string, string>) => (args: ReadonlyArray<string>) => {
      calls.push([...args])
      if (args[1] === 'list') return JSON.stringify(runs)
      const dir = args[args.indexOf('--dir') + 1]!
      for (const [file, content] of Object.entries(artifact)) {
        writeFileSync(path.join(dir, file), content)
      }
      return ''
    }

  const finished: CaptureRun = {
    databaseId: 42,
    headSha: 'abcdef1234',
    status: 'completed',
    conclusion: 'success',
    createdAt: '2026-10-09T12:00:00Z',
  }
  const everyKept = Object.fromEntries(KEPT.map((file) => [file, `new ${file}`]))

  it('copies the kept files from the branch’s latest run and says which changed', () => {
    writeFileSync(path.join(media, 'window-map.png'), 'new window-map.png')
    writeFileSync(path.join(media, 'launch.gif'), 'old launch.gif')
    const results = refreshMedia(
      { branch: 'worktree-149', head: 'abcdef1234', mediaDir: media },
      {
        gh: fakeGh([finished], { ...everyKept, 'terminal.png': 'not kept' }),
        log: (line) => lines.push(line),
      },
    )

    expect(calls[0]).toEqual(expect.arrayContaining(['--workflow', 'capture.yml']))
    expect(calls[0]).toEqual(expect.arrayContaining(['--branch', 'worktree-149']))
    expect(calls[1]).toEqual(expect.arrayContaining(['download', '42', '--name', ARTIFACT]))
    expect(readdirSync(media).toSorted()).toEqual([...KEPT].toSorted())
    for (const file of KEPT) {
      expect(readFileSync(path.join(media, file), 'utf8')).toBe(`new ${file}`)
    }
    expect(Object.fromEntries(results.map(({ file, change }) => [file, change]))).toMatchObject({
      'window-map.png': 'unchanged',
      'launch.gif': 'updated',
      'badge-icon.png': 'new',
    })
    expect(lines).toContain('updated   docs/media/launch.gif')
    expect(lines.some((line) => line.startsWith('note:'))).toBe(false)
  })

  it('notes when the shots are of another commit than the one checked out', () => {
    refreshMedia(
      { branch: 'worktree-149', head: '9999999999', mediaDir: media },
      { gh: fakeGh([finished], everyKept), log: (line) => lines.push(line) },
    )
    expect(lines).toContain('note: 9999999 is checked out; the shots are of abcdef1')
  })

  it('downloads the run it is given without listing any', () => {
    refreshMedia(
      { branch: 'worktree-149', head: 'abcdef1234', mediaDir: media, runId: 7 },
      { gh: fakeGh([], everyKept), log: () => {} },
    )
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual(expect.arrayContaining(['download', '7']))
  })

  it('refuses, copying nothing, when the run lacks a kept file', () => {
    const { 'launch.gif': _gif, ...withoutGif } = everyKept
    expect(() =>
      refreshMedia(
        { branch: 'worktree-149', head: 'abcdef1234', mediaDir: media },
        { gh: fakeGh([finished], { ...withoutGif, 'failure.png': '' }), log: () => {} },
      ),
    ).toThrow(`Capture run 42 has no launch.gif in ${ARTIFACT}`)
    expect(readdirSync(media)).toEqual([])
  })

  it('says how to get a run when the branch has none', () => {
    expect(() =>
      refreshMedia(
        { branch: 'worktree-149', head: 'abcdef1234', mediaDir: media },
        { gh: fakeGh([], everyKept), log: () => {} },
      ),
    ).toThrow('gh workflow run capture.yml --ref worktree-149')
  })
})

describe('jobSummary', () => {
  let outDir: string

  beforeEach(() => {
    outDir = mkdtempSync(path.join(tmpdir(), 'summary-test-'))
  })

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true })
  })

  it('lists every kept file with its size, and the command that copies them', () => {
    for (const file of KEPT) writeFileSync(path.join(outDir, file), Buffer.alloc(2048))
    const summary = jobSummary(outDir)
    expect(summary).toContain(REFRESH_COMMAND)
    for (const file of KEPT) expect(summary).toContain(`| \`${file}\` | 2 KB |`)
  })

  it('marks a kept file the run did not make', () => {
    expect(jobSummary(outDir)).toContain('| `launch.gif` | **missing** |')
  })
})
