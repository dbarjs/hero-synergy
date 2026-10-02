// PROTOTYPE — shared read model for the map-rendering variants. Throwaway.
import { computed, reactive, ref } from 'vue'

import { fixture } from './map-fixture.ts'

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
}

export interface Session {
  status: SessionStatus
  /** Minutes since the last status event. */
  ago: number
}

export const map: MapData = fixture

const byNumber = new Map(map.tickets.map((t) => [t.number, t]))
export const ticket = (n: number): Ticket => byNumber.get(n)!

export const isOpen = (t: Ticket): boolean => t.state === 'OPEN'
export const openBlockers = (t: Ticket): Ticket[] => t.blockedBy.map(ticket).filter(isOpen)
export const unblocks = (t: Ticket): Ticket[] =>
  map.tickets.filter((other) => other.blockedBy.includes(t.number))
export const fogBehind = (t: Ticket): Fog[] => map.fog.filter((f) => f.waitsOn.includes(t.number))

export function stateOf(t: Ticket): TicketState {
  if (!isOpen(t)) return 'decided'
  if (t.assignee) return 'claimed'
  if (openBlockers(t).length > 0) return 'blocked'
  return 'frontier'
}

export const decided = map.tickets.filter((t) => stateOf(t) === 'decided')
export const frontier = map.tickets.filter((t) => stateOf(t) === 'frontier')
export const claimed = map.tickets.filter((t) => stateOf(t) === 'claimed')
export const blocked = map.tickets.filter((t) => stateOf(t) === 'blocked')
export const next: Ticket | undefined = frontier[0]

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
export const sessions = reactive(
  new Map<number, Session>([
    [3, { status: 'waiting for you', ago: 9 }],
    [7, { status: 'working', ago: 0 }],
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
export const needsYou = computed(() =>
  map.tickets.filter((t) =>
    ['waiting for you', 'needs approval', 'failed'].includes(sessions.get(t.number)?.status ?? ''),
  ),
)
export const statusClass = (status: SessionStatus): string => `st-${status.replaceAll(' ', '-')}`
export const agoText = (s: Session): string => (s.ago === 0 ? 'just now' : `${s.ago}m ago`)

export const command = (t: Ticket): string => `/mattpocock-skills:wayfinder ${map.url} ${t.url}`
export const terminalCommand = (t: Ticket): string =>
  `claude -n "${t.title}" -w ticket-${t.number} --plugin-dir <extension>/claude-plugin "${command(t)}"`

export const selected = ref<number | null>(null)
