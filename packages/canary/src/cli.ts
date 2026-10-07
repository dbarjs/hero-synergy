import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'

import { run, transcript } from './exec.ts'
import { type CanaryState, fileBreaks, summaryOf } from './file-breaks.ts'
import { ghTracker } from './github.ts'
import { type Report, isUpstream, mergeReports, upstreams } from './report.ts'

/** A dispatched run can force one upstream red, to prove the filing end to end. */
function withForcedFailure(report: Report): Report {
  if (process.env.CANARY_FORCE_FAIL !== report.upstream) return report
  return {
    ...report,
    failures: [
      ...report.failures,
      {
        contract: 'forced',
        row: 'Dispatched with force_fail: no register row',
        error: `${report.upstream} was forced to fail by the workflow_dispatch input`,
      },
    ],
  }
}

async function writeReport(out: string, report: Report): Promise<void> {
  await mkdir(path.dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(withForcedFailure(report), null, 2))
}

async function readReports(dir: string): Promise<Report[]> {
  const files = (await readdir(dir, { recursive: true })).filter((file) => file.endsWith('.json'))
  const reports: Report[] = []
  for (const file of files) {
    const parsed = JSON.parse(await readFile(path.join(dir, file), 'utf8')) as Report
    if (isUpstream(parsed.upstream)) reports.push(parsed)
  }
  return upstreams.flatMap((upstream) => {
    const merged = mergeReports(reports.filter((report) => report.upstream === upstream))
    return merged === null ? [] : [merged]
  })
}

async function readState(file: string | undefined): Promise<CanaryState> {
  if (file === undefined) return {}
  try {
    return JSON.parse(await readFile(file, 'utf8')) as CanaryState
  } catch {
    return {}
  }
}

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv
  const dashes = rest.indexOf('--')
  const own = dashes === -1 ? rest : rest.slice(0, dashes)
  const trailing = dashes === -1 ? [] : rest.slice(dashes + 1)
  const { values } = parseArgs({
    args: own,
    options: {
      out: { type: 'string' },
      upstream: { type: 'string' },
      version: { type: 'string' },
      contract: { type: 'string' },
      row: { type: 'string' },
      source: { type: 'string', multiple: true },
      seen: { type: 'string', multiple: true },
      marketplace: { type: 'boolean' },
      reports: { type: 'string' },
      state: { type: 'string' },
      'state-out': { type: 'string' },
      'run-url': { type: 'string' },
      assignee: { type: 'string' },
      date: { type: 'string' },
    },
  })

  if (command === 'claude') {
    const { checkClaude } = await import('./check-claude.ts')
    await writeReport(required(values.out, '--out'), await checkClaude())
    return
  }

  if (command === 'skills') {
    const { checkSkills, marketplaceCopy } = await import('./check-skills.ts')
    const seen: Record<string, string> = {}
    for (const pair of values.seen ?? []) {
      const [key, ...value] = pair.split('=')
      seen[key ?? ''] = value.join('=')
    }
    const sources = (values.source ?? []).map((pair) => {
      const [label, ...dir] = pair.split('=')
      return { label: label ?? '', dir: dir.join('=') }
    })
    if (values.marketplace === true) {
      const copy = await marketplaceCopy()
      if (copy === null) {
        const report = await checkSkills(sources, seen)
        await writeReport(required(values.out, '--out'), {
          ...report,
          failures: [
            ...report.failures,
            {
              contract: 'marketplace: install',
              row: 'Install routes › the official marketplace pins a `main` commit',
              error: 'mattpocock-skills is not in `claude plugin list --json`',
            },
          ],
        })
        return
      }
      sources.push({ label: 'marketplace', dir: copy.dir })
      seen.marketplace = copy.version
    }
    await writeReport(required(values.out, '--out'), await checkSkills(sources, seen))
    return
  }

  if (command === 'tag') {
    const { latestTag } = await import('./check-skills.ts')
    // The latest `vX.Y.Z` tag of a remote, printed for the workflow to clone.
    const ran = await run('git', ['ls-remote', '--tags', '--refs', trailing[0] ?? ''])
    process.stdout.write(`${latestTag(ran.stdout) ?? ''}\n`)
    return
  }

  if (command === 'run') {
    // A suite or a probe as a contract: its exit code is the verdict, its transcript the capture.
    const upstream = required(values.upstream, '--upstream')
    if (!isUpstream(upstream)) throw new Error(`unknown upstream ${upstream}`)
    const [program, ...args] = trailing
    if (program === undefined) throw new Error('run needs a command after --')
    const ran = await run(program, args, { timeoutMs: 25 * 60_000 })
    const output = transcript(program, args, ran)
    process.stdout.write(output)
    const seen: Record<string, string> = {}
    for (const pair of values.seen ?? []) {
      const [key, ...value] = pair.split('=')
      seen[key ?? ''] = value.join('=')
    }
    await writeReport(required(values.out, '--out'), {
      upstream,
      version: required(values.version, '--version'),
      seen,
      output,
      failures:
        ran.code === 0
          ? []
          : [
              {
                contract: required(values.contract, '--contract'),
                row: required(values.row, '--row'),
                error: `exit ${ran.code}: ${(ran.stderr || ran.stdout).trim().split('\n').slice(-3).join(' | ')}`,
              },
            ],
    })
    return
  }

  if (command === 'file') {
    const reports = await readReports(required(values.reports, '--reports'))
    const date = values.date ?? new Date().toISOString().slice(0, 10)
    const previous = await readState(values.state)
    const { filed, state } = await fileBreaks(reports, {
      tracker: ghTracker(),
      assignee: required(values.assignee, '--assignee'),
      runUrl: required(values['run-url'], '--run-url'),
      previous,
      date,
    })
    const summary = summaryOf(reports, filed, state)
    process.stdout.write(summary)
    if (process.env.GITHUB_STEP_SUMMARY !== undefined) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
    }
    const stateOut = required(values['state-out'], '--state-out')
    await mkdir(path.dirname(stateOut), { recursive: true })
    await writeFile(stateOut, JSON.stringify(state, null, 2))
    return
  }

  throw new Error(
    `unknown command ${command ?? '(none)'}; expected claude, skills, tag, run or file`,
  )
}

function required(value: string | undefined, flag: string): string {
  if (value === undefined) throw new Error(`${flag} is required`)
  return value
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
