// PROTOTYPE (#202) — the prototype's one store: URL params, the selection, what is unfolded, the
// fake launches. The real Cockpit keeps the selection in the extension host; here it is local.
import { computed, reactive, watchEffect } from 'vue'

import type { ActionView } from '../../../src/protocol.ts'
import {
  type BuildTicket,
  type DecisionTicket,
  type LoneModel,
  type MapModel,
  type Scene,
  type SpecModel,
  buildScene,
  implementCommand,
  implementSpecCommand,
  toSpecCommand,
  toTicketsCommand,
  workTicketCommand,
} from './model.ts'

export const VARIANTS = [
  { key: 'A', name: 'Under its map' },
  { key: 'B', name: 'Beside the maps' },
  { key: 'C', name: 'A section of its own' },
  { key: 'D', name: 'The spec takes over its map' },
] as const

const params = new URLSearchParams(location.search)

export const state = reactive({
  variant: params.get('variant') ?? 'A',
  when: (params.get('when') === 'oct7' ? 'oct7' : 'now') as 'now' | 'oct7',
  detail: (params.get('detail') === 'issue' ? 'issue' : 'progress') as 'issue' | 'progress',
  theme: params.get('theme') === 'light' ? 'light' : 'dark',
  /** The side bar's width: VS Code's default is about 300px; many people drag it wider. */
  width: params.get('width') === 'wide' ? 'wide' : 'narrow',
  selected: params.get('select') as string | null,
  expanded: new Set<string>(),
  toast: null as string | null,
})

const scenes = { now: buildScene('now'), oct7: buildScene('oct7') }
export const scene = computed<Scene>(() => scenes[state.when])

const firstOf = (s: Scene, spec: number): string | null => {
  const found = s.specs.get(spec)
  const ticket = found?.next ?? found?.tickets.find((t) => t.state === 'open')
  return ticket ? `b:${ticket.number}` : null
}
const DEFAULT_SELECTION = {
  now: firstOf(scenes.now, 163) ?? 'spec:163',
  oct7: firstOf(scenes.oct7, 37) ?? 'spec:37',
}
const DEFAULT_EXPANDED = [
  'map:195',
  'map:130',
  'spec:163',
  'map:1',
  'spec:37',
  'mapitem:130',
  'section:specs',
  'section:maps',
]

const reset = (): void => {
  // `?collapsed` starts with every map and spec folded, to see the whole list at a glance.
  state.expanded = new Set(
    params.has('collapsed') ? ['section:specs', 'section:maps'] : DEFAULT_EXPANDED,
  )
  if (params.has('collapsed')) return
  // The first invented spec that is being built, so dozens of rows show their real density.
  const notifications = [...scenes.now.specs.values()].find(
    (s) => s.title === 'Spec: Notifications rework',
  )
  if (notifications) state.expanded.add(`spec:${notifications.number}`)
  if (!state.selected) state.selected = DEFAULT_SELECTION[state.when]
}
reset()

watchEffect(() => {
  const next = new URLSearchParams()
  next.set('variant', state.variant)
  if (state.when !== 'now') next.set('when', state.when)
  if (state.detail !== 'progress') next.set('detail', state.detail)
  if (state.theme !== 'dark') next.set('theme', state.theme)
  if (state.width !== 'narrow') next.set('width', state.width)
  if (state.selected) next.set('select', state.selected)
  history.replaceState(null, '', `?${next}`)
  document.documentElement.dataset.theme = state.theme
})

export const setWhen = (when: 'now' | 'oct7'): void => {
  state.when = when
  state.selected = DEFAULT_SELECTION[when]
}

