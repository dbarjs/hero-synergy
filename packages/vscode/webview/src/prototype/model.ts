// PROTOTYPE (#202) — what the Tree, the Focus pane and the Detail need, derived from the issues as
// they stood at one moment. The rules here are the prototype's guesses, not decisions:
//   a spec is an issue whose body holds the seven H2s (#197's key),
//   a build ticket is a child of a spec, a decision ticket a child of a map,
//   a spec's map is the first map its preamble links to (all three real specs name it there),
//   a build ticket's frontier follows the map's rule, and `needs-info` holds it off the frontier.
import type { SessionView } from '@hero-synergy/core'

import type { WorktreeView } from '../../../src/protocol.ts'
import {
  type Fake,
  type Issue,
  type Pr,
  inventedFakes,
  inventedIssues,
  live,
  realFakes,
  realIssues,
  realOpenPrs,
} from './issues.ts'

export type Place = 'claimed' | 'frontier' | 'blocked' | 'held' | 'closed'
export type Role = 'ready-for-agent' | 'ready-for-human' | 'needs-info' | null

export interface Ref {
  readonly number: number
  readonly title: string
  readonly state: 'open' | 'closed'
}

interface TicketCommon {
  readonly number: number
  readonly title: string
  readonly url: string
  readonly state: 'open' | 'closed'
  readonly place: Place
  readonly next: boolean
  readonly claim: ReadonlyArray<string>
  readonly waitsOn: ReadonlyArray<Ref>
  readonly allBlockers: ReadonlyArray<Ref>
  readonly clearsWayFor: ReadonlyArray<Ref>
  readonly session: SessionView
  readonly worktree: WorktreeView | null
  readonly body: string
  readonly lastComment: Issue['lastComment']
  readonly invented: boolean
}

export interface DecisionTicket extends TicketCommon {
  readonly kind: 'decision'
  readonly map: number
  readonly type: string | null
  readonly mode: 'HITL' | 'AFK' | 'task' | null
  readonly gist: string | null
}

export interface Criterion {
  readonly text: string
  readonly ticked: boolean
}

export interface BuildTicket extends TicketCommon {
  readonly kind: 'build'
  readonly spec: number
  readonly role: Role
  readonly mode: 'HITL' | 'AFK' | null
  readonly pr: Pr | null
  readonly whatToBuild: string
  readonly criteria: ReadonlyArray<Criterion>
}

export type SpecState = 'no-tickets' | 'takeable' | 'stuck' | 'built'

export interface Section {
  readonly heading: string
  readonly body: string
}

export interface SpecModel {
  readonly kind: 'spec'
  readonly number: number
  readonly title: string
  readonly url: string
  readonly state: 'open' | 'closed'
  /** The map it came from, null when it names none. */
  readonly map: Ref | null
  readonly preamble: string
  readonly sections: ReadonlyArray<Section>
  readonly stories: ReadonlyArray<string>
  readonly problem: string
  /** In sub-issue order. */
  readonly tickets: ReadonlyArray<BuildTicket>
  readonly takeable: number
  readonly built: number
  readonly total: number
  readonly status: SpecState
  readonly next: BuildTicket | null
  readonly needsYou: number
  readonly live: number
  readonly body: string
  readonly invented: boolean
}

export interface MapModel {
  readonly kind: 'map'
  readonly number: number
  readonly title: string
  readonly url: string
  readonly state: 'open' | 'closed'
  readonly destination: string | null
  readonly tickets: ReadonlyArray<DecisionTicket>
  readonly takeable: number
  readonly decided: number
  readonly total: number
  readonly finished: boolean
  readonly needsYou: number
  readonly fog: ReadonlyArray<string>
  readonly decisions: ReadonlyArray<{ number: number | null; title: string; gist: string }>
  readonly outOfScope: ReadonlyArray<string>
  /** The specs that name this map, newest last. */
  readonly specs: ReadonlyArray<number>
  readonly invented: boolean
}

export interface LoneModel {
  readonly kind: 'lone'
  readonly number: number
  readonly title: string
  readonly url: string
  readonly role: Role
}

export interface Scene {
  readonly label: string
  readonly at: string
  readonly maps: ReadonlyMap<number, MapModel>
  readonly specs: ReadonlyMap<number, SpecModel>
  readonly decisionTickets: ReadonlyMap<number, DecisionTicket>
  readonly buildTickets: ReadonlyMap<number, BuildTicket>
  readonly lone: ReadonlyArray<LoneModel>
}

// ---------------------------------------------------------------------------------------------

