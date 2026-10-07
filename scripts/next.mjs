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
// Plain Node, no package.json and no dependencies of its own, not part of any workspace package. It
// imports core's built `dist/` (@hero-synergy/core) by relative path, so `pnpm install` and
// `pnpm exec vp run build` come first, as the worktree routine in CLAUDE.md already requires.
// Needs `gh` (logged in) and `claude`.
//
// The launch goes through an interactive zsh and the `cc` alias, not straight from node: Claude
// Code writes the session name into the terminal title only when it runs as the shell's foreground
// job. Spawned from node, VS Code's tab keeps saying `node` and `/rename` changes nothing.

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  collectGitHubPromise,
  isClaimed,
  openBlockers,
  placeOf,
  readRegistry,
  readSnapshot,
} from '../packages/core/dist/index.mjs'

const OWNER = 'dbarjs'
const REPO = 'hero-synergy'
const SPEC = 37
const MAP = 64

// The parents whose tickets `next` works, in order: a spec ticket while the spec has a takeable one,
// a ticket of this script's own map otherwise. The map is read through core; a spec is not a map and
// core never reads one, so its sub-issues keep this script's own query, the one thing `next` does
// that the Cockpit never will.
const PARENTS = [SPEC, MAP]

// The skill line the session starts with: the ticket's parent, then the ticket. URLs, not `#n`, so
// the session never resolves a number against the wrong list. Swap the line to use the implement
// form instead of the wayfinder form.
const SKILL_LINE = ({ parent, ticket }) => `/mattpocock-skills:wayfinder ${parent} ${ticket}`
// const SKILL_LINE = ({ ticket }) => `/mattpocock-skills:implement ${ticket}`

// The word the launch is typed with, resolved by the interactive shell (alias or function).
const LAUNCHER = 'cc'
const SHELL = 'zsh'
// Flags every launch gets, before the name, the worktree and the skill line.
const LAUNCH_FLAGS = ['--dangerously-skip-permissions']

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

// The spec's sub-issues in one request: in sub-issue order, with each blocker's state and the
// assignees. Core never reads a spec, so this reading stays here.
async function readSpec(number) {
  const data = graphql(
    `
      query ($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
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
                    state
                  }
                }
              }
            }
          }
        }
      }
    `,
    { owner: OWNER, repo: REPO, number },
  )
  const parent = data.repository.issue
  if (!parent) throw new Error(`#${number} not found on ${OWNER}/${REPO}`)
  const tickets = parent.subIssues.nodes.map((node) => {
    const claimedBy = node.assignees.nodes.map((a) => a.login)
    const waitsOn = node.blockedBy.nodes.filter((b) => b.state === 'OPEN').map((b) => b.number)
    return {
      number: node.number,
      title: node.title,
      parent: number,
      open: node.state === 'OPEN',
      claimed: claimedBy.length > 0,
      claimedBy,
      waitsOn,
      takeable: claimedBy.length === 0 && waitsOn.length === 0,
    }
  })
  return { number, title: parent.title, tickets }
}

// The map through core: its collect, its snapshot and its frontier rules, so `next` and the Tree
// agree on what is takeable, a blocker outside the map included.
async function readMap(number) {
  const { collected } = await collectGitHubPromise(REPO_ROOT)
  const map = readSnapshot(collected).maps.find((m) => m.number === number)
  if (!map) throw new Error(`#${number} is not an open wayfinder map on ${OWNER}/${REPO}`)
  const tickets = map.tickets.map((ticket) => ({
    number: ticket.number,
    title: ticket.title,
    parent: number,
    open: ticket.state === 'open',
    claimed: isClaimed(ticket),
    claimedBy: ticket.claim?.by ?? [],
    waitsOn: openBlockers(ticket).map((blocker) => blocker.number),
    takeable: placeOf(ticket) === 'frontier',
  }))
  return { number, title: map.title, tickets }
}

function readParents() {
  return Promise.all(PARENTS.map((number) => (number === MAP ? readMap(number) : readSpec(number))))
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
// Core's decoder reads the registry; what it cannot read comes back as coded warnings.
function liveSessionTickets() {
  const result = run('claude', ['agents', '--json'])
  const { value: entries, warnings } = readRegistry(result.stdout)
  for (const warning of warnings) {
    const detail = warning.detail ? `: ${warning.detail}` : ''
    console.error(
      `warning: ${warning.code}${detail} (claude agents --json exited ${result.status})`,
    )
  }
  const live = new Set()
  for (const entry of entries) {
    const match = /^#(\d+)(\s|$)/.exec(entry.name)
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
        if (ticket.claimed)
          notes.push(
            ticket.claimedBy.length ? `claimed by ${ticket.claimedBy.join(', ')}` : 'claimed',
          )
        if (live.has(ticket.number)) notes.push('live session')
        const takeable = ticket.takeable && !live.has(ticket.number)
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
  const args = [...LAUNCH_FLAGS, '-n', name, '-w', String(ticket.number), skill]
  console.log([LAUNCHER, ...args].map(shellQuote).join(' '))
  console.log()
  // `zsh -ic '<launcher> "$@"' <argv0> <args…>`: interactive so the alias expands, args passed
  // positionally so the title and the skill line never go through a second layer of quoting.
  const shellArgs = ['-ic', `${LAUNCHER} "$@"`, LAUNCHER, ...args]
  const result = spawnSync(SHELL, shellArgs, { cwd: REPO_ROOT, stdio: 'inherit' })
  if (result.error) throw new Error(`${SHELL}: ${result.error.message}`)
  process.exit(result.status ?? 1)
}

async function list() {
  const parents = annotate(await readParents(), liveSessionTickets())
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

async function launchNext() {
  const parents = annotate(await readParents(), liveSessionTickets())
  const next = parents.flatMap((p) => p.tickets).find((t) => t.takeable)
  if (!next) {
    const names = parents.map((p) => `#${p.number} ${p.title}`).join(' or ')
    console.error(`nothing takeable on ${names}; see --list`)
    process.exit(1)
  }
  launch(next)
}

async function main(argv) {
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
  await main(process.argv.slice(2))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