export const isOpen = (key: string): boolean => state.expanded.has(key)
export const toggle = (key: string): void => {
  if (state.expanded.has(key)) state.expanded.delete(key)
  else state.expanded.add(key)
}
/** A click on the selected row again closes its pane, as in the real Tree. */
export const select = (key: string | null): void => {
  state.selected = state.selected === key ? null : key
}
/** Select from the Detail: always selects, and unfolds what holds the row. */
export const reveal = (key: string): void => {
  state.selected = key
  const [kind, raw] = key.split(':')
  const n = Number(raw)
  if (kind === 'b') {
    const ticket = scene.value.buildTickets.get(n)
    if (ticket) {
      state.expanded.add(`spec:${ticket.spec}`)
      const spec = scene.value.specs.get(ticket.spec)
      if (spec?.map) state.expanded.add(`map:${spec.map.number}`)
      if (ticket.state === 'closed') state.expanded.add(`built:${ticket.spec}`)
    }
  }
  if (kind === 't') {
    const ticket = scene.value.decisionTickets.get(n)
    if (ticket) {
      state.expanded.add(`map:${ticket.map}`)
      state.expanded.add(`mapitem:${ticket.map}`)
      if (ticket.state === 'closed') state.expanded.add(`dec:${ticket.map}`)
    }
  }
  if (kind === 'spec' || kind === 'specitem') {
    const spec = scene.value.specs.get(n)
    if (spec?.map) state.expanded.add(`map:${spec.map.number}`)
  }
}

let toastTimer: ReturnType<typeof setTimeout> | undefined
export const launch = (action: ActionView): void => {
  state.toast = action.disabled
    ? `Greyed: ${action.disabled}`
    : `Would open a terminal and run:\n${action.command}`
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (state.toast = null), 5000)
}

// ---------------------------------------------------------------------------------------------
// Actions: the prototype's guesses at labels and commands; #205, #206 and #210 decide them.

const action = (
  label: string,
  command: string | null,
  disabled: string | null = null,
  note: string | null = null,
): ActionView =>
  ({ id: 'work-ticket', label, command, envLine: null, disabled, note }) as unknown as ActionView

export const mapActions = (map: MapModel): ActionView[] => {
  if (!map.finished) return []
  const specs = map.specs
    .map((n) => scene.value.specs.get(n))
    .filter((s) => s && s.state === 'open')
  if (specs.length > 0) return []
  return [action('To spec', toSpecCommand(map))]
}

export const decisionActions = (ticket: DecisionTicket): ActionView[] =>
  ticket.place === 'frontier' ? [action('Work ticket', workTicketCommand(ticket))] : []

export const specActions = (spec: SpecModel): ActionView[] => {
  if (spec.state === 'closed') return []
  if (spec.status === 'no-tickets') {
    return [
      action('To tickets', toTicketsCommand(spec)),
      action(
        'Implement spec',
        implementSpecCommand(spec),
        null,
        'Builds it whole in one session, with no build tickets (as #155 was). #210 decides whether this is offered here.',
      ),
    ]
  }
  if (spec.status === 'takeable' && spec.next) {
    return [
      action(
        `Implement #${spec.next.number}`,
        implementCommand(spec.next),
        null,
        `The next build ticket: ${spec.next.title}`,
      ),
      action(
        'Implement spec',
        implementSpecCommand(spec),
        null,
        '#210 decides when a whole-spec run is offered.',
      ),
    ]
  }
  return []
}

export const buildActions = (ticket: BuildTicket): ActionView[] => {
  if (ticket.place === 'frontier') return [action('Implement', implementCommand(ticket))]
  if (ticket.place === 'held') {
    return [
      action(
        'Implement',
        implementCommand(ticket),
        'needs-info: the ticket waits on an answer, not on a session',
      ),
    ]
  }
  if (ticket.place === 'claimed' && ticket.session.kind === 'ended') {
    return [action('Resume', `claude --resume "#${ticket.number} ${ticket.title}"`)]
  }
  return []
}

export const loneActions = (lone: LoneModel): ActionView[] => [
  action(
    'Implement',
    implementCommand(lone),
    null,
    'A ready-for-agent issue with no spec and no map. #206 decides whether it gets Implement.',
  ),
]

/** ▶ on a row runs the first Action of its context. */
export const play = (actions: ActionView[]): ActionView | null => actions[0] ?? null