const SPEC_HEADINGS = ['Problem Statement', 'Solution', 'User Stories', 'Implementation Decisions']

const isSpec = (issue: Issue): boolean =>
  SPEC_HEADINGS.every((heading) => new RegExp(`^## ${heading}\\s*$`, 'm').test(issue.body))
const isMap = (issue: Issue): boolean => issue.labels.includes('wayfinder:map')

export const sectionsOf = (body: string): { preamble: string; sections: Section[] } => {
  const parts = body.split(/^## (.+)$/m)
  const sections: Section[] = []
  for (let index = 1; index < parts.length; index += 2) {
    sections.push({ heading: parts[index]!.trim(), body: (parts[index + 1] ?? '').trim() })
  }
  return { preamble: (parts[0] ?? '').trim(), sections }
}

const section = (body: string, heading: string): string =>
  sectionsOf(body)
    .sections.find((part) => part.heading.toLowerCase() === heading.toLowerCase())
    ?.body.replace(/<!--[\s\S]*?-->/g, '')
    .trim() ?? ''

const bullets = (text: string): string[] =>
  text
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2))

const unlink = (text: string): string => text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

const roleOf = (issue: Issue): Role =>
  (['ready-for-agent', 'ready-for-human', 'needs-info'] as const).find((role) =>
    issue.labels.includes(role),
  ) ?? null

const TYPE_MODE = { research: 'AFK', prototype: 'HITL', grilling: 'HITL', task: 'task' } as const

// ---------------------------------------------------------------------------------------------

/** The issues as they stood at `at`: later issues dropped, later closings undone, claims guessed. */
const asOf = (issues: ReadonlyArray<Issue>, at: string | null): Issue[] => {
  if (at === null) return [...issues]
  const moment = Date.parse(at)
  const soon = moment + 3600_000
  return issues
    .filter((issue) => Date.parse(issue.createdAt) <= moment)
    .map((issue) => {
      const closedThen = issue.closedAt !== null && Date.parse(issue.closedAt) <= moment
      if (closedThen || issue.invented) return issue
      // Open then. Claimed then if it closed within the hour: a session was on it.
      const closingSoon = issue.closedAt !== null && Date.parse(issue.closedAt) <= soon
      return {
        ...issue,
        state: 'open' as const,
        closedAt: null,
        assignees: closingSoon ? issue.assignees : [],
        prs: [],
        lastComment: null,
      }
    })
}

