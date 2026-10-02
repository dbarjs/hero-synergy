// PROTOTYPE — shared read model for the map-rendering variants. Throwaway.
import { computed, reactive, ref } from 'vue'

import { allMaps, realMap } from './maps.ts'

export type TicketType = 'research' | 'prototype' | 'grilling' | 'task'
export type TicketState = 'decided' | 'frontier' | 'claimed' | 'blocked'
export type SessionStatus =
  | 'started'
  | 'working'
  | 'waiting for you'
  | 'needs approval'
  | 'failed'
  | 'ended'

export interface Ticket {
  number: number
  title: string
  url: string
  state: string
  type?: string
  assignee: string | null
  blockedBy: number[]
  question: string
  gist: string | null
}

export interface Fog {
  title: string
  text: string
  waitsOn: number[]
}

export interface MapData {
  number: number
  title: string
  url: string
  destination: string
  tickets: Ticket[]
  fog: Fog[]
  outOfScope: string[]
  /** Invented maps only: days since the last ticket closed. */
  finishedDays?: number
}

export interface Session {
  status: SessionStatus
  /** Minutes since the last status event. */
  ago: number
}

// Ticket numbers are unique across maps, so lookups work for any map, not only the open one.
const byNumber = new Map(allMaps.flatMap((m) => m.tickets.map((t) => [t.number, t] as const)))
const owner = new Map(allMaps.flatMap((m) => m.tickets.map((t) => [t.number, m] as const)))
export const ticket = (n: number): Ticket => byNumber.get(n)!
export const mapOf = (t: Ticket): MapData => owner.get(t.number)!

export const isOpen = (t: Ticket): boolean => t.state === 'OPEN'
export const openBlockers = (t: Ticket): Ticket[] => t.blockedBy.map(ticket).filter(isOpen)
export const unblocks = (t: Ticket): Ticket[] =>
  mapOf(t).tickets.filter((other) => other.blockedBy.includes(t.number))
export const fogBehind = (t: Ticket): Fog[] =>
  mapOf(t).fog.filter((f) => f.waitsOn.includes(t.number))

export function stateOf(t: Ticket): TicketState {
  if (!isOpen(t)) return 'decided'
  if (t.assignee) return 'claimed'
  if (openBlockers(t).length > 0) return 'blocked'
  return 'frontier'
}

export interface Summary {
  map: MapData
  decided: Ticket[]
  frontier: Ticket[]
  claimed: Ticket[]
  blocked: Ticket[]
  next: Ticket | undefined
  /** Every ticket closed and no fog left. */
  done: boolean
}
export function summarize(m: MapData): Summary {
  const of = (state: TicketState): Ticket[] => m.tickets.filter((t) => stateOf(t) === state)
  const frontier = of('frontier')
  return {
    map: m,
    decided: of('decided'),
    frontier,
    claimed: of('claimed'),
    blocked: of('blocked'),
    next: frontier[0],
    done: m.tickets.every((t) => !isOpen(t)) && m.fog.length === 0,
  }
}
export const summaries: Summary[] = allMaps.map(summarize)
export const activeMaps: Summary[] = summaries.filter((s) => !s.done)
export const finishedMaps: Summary[] = summaries.filter((s) => s.done)

// The map the single-map variants (A–D) draw. These are live bindings swapped by `openMap`;
// they are not reactive, so App.vue remounts the variant when the open map changes.
export let map: MapData = realMap
export let decided: Ticket[] = []
export let frontier: Ticket[] = []
export let claimed: Ticket[] = []
export let blocked: Ticket[] = []
export let next: Ticket | undefined
const opened = ref(0)
export function openMap(m: MapData): void {
  const summary = summarize(m)
  map = m
  ;({ decided, frontier, claimed, blocked, next } = summary)
  opened.value = m.number
}
openMap(realMap)

/** How many resolutions away a ticket is: 0 decided, 1 takeable now, 2 after one more closes… */
export function waveOf(t: Ticket): number {
  if (!isOpen(t)) return 0
  return 1 + Math.max(0, ...openBlockers(t).map(waveOf))
}
export const fogWave = (f: Fog): number =>
  1 + Math.max(0, ...f.waitsOn.map((n) => waveOf(ticket(n))))

export const TYPE: Record<TicketType, { glyph: string; mode: string }> = {
  research: { glyph: '⌕', mode: 'AFK' },
  prototype: { glyph: '◧', mode: 'HITL' },
  grilling: { glyph: '❝', mode: 'HITL' },
  task: { glyph: '☑', mode: 'HITL or AFK' },
}
export const typeOf = (t: Ticket): { glyph: string; mode: string; name: string } => {
  const name = (t.type ?? 'grilling') as TicketType
  return { ...TYPE[name], name }
}

// Live sessions are faked: the real ones come from the status hooks.
const titled = (title: string): number =>
  allMaps.flatMap((m) => m.tickets).find((t) => t.title.startsWith(title))!.number
export const sessions = reactive(
  new Map<number, Session>([
    [3, { status: 'waiting for you', ago: 9 }],
    [7, { status: 'working', ago: 0 }],
    [titled('Does the reranker beat BM25'), { status: 'needs approval', ago: 2 }],
    [titled('What do the platform storage limits'), { status: 'working', ago: 0 }],
    [titled('How are credits and refunds'), { status: 'waiting for you', ago: 34 }],
  ]),
)
const CYCLE: SessionStatus[] = [
  'started',
  'working',
  'waiting for you',
  'needs approval',
  'failed',
  'ended',
]
export function cycleStatus(n: number): void {
  const session = sessions.get(n)
  if (!session) return
  session.status = CYCLE[(CYCLE.indexOf(session.status) + 1) % CYCLE.length]!
  session.ago = 0
}
/** Stub for "Work ticket": no terminal, just a fake session so the row can be judged. */
export function launch(n: number): void {
  sessions.set(n, { status: 'started', ago: 0 })
}
const wantsYou = (t: Ticket): boolean =>
  ['waiting for you', 'needs approval', 'failed'].includes(sessions.get(t.number)?.status ?? '')
export const needsYouIn = (m: MapData): Ticket[] => m.tickets.filter(wantsYou)
export const needsYou = computed(() => (opened.value ? needsYouIn(map) : []))
/** A map with open work but nothing takeable: every open ticket is claimed or blocked. */
export const stuck = (s: Summary): boolean => !s.done && s.frontier.length === 0
export const statusClass = (status: SessionStatus): string => `st-${status.replaceAll(' ', '-')}`
export const agoText = (s: Session): string => (s.ago === 0 ? 'just now' : `${s.ago}m ago`)

export const command = (t: Ticket): string => `/mattpocock-skills:wayfinder ${mapOf(t).url} ${t.url}`
export const terminalCommand = (t: Ticket): string =>
  `claude -n "${named(t)}" -w ticket-${t.number} --plugin-dir <extension>/claude-plugin "${command(t)}"`

/** Active maps, most urgent first: a session needs you, then something is takeable, then stuck. */
export const orderedActive = computed(() => {
  const rank = (s: Summary): number => (needsYouIn(s.map).length ? 0 : stuck(s) ? 2 : 1)
  return activeMaps.toSorted((a, b) => rank(a) - rank(b))
})
export function finishedText(m: MapData): string {
  const days = m.finishedDays ?? 0
  if (days < 14) return `${days}d ago`
  if (days < 60) return `${Math.round(days / 7)}w ago`
  return `${Math.round(days / 30)}mo ago`
}

/** Number first, then the name: Eduardo finds tickets and maps by their issue number. */
export const named = (it: { number: number; title: string }): string => `#${it.number} ${it.title}`
