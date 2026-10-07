import { execFile } from 'node:child_process'

import { type OpenBreak, type Tracker, lastMarker } from './file-breaks.ts'

function gh(args: ReadonlyArray<string>, stdin?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'gh',
      [...args],
      { maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error !== null)
          reject(new Error(`gh ${args.join(' ')} failed: ${stderr || error.message}`))
        else resolve(stdout)
      },
    )
    child.stdin?.end(stdin ?? '')
  })
}

interface IssueRow {
  readonly number: number
  readonly title: string
  readonly body: string
  readonly comments: ReadonlyArray<{ readonly body: string }>
}

/** The tracker over `gh`, with whatever token the environment gives it. */
export function ghTracker(): Tracker {
  let labelsReady = false
  return {
    async findOpenBreak(upstream): Promise<OpenBreak | null> {
      const stdout = await gh([
        'issue',
        'list',
        '--label',
        'canary',
        '--state',
        'open',
        '--limit',
        '100',
        '--json',
        'number,title,body,comments',
      ])
      const rows = JSON.parse(stdout) as IssueRow[]
      const row = rows.find((candidate) =>
        candidate.title.startsWith(`Upstream break: ${upstream} `),
      )
      if (row === undefined) return null
      return {
        number: row.number,
        marker: lastMarker([row.body, ...row.comments.map((comment) => comment.body)]),
      }
    },

    async open({ title, body, labels, assignee }) {
      if (!labelsReady) {
        await gh([
          'label',
          'create',
          'canary',
          '--color',
          'fbca04',
          '--force',
          '--description',
          'An upstream break found by the daily canary',
        ])
        labelsReady = true
      }
      const args = ['issue', 'create', '--title', title, '--body-file', '-', '--assignee', assignee]
      for (const label of labels) args.push('--label', label)
      const url = (await gh(args, body)).trim()
      const number = Number(url.split('/').pop())
      if (!Number.isInteger(number)) throw new Error(`gh issue create answered ${url}`)
      return number
    },

    async comment(number, body) {
      await gh(['issue', 'comment', String(number), '--body-file', '-'], body)
    },
  }
}