export const buildScene = (when: 'now' | 'oct7'): Scene => {
  const at = when === 'now' ? null : '2026-10-07T18:40:00Z'
  const real = asOf(realIssues, at)
  const all = [...real, ...inventedIssues]
  const byNumber = new Map(all.map((issue) => [issue.number, issue]))
  const fakes: Record<number, Fake> = { ...inventedFakes }
  if (when === 'now') Object.assign(fakes, realFakes)

  const ref = (n: number): Ref | null => {
    const issue = byNumber.get(n)
    return issue ? { number: n, title: issue.title, state: issue.state } : null
  }
  const refs = (numbers: ReadonlyArray<number>): Ref[] =>
    numbers.map(ref).filter((r): r is Ref => r !== null)

  // On the earlier scene, the tickets a session was on get a faked live one.
  const sessionOf = (issue: Issue): SessionView => {
    const fake = fakes[issue.number]?.session
    if (fake) return fake
    if (at !== null && issue.state === 'open' && issue.assignees.length > 0) {
      return live(
        issue.number % 3 === 0 ? 'waiting for you' : 'working',
        5 + (issue.number % 40),
        issue.number % 3 === 0,
      )
    }
    return { kind: 'none' }
  }
  const worktreeOf = (issue: Issue): WorktreeView | null => {
    const fake = fakes[issue.number]?.worktree
    if (fake) return fake
    if (at !== null && issue.state === 'open' && issue.assignees.length > 0) {
      return {
        branch: `worktree-${issue.number}`,
        uncommitted: issue.number % 5,
        ahead: issue.number % 3,
      }
    }
    return null
  }

  const common = (issue: Issue, siblings: ReadonlyArray<Issue>) => {
    const open = issue.state === 'open'
    const waitsOn = issue.blockedBy.filter((n) => byNumber.get(n)?.state === 'open')
    return {
      number: issue.number,
      title: issue.title,
      url: issue.url,
      state: issue.state,
      claim: issue.assignees,
      waitsOn: refs(waitsOn),
      allBlockers: refs(issue.blockedBy),
      clearsWayFor: refs(
        siblings.filter((other) => other.blockedBy.includes(issue.number)).map((o) => o.number),
      ),
      session: open || fakes[issue.number]?.session ? sessionOf(issue) : { kind: 'none' as const },
      worktree: worktreeOf(issue),
      body: issue.body,
      lastComment: issue.lastComment,
      invented: issue.invented === true,
      placeBase: !open
        ? ('closed' as const)
        : issue.assignees.length > 0
          ? ('claimed' as const)
          : waitsOn.length > 0
            ? ('blocked' as const)
            : ('frontier' as const),
    }
  }

  const decisionTickets = new Map<number, DecisionTicket>()
  const buildTickets = new Map<number, BuildTicket>()
  const maps = new Map<number, MapModel>()
  const specs = new Map<number, SpecModel>()

  // Maps.
  for (const issue of all.filter(isMap)) {
    const children = issue.children.map((n) => byNumber.get(n)).filter((c): c is Issue => !!c)
    const gists = new Map<number, string>()
    const decisions = bullets(section(issue.body, 'Decisions so far')).map((line) => {
      const number = Number(line.match(/\/issues\/(\d+)\)/)?.[1] ?? Number.NaN)
      const title = line.match(/^\[([^\]]+)\]/)?.[1] ?? unlink(line)
      const gist = unlink(line.replace(/^\[[^\]]+\]\([^)]+\)\s*[:—-]\s*/, ''))
      if (!Number.isNaN(number)) gists.set(number, gist)
      return { number: Number.isNaN(number) ? null : number, title, gist }
    })
    let nextGiven = false
    const tickets: DecisionTicket[] = children.map((child) => {
      const base = common(child, children)
      const type =
        child.labels.find((label) => label.startsWith('wayfinder:'))?.slice('wayfinder:'.length) ??
        null
      const isNext = base.placeBase === 'frontier' && !nextGiven
      if (isNext) nextGiven = true
      const { placeBase, ...rest } = base
      const ticket: DecisionTicket = {
        ...rest,
        kind: 'decision',
        map: issue.number,
        place: placeBase,
        next: isNext,
        type,
        mode: type ? (TYPE_MODE[type as keyof typeof TYPE_MODE] ?? null) : null,
        gist: gists.get(child.number) ?? null,
      }
      decisionTickets.set(child.number, ticket)
      return ticket
    })
    const open = tickets.filter((t) => t.state === 'open')
    maps.set(issue.number, {
      kind: 'map',
      number: issue.number,
      title: issue.title,
      url: issue.url,
      state: issue.state,
      destination: unlink(section(issue.body, 'Destination')) || null,
      tickets,
      takeable: open.filter((t) => t.place === 'frontier').length,
      decided: tickets.length - open.length,
      total: tickets.length,
      finished: tickets.length > 0 && open.length === 0,
      needsYou: open.filter((t) => t.session.kind === 'live' && t.session.needsYou).length,
      fog: bullets(section(issue.body, 'Not yet specified')).map(unlink),
      decisions,
      outOfScope: bullets(section(issue.body, 'Out of scope')).map(unlink),
      specs: [],
      invented: issue.invented === true,
    })
  }

  // Specs and their build tickets.
  for (const issue of all.filter(isSpec)) {
    const { preamble, sections } = sectionsOf(issue.body)
    const mapNumber = [...preamble.matchAll(/\/issues\/(\d+)\)/g)]
      .map((match) => Number(match[1]))
      .find((n) => maps.has(n))
    const children = issue.children.map((n) => byNumber.get(n)).filter((c): c is Issue => !!c)
    let nextGiven = false
    const tickets: BuildTicket[] = children.map((child) => {
      const base = common(child, children)
      const role = roleOf(child)
      const place: Place =
        base.placeBase === 'frontier' && role === 'needs-info' ? 'held' : base.placeBase
      const isNext = place === 'frontier' && !nextGiven
      if (isNext) nextGiven = true
      const criteriaText = section(child.body, 'Acceptance criteria')
      const pr =
        fakes[child.number]?.pr ??
        realOpenPrs.get(child.number) ??
        child.prs.find((p) => p.state === 'merged') ??
        child.prs[0] ??
        null
      const { placeBase, ...rest } = base
      void placeBase
      const ticket: BuildTicket = {
        ...rest,
        kind: 'build',
        spec: issue.number,
        place,
        next: isNext,
        role,
        mode: role === 'ready-for-agent' ? 'AFK' : role === 'ready-for-human' ? 'HITL' : null,
        pr,
        whatToBuild: section(child.body, 'What to build'),
        criteria: criteriaText
          .split('\n')
          .map((line) => line.match(/^\s*- \[([ xX])\] (.*)$/))
          .filter((m): m is RegExpMatchArray => m !== null)
          .map((m) => ({ ticked: m[1] !== ' ', text: m[2]! })),
      }
      buildTickets.set(child.number, ticket)
      return ticket
    })
    const open = tickets.filter((t) => t.state === 'open')
    const takeable = open.filter((t) => t.place === 'frontier').length
    const built = tickets.length - open.length
    const stories = (sections.find((s) => s.heading === 'User Stories')?.body ?? '')
      .split('\n')
      .filter((line) => /^\d+\.\s/.test(line))
    const mapModel = mapNumber === undefined ? undefined : maps.get(mapNumber)
    specs.set(issue.number, {
      kind: 'spec',
      number: issue.number,
      title: issue.title,
      url: issue.url,
      state: issue.state,
      map: mapModel
        ? { number: mapModel.number, title: mapModel.title, state: mapModel.state }
        : null,
      preamble,
      sections,
      stories,
      problem:
        (sections.find((s) => s.heading === 'Problem Statement')?.body ?? '').split('\n\n')[0] ??
        '',
      tickets,
      takeable,
      built,
      total: tickets.length,
      status:
        tickets.length === 0
          ? 'no-tickets'
          : built === tickets.length
            ? 'built'
            : takeable > 0
              ? 'takeable'
              : 'stuck',
      next: tickets.find((t) => t.next) ?? null,
      needsYou: open.filter((t) => t.session.kind === 'live' && t.session.needsYou).length,
      live: open.filter((t) => t.session.kind === 'live' || t.session.kind === 'starting').length,
      body: issue.body,
      invented: issue.invented === true,
    })
    if (mapModel) (mapModel.specs as number[]).push(issue.number)
  }

  const lone: LoneModel[] = all
    .filter(
      (issue) =>
        issue.state === 'open' &&
        issue.parent === null &&
        !isSpec(issue) &&
        !isMap(issue) &&
        roleOf(issue) !== null,
    )
    .map((issue) => ({
      kind: 'lone',
      number: issue.number,
      title: issue.title,
      url: issue.url,
      role: roleOf(issue),
    }))

  return {
    label:
      when === 'now'
        ? 'this repo on 2026-11-16, plus an invented repo'
        : 'this repo on 2026-10-07 18:40, mid-build of #37, plus an invented repo',
    at: at ?? new Date().toISOString(),
    maps,
    specs,
    decisionTickets,
    buildTickets,
    lone,
  }
}

