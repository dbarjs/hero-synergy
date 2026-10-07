#!/usr/bin/env node
// `next`, the terminal pre-alpha of the Cockpit: it lists and launches the tickets of spec #37 and
// of its own map #64 from the terminal, by hand, until v0.1.0 ships. It grows with that map, ticket
// by ticket, and after the release it is the prior art the official CLI map starts from; nothing in
// it ships. Reads and launches, never writes (ADR 0003).
//
//   node scripts/next.mjs --list      print the open tickets of the spec and of the map, `next` on the first takeable
//   node scripts/next.mjs             print the launch command, then launch the first takeable ticket
//   node scripts/next.mjs <number>    launch that ticket
//
// Plain Node, no dependencies, not part of any workspace package. Needs `gh` (logged in) and `claude`.
//
// The launch goes through an interactive zsh and the `cc` alias, not straight from node: Claude
// Code writes the session name into the terminal title only when it runs as the shell's foreground
// job. Spawned from node, VS Code's tab keeps saying `node` and `/rename` changes nothing.

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OWNER = 'dbarjs'
const REPO = 'hero-synergy'
const SPEC = 37
const MAP = 64

// The parents whose tickets `next` works, in order: a spec ticket while the spec has a takeable one,
// a ticket of this script's own map otherwise. Reading a spec's sub-issues is the one thing `next`
// does that the Cockpit never will.
const PARENTS = [SPEC, MAP]

// The skill line the session starts with: the ticket's parent, then the ticket. URLs, not `#n`, so
// the session never resolves a number against the wrong list. Swap the line to use the implement
// form instead of the wayfinder form.
const SKILL_LINE = ({ parent, ticket }) => `/mattpocock-skills:wayfinder ${parent} ${ticket}`
// const SKILL_LINE = ({ ticket }) => `/mattpocock-skills:implement ${ticket}`

// The word the launch is typed with, resolved by the interactive shell (alias or function).
const LAUNCHER = 'cc'
const SHELL = 'zsh'

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

// Every parent in one request: an aliased `issue` block per parent, its sub-issues in sub-issue
// order with each blocker's state and the assignees. Core takes this reading over in the next ticket.
function readParents() {
  const blocks = PARENTS.map(
    (number, i) => `
      p${i}: issue(number: ${number}) {
        title
        subIssues(first: 100) {
          nodes {
            ...ticket
          }
        }
      }
    `,
  )
  const data = graphql(
    `
      fragment ticket on Issue {
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
      query ($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          ${blocks.join('')}
        }
      }
    `,
    { owner: OWNER, repo: REPO },
  )
  return PARENTS.map((number, i) => {
    const parent = data.repository[`p${i}`]
    if (!parent) throw new Error(`#${number} not found on ${OWNER}/${REPO}`)
    const tickets = parent.subIssues.nodes.map((node) => ({
      number: node.number,
      title: node.title,
      parent: number,
      open: node.state === 'OPEN',
      assignees: node.assignees.nodes.map((a) => a.login),
      waitsOn: node.blockedBy.nodes.filter((b) => b.state === 'OPEN').map((b) => b.number),
    }))
    return { number, title: parent.title, tickets }
  })
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
            parent {
              number
            }
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

// The open tickets of every parent with their notes; `next` marks the first takeable one across all
// parents in parent order.
function annotate(parents, live) {
  let nextSeen = false
  return parents.map((parent) => ({
    ...parent,
    tickets: parent.tickets
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
      }),
  }))
}

const shellQuote = (s) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replaceAll("'", `'\\''`)}'`)

function launch(ticket) {
  const name = `#${ticket.number} ${ticket.title}`
  const skill = SKILL_LINE({ parent: issueUrl(ticket.parent), ticket: issueUrl(ticket.number) })
  const args = ['-n', name, '-w', String(ticket.number), skill]
  console.log([LAUNCHER, ...args].map(shellQuote).join(' '))
  console.log()
  // `zsh -ic '<launcher> "$@"' <argv0> <args…>`: interactive so the alias expands, args passed
  // positionally so the title and the skill line never go through a second layer of quoting.
  const shellArgs = ['-ic', `${LAUNCHER} "$@"`, LAUNCHER, ...args]
  const result = spawnSync(SHELL, shellArgs, { cwd: REPO_ROOT, stdio: 'inherit' })
  if (result.error) throw new Error(`${SHELL}: ${result.error.message}`)
  process.exit(result.status ?? 1)
}

function list() {
  const parents = annotate(readParents(), liveSessionTickets())
  parents.forEach((parent, i) => {
    if (i > 0) console.log()
    console.log(`#${parent.number} ${parent.title}`)
    for (const t of parent.tickets) {
      const notes = t.notes.length ? `  (${t.notes.join(', ')})` : ''
      console.log(`  #${t.number} ${t.title}${notes}`)
    }
  })
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
  if (!issue.parent)
    console.error(`warning: #${number} has no parent issue; the session gets the spec, #${SPEC}`)
  launch({ number: issue.number, title: issue.title, parent: issue.parent?.number ?? SPEC })
}

function launchNext() {
  const parents = annotate(readParents(), liveSessionTickets())
  const next = parents.flatMap((p) => p.tickets).find((t) => t.takeable)
  if (!next) {
    const names = parents.map((p) => `#${p.number} ${p.title}`).join(' or ')
    console.error(`nothing takeable on ${names}; see --list`)
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
