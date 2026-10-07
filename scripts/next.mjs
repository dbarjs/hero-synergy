#!/usr/bin/env node
// Throwaway: the frontier of one spec and the launch of its first takeable ticket, by hand,
// until Work ticket (#54) lands in the Cockpit. Reads and launches, never writes (ADR 0003).
//
//   node scripts/next.mjs --list      print the open sub-issues of the spec, `next` on the first takeable
//   node scripts/next.mjs             print the launch command, then launch the first takeable ticket
//   node scripts/next.mjs <number>    launch that ticket
//
// Plain Node, no dependencies, not part of any workspace package. Needs `gh` (logged in) and `claude`.

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OWNER = 'dbarjs'
const REPO = 'hero-synergy'
const SPEC = 37

// The skill line the session starts with. URLs, not `#n`, so the session never resolves a number
// against the wrong list. Swap the line to use the implement form instead of the wayfinder form.
const SKILL_LINE = ({ spec, ticket }) => `/mattpocock-skills:wayfinder ${spec} ${ticket}`
// const SKILL_LINE = ({ ticket }) => `/mattpocock-skills:implement ${ticket}`

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const issueUrl = (number) => `https://github.com/${OWNER}/${REPO}/issues/${number}`

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.error) throw new Error(`${command}: ${result.error.message}`)
  return result
}

function graphql(query, variables) {
  const args = ['api', 'graphql', '-f', `query=${query}`]
  for (const [key, value] of Object.entries(variables)) args.push('-F', `${key}=${value}`)
  const result = run('gh', args)
  // gh exits 1 for nearly everything on GraphQL; the body still carries the errors.
  let body
  try {
    body = JSON.parse(result.stdout)
  } catch {
    throw new Error(
      `gh api graphql failed (exit ${result.status}):\n${result.stderr || result.stdout}`,
    )
  }
  if (body.errors?.length)
    throw new Error(`GraphQL: ${body.errors.map((e) => e.message).join('; ')}`)
  return body.data
}

function readSpec() {
  const data = graphql(
    `
      query ($owner: String!, $repo: String!, $spec: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $spec) {
            title
            subIssues(first: 100) {
              nodes {
                number
                title
                state
                assignees(first: 10) {
                  nodes {
                    login
                  }
                }
                blockedBy(first: 50) {
                  nodes {
                    number
                    title
                    state
                  }
                }
              }
            }
          }
        }
      }
    `,
    { owner: OWNER, repo: REPO, spec: SPEC },
  )
  const spec = data.repository.issue
  if (!spec) throw new Error(`#${SPEC} not found on ${OWNER}/${REPO}`)
  const tickets = spec.subIssues.nodes.map((node) => ({
    number: node.number,
    title: node.title,
    open: node.state === 'OPEN',
    assignees: node.assignees.nodes.map((a) => a.login),
    waitsOn: node.blockedBy.nodes.filter((b) => b.state === 'OPEN').map((b) => b.number),
  }))
  return { title: spec.title, tickets }
}

function readTicket(number) {
  const data = graphql(
    `
      query ($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            number
            title
            state
          }
        }
      }
    `,
    { owner: OWNER, repo: REPO, number },
  )
  const issue = data.repository.issue
  if (!issue) throw new Error(`#${number} not found on ${OWNER}/${REPO}`)
  return issue
}

// The Cockpit's own rule: a session named `#<number> …` in Claude Code's registry owns that ticket.
function liveSessionTickets() {
  const result = run('claude', ['agents', '--json'])
  let entries
  try {
    entries = JSON.parse(result.stdout)
  } catch {
    console.error(
      `warning: could not read the session registry (claude agents --json exited ${result.status}); assuming none live`,
    )
    return new Set()
  }
  const live = new Set()
  for (const entry of entries) {
    if (entry.state === 'done') continue
    const match = /^#(\d+)(\s|$)/.exec(entry.name ?? '')
    if (match) live.add(Number(match[1]))
  }
  return live
}

function annotate(spec, live) {
  let nextSeen = false
  return spec.tickets
    .filter((t) => t.open)
    .map((ticket) => {
      const notes = []
      if (ticket.waitsOn.length)
        notes.push(`waits on ${ticket.waitsOn.map((n) => `#${n}`).join(' ')}`)
      if (ticket.assignees.length) notes.push(`claimed by ${ticket.assignees.join(', ')}`)
      if (live.has(ticket.number)) notes.push('live session')
      const takeable = notes.length === 0
      if (takeable && !nextSeen) {
        notes.push('next')
        nextSeen = true
      }
      return { ...ticket, takeable, notes }
    })
}

const shellQuote = (s) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replaceAll("'", `'\\''`)}'`)

function launch(ticket) {
  const name = `#${ticket.number} ${ticket.title}`
  const skill = SKILL_LINE({ spec: issueUrl(SPEC), ticket: issueUrl(ticket.number) })
  const args = ['-n', name, '-w', String(ticket.number), skill]
  console.log(['claude', ...args].map(shellQuote).join(' '))
  console.log()
  const result = spawnSync('claude', args, { cwd: REPO_ROOT, stdio: 'inherit' })
  if (result.error) throw new Error(`claude: ${result.error.message}`)
  process.exit(result.status ?? 1)
}

function list() {
  const spec = readSpec()
  const live = liveSessionTickets()
  console.log(`#${SPEC} ${spec.title}`)
  for (const t of annotate(spec, live)) {
    const notes = t.notes.length ? `  (${t.notes.join(', ')})` : ''
    console.log(`  #${t.number} ${t.title}${notes}`)
  }
}

function launchNumber(number) {
  if (liveSessionTickets().has(number)) {
    console.error(
      `#${number} already has a live session; resume it with: claude --resume '#${number} …'`,
    )
    process.exit(1)
  }
  const issue = readTicket(number)
  if (issue.state !== 'OPEN') console.error(`warning: #${number} is ${issue.state.toLowerCase()}`)
  launch(issue)
}

function launchNext() {
  const spec = readSpec()
  const next = annotate(spec, liveSessionTickets()).find((t) => t.takeable)
  if (!next) {
    console.error(`nothing takeable on #${SPEC} ${spec.title}; see --list`)
    process.exit(1)
  }
  launch(next)
}

function main(argv) {
  const [arg] = argv
  if (arg === undefined) return launchNext()
  if (arg === '--list') return list()
  const number = Number(arg)
  if (!Number.isInteger(number) || number <= 0) {
    console.error('usage: node scripts/next.mjs [--list | <number>]')
    process.exit(2)
  }
  launchNumber(number)
}

try {
  main(process.argv.slice(2))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