// ---------------------------------------------------------------------------------------------
// Order and words shared by every variant.

/** Needs you first, then something to do (takeable, or a spec waiting for its tickets), then stuck. */
export const urgency = (item: MapModel | SpecModel): number => {
  if (item.needsYou > 0) return 0
  if (item.takeable > 0) return 1
  if (item.kind === 'spec' && item.status === 'no-tickets') return 1
  return 2
}

export const byUrgency = <T extends MapModel | SpecModel>(items: T[]): T[] =>
  [...items].sort((a, b) => urgency(a) - urgency(b) || a.number - b.number)

export const STATUS_WORDS: Record<SpecState, string> = {
  'no-tickets': 'no build tickets',
  takeable: 'takeable',
  stuck: 'nothing takeable',
  built: 'built',
}

/** The command a build ticket's Implement would run (the shape #206 settles). */
export const implementCommand = (ticket: { number: number; title: string; url: string }): string =>
  `claude -n "#${ticket.number} ${ticket.title}" -w ${ticket.number} "/implement ${ticket.url}"`

export const toTicketsCommand = (spec: { number: number; title: string; url: string }): string =>
  `claude -n "#${spec.number} ${spec.title}" "/to-tickets ${spec.url}"`

export const implementSpecCommand = (spec: {
  number: number
  title: string
  url: string
}): string =>
  `claude -n "#${spec.number} ${spec.title}" -w ${spec.number} "/implement-spec ${spec.url}"`

export const toSpecCommand = (map: { number: number; title: string; url: string }): string =>
  `claude -n "#${map.number} ${map.title}" "/to-spec ${map.url}"`

export const workTicketCommand = (ticket: { number: number; title: string; url: string }): string =>
  `claude -n "#${ticket.number} ${ticket.title}" -w ${ticket.number} "/wayfinder ${ticket.url}"`
