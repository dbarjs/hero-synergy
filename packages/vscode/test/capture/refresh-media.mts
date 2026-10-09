// Copies the README shots from this branch's latest Capture run into docs/media/ (#128).
//
//   vp run refresh-media              (from packages/vscode) the current branch's latest run
//   node test/capture/refresh-media.mts [--branch <name>] [--run <id>]
//
// Needs `gh`, signed in. Commit docs/media/ afterwards, in the PR that changed the Cockpit.

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { parseArgs } from 'node:util'

import { refreshMedia } from './refresh.mts'

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim()

const { values } = parseArgs({
  options: {
    branch: { type: 'string' },
    run: { type: 'string' },
  },
})

let results: ReturnType<typeof refreshMedia>
try {
  results = refreshMedia(
    {
      branch: values.branch ?? git('rev-parse', '--abbrev-ref', 'HEAD'),
      head: git('rev-parse', 'HEAD'),
      mediaDir: path.resolve(import.meta.dirname, '../../../../docs/media'),
      ...(values.run === undefined ? {} : { runId: Number(values.run) }),
    },
    {
      gh: (args) =>
        execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }),
      log: (line) => console.log(line),
    },
  )
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
const changed = results.filter((result) => result.change !== 'unchanged').length
console.log(
  changed === 0 ? 'docs/media/ already has these shots' : `${changed} of ${results.length} changed`,
)
