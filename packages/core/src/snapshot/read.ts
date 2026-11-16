import { boldKeysOf, readHeaderLines } from './header-lines.ts'
import { readMapBody } from './map-body.ts'
import { readMapStatus } from './map-status.ts'
import { firstH1 } from './markdown.ts'
import type {
  Blocker,
  Claim,
  Outcome,
  Ref,
  Resolution,
  Snapshot,
  Ticket,
  TicketState,
  TicketType,
  Tracker,
  TriageRole,
  WayfinderMap,
} from './model.ts'
import { type ReferenceItem, type ReferenceLine, resolveTarget } from './reference-line.ts'
import { headerTicketLines, readTicketBody } from './ticket-body.ts'
import { readTicketStatus } from './ticket-status.ts'
import type { DriftWarning } from './warnings.ts'

/**
 * What a tracker reports about a map before its body is read. A collector
 * (GitHub through `gh`, the `.scratch` files locally) fills one per open map.
 */
export interface CollectedMap {
  readonly number: number
  /** The tracker's title; null on a local tracker, where the body's H1 titles the map. */
  readonly title: string | null
  readonly ref: Ref
  readonly body: string
  /** The children the tracker keeps, in map order: native sub-issues, local files by number. Empty when it keeps none. */
  readonly children: ReadonlyArray<number>
  /**
   * Every map file a local effort holds, `map.md` in any casing, in byte order, when it holds
   * more than one; `ref` names the one read. Absent on GitHub and in an effort with one map file.
   */
  readonly mapFiles?: ReadonlyArray<string>
}

/** What a tracker reports about a ticket before its body is read. */
export interface CollectedTicket {
  readonly number: number
  /** The tracker's title; null on a local tracker, where the body's H1 titles the ticket. */
  readonly title: string | null
  readonly ref: Ref
  readonly body: string
  /** The tracker's state; null on a local tracker, where the ticket's Status line decides. */
  readonly state: TicketState | null
  readonly labels: ReadonlyArray<string>
  readonly assignees: ReadonlyArray<string>
  /** The map the tracker places the ticket under: the native parent, the effort directory. */
  readonly parent: number | null
  /** Native dependencies, closed ones included; empty when the tracker keeps them in the body. */
  readonly blockedBy: ReadonlyArray<Blocker>
  /** The last comment on GitHub; null on a local tracker, where `## Answer` holds the resolution. */
  readonly lastComment: Resolution | null
}

/** One collect of a tracker: its open maps and their tickets, bodies unread. */
export interface Collected {
  readonly tracker: Tracker
  readonly repoRoot: string
  /** ISO timestamp. */
  readonly collectedAt: string
  /** The repo's `wayfinder:` labels, for the unknown-labels check; empty on a local tracker. */
  readonly labels: ReadonlyArray<string>
  readonly maps: ReadonlyArray<CollectedMap>
  readonly tickets: ReadonlyArray<CollectedTicket>
}

const KNOWN_LABELS: ReadonlySet<string> = new Set([
  'wayfinder:map',
  'wayfinder:research',
  'wayfinder:prototype',
  'wayfinder:grilling',
  'wayfinder:task',
  'wayfinder:claimed',
])
const TYPES: ReadonlyArray<TicketType> = ['research', 'prototype', 'grilling', 'task']
const isType = (value: string): value is TicketType =>
  (TYPES as ReadonlyArray<string>).includes(value)
const unknownLabels = (labels: ReadonlyArray<string>): ReadonlyArray<string> =>
  labels.filter((label) => label.startsWith('wayfinder:') && !KNOWN_LABELS.has(label))

/** A ticket read on its own, before its map, blockers and outcome are known. */
interface Draft {
  readonly number: number
  readonly title: string
  readonly ref: Ref
  readonly state: TicketState
  readonly type: TicketType | null
  readonly labels: ReadonlyArray<string>
  readonly claim: Claim | null
  /** Local: the triage role; null on GitHub. */
  readonly role: TriageRole | null
  /** Local: the Status line as written; null on GitHub. */
  readonly statusLine: string | null
  readonly body: string
  readonly resolution: Resolution | null
  readonly parent: number | null
  readonly partOf: number | null
  readonly nativeBlockers: ReadonlyArray<Blocker>
  /** GitHub: the numbers a `Blocked by:` text line holds; empty on a local tracker. */
  readonly textBlockers: ReadonlyArray<number>
  /** Local: the items of the `Blocked by:` header line; empty on GitHub. */
  readonly blockedByItems: ReadonlyArray<ReferenceItem>
  /** Local: the items of the `Blocks:` header line; empty on GitHub. */
  readonly blocksItems: ReadonlyArray<ReferenceItem>
  readonly warnings: DriftWarning[]
}

/** What one local blocker item names: an issue file of the effort, a reference that leaves it, or nothing. */
type ItemTarget = { readonly number: number } | { readonly outside: string } | null

/**
 * Reads every body in a collect and joins the facts into a snapshot: the
 * map's sections, each ticket's type, claim, blockers and resolution, which
 * map each ticket belongs to and in what order, and how the map records each
 * closed ticket. Facts are never guessed: what cannot be read is null beside a
 * coded warning. Which lines count as the convention and which as a text
 * fallback depends on the tracker.
 */
export function readSnapshot(collected: Collected): Snapshot {
  const onGitHub = collected.tracker.kind === 'github'
  const warnings: DriftWarning[] = []
  const unknown = unknownLabels(collected.labels)
  if (unknown.length > 0)
    warnings.push({ code: 'unknown-wayfinder-labels', detail: unknown.join(', ') })

  const drafts = collected.tickets.map((ticket) => readDraft(ticket, onGitHub))
  const byNumber = new Map(drafts.map((draft) => [draft.number, draft]))
  const bodies = new Map(collected.maps.map((map) => [map.number, readMapBody(map.body)]))

  // Which map a ticket belongs to: the tracker's parent, the map's own children, a task list, a `Part of` line.
  const mapOf = new Map<number, number>()
  const place = (ticket: number, map: number) => {
    if (!mapOf.has(ticket) && byNumber.has(ticket) && bodies.has(map)) mapOf.set(ticket, map)
  }
  for (const draft of drafts) if (draft.parent !== null) place(draft.number, draft.parent)
  for (const map of collected.maps) for (const child of map.children) place(child, map.number)
  for (const map of collected.maps)
    for (const child of bodies.get(map.number)?.taskList ?? []) place(child, map.number)
  for (const draft of drafts) if (draft.partOf !== null) place(draft.number, draft.partOf)

  // A local blocker is an issue file of the ticket's effort, the one directory its own file sits in.
  const targetOf = (draft: Draft, item: ReferenceItem): ItemTarget => {
    if (item.kind === 'slug' || item.kind === 'unread') return null
    if (item.kind === 'number')
      return byNumber.has(item.number) ? { number: item.number } : { outside: `#${item.number}` }
    const from = draft.ref.tracker === 'local' ? draft.ref.path : ''
    const resolved = resolveTarget(from, item.target)
    const inEffort = resolved !== null && directoryOfPath(resolved) === directoryOfPath(from)
    return inEffort && byNumber.has(item.number)
      ? { number: item.number }
      : { outside: item.target }
  }

  // A `Blocks:` line on A names B: A is one of B's blockers, whatever B's own line says.
  const blockedVia = new Map<number, number[]>()
  for (const draft of drafts) {
    for (const item of draft.blocksItems) {
      const target = targetOf(draft, item)
      if (target === null || !('number' in target)) continue
      blockedVia.set(target.number, [...(blockedVia.get(target.number) ?? []), draft.number])
    }
  }

  const finish = (draft: Draft): Ticket => {
    const map = mapOf.get(draft.number)
    const body = map === undefined ? undefined : bodies.get(map)
    const ticketWarnings = [...draft.warnings]

    const blockedBy: Blocker[] = [...draft.nativeBlockers]
    const block = (number: number) => {
      const other = byNumber.get(number)
      if (other === undefined || blockedBy.some((blocker) => blocker.number === number)) return
      blockedBy.push({ number, title: other.title, state: other.state, ref: other.ref })
    }
    for (const number of draft.textBlockers) {
      if (blockedBy.some((blocker) => blocker.number === number)) continue
      if (byNumber.has(number)) block(number)
      else if (map !== undefined) {
        ticketWarnings.push({
          code: 'blocker-outside-map',
          detail: `#${number} is not a ticket of any open map`,
        })
      }
    }
    for (const item of draft.blockedByItems) {
      const target = targetOf(draft, item)
      if (target === null) continue
      if ('number' in target) block(target.number)
      else if (map !== undefined) {
        ticketWarnings.push({
          code: 'blocker-outside-map',
          detail: `${target.outside} is not an issue file of this effort`,
        })
      }
    }
    for (const number of (blockedVia.get(draft.number) ?? []).toSorted((a, b) => a - b))
      block(number)
    if (map === undefined) {
      ticketWarnings.push({ code: 'no-map' })
    } else {
      for (const blocker of blockedBy) {
        if (mapOf.get(blocker.number) !== map) {
          ticketWarnings.push({
            code: 'blocker-outside-map',
            detail: `#${blocker.number} ${blocker.title}`,
          })
        }
      }
    }

    const decision = body?.decisions.find((line) => line.number === draft.number)
    let outcome: Outcome | null = null
    if (draft.state === 'closed' && body !== undefined) {
      if (decision !== undefined) outcome = 'decided'
      else if (body.outOfScope.some((entry) => entry.tickets.includes(draft.number)))
        outcome = 'out-of-scope'
      else {
        outcome = 'unrecorded'
        ticketWarnings.push({ code: 'closed-unrecorded' })
      }
    }

    return {
      number: draft.number,
      title: draft.title,
      ref: draft.ref,
      state: draft.state,
      type: draft.type,
      // Null until the local type rules fill it; GitHub never does.
      modeNote: null,
      labels: draft.labels,
      claim: draft.claim,
      role: draft.role,
      statusLine: draft.statusLine,
      blockedBy,
      body: draft.body,
      resolution: draft.resolution,
      outcome,
      gist: decision?.gist ?? null,
      warnings: ticketWarnings,
    }
  }

  const tickets = new Map(drafts.map((draft) => [draft.number, finish(draft)]))

  const maps: WayfinderMap[] = collected.maps.map((map) => {
    const body = bodies.get(map.number)
    if (body === undefined) throw new Error(`map #${map.number} was not read`)
    const mapWarnings = [...(onGitHub ? [] : localMapWarnings(map)), ...body.warnings]
    for (const decision of body.decisions) {
      const linked = decision.number === null ? undefined : byNumber.get(decision.number)
      if (linked?.state === 'open') {
        mapWarnings.push({
          code: 'decision-links-open-ticket',
          detail: `#${linked.number} ${linked.title}`,
        })
      }
    }

    let title = map.title
    if (title === null) {
      title = firstH1(map.body)
      if (title === null) {
        title = humanize(directoryOf(map.ref), map.number)
        mapWarnings.push({ code: 'map-title-from-directory' })
      }
    }

    const position = new Map<number, number>()
    map.children.forEach((child, index) => position.set(child, index))
    body.taskList.forEach((child, index) => {
      if (!position.has(child)) position.set(child, map.children.length + index)
    })
    const members = [...mapOf.entries()]
      .filter(([, owner]) => owner === map.number)
      .map(([number]) => number)
      .sort((a, b) => (position.get(a) ?? Infinity) - (position.get(b) ?? Infinity) || a - b)

    return {
      number: map.number,
      title,
      ref: map.ref,
      body: map.body,
      tickets: members
        .map((number) => tickets.get(number))
        .filter((ticket) => ticket !== undefined),
      destination: body.destination,
      notes: body.notes,
      decisions: body.decisions,
      notYetSpecified: body.notYetSpecified,
      outOfScope: body.outOfScope,
      warnings: mapWarnings,
    }
  })

  // The strays: tickets the collect holds that no open map takes, in one group with no effort.
  const strays = drafts
    .filter((draft) => !mapOf.has(draft.number))
    .map((draft) => tickets.get(draft.number))
    .filter((ticket) => ticket !== undefined)

  return {
    tracker: collected.tracker,
    repoRoot: collected.repoRoot,
    collectedAt: collected.collectedAt,
    maps,
    unmapped: strays.length === 0 ? [] : [{ effort: null, title: null, tickets: strays }],
    warnings,
  }
}

/** What a local map's file and header lines raise: several map files, bold keys, a Status word this version does not read. */
function localMapWarnings(map: CollectedMap): DriftWarning[] {
  const warnings: DriftWarning[] = []
  const files = map.mapFiles ?? []
  if (files.length > 1)
    warnings.push({
      code: 'map-file-ambiguous',
      detail: `${files.join(', ')}; read ${fileOf(map.ref)}`,
    })
  const bold = boldKeysOf(readHeaderLines(map.body))
  if (bold.length > 0) warnings.push({ code: 'header-key-bold', detail: bold.join(', ') })
  const status = readMapStatus(map.body)
  if (status.unknown !== null) warnings.push({ code: 'map-status-unknown', detail: status.unknown })
  return warnings
}

/** The parts of a ticket that need no other item: title, state, type, claim, resolution, and the lines it carries. */
function readDraft(ticket: CollectedTicket, onGitHub: boolean): Draft {
  const warnings: DriftWarning[] = []
  const body = readTicketBody(ticket.body)
  // A local ticket's facts sit on its header lines; GitHub reads its text fallbacks from any line.
  const local = onGitHub ? null : headerTicketLines(body.header)
  const lines = local ?? body
  if (!onGitHub) {
    const bold = boldKeysOf(body.header)
    if (bold.length > 0) warnings.push({ code: 'header-key-bold', detail: bold.join(', ') })
  }

  let title = ticket.title
  if (title === null) {
    title = body.title
    if (title === null) {
      title = humanize(fileOf(ticket.ref), ticket.number)
      warnings.push({ code: 'ticket-title-from-slug' })
    }
  }

  const partOf = onGitHub ? body.partOf : null
  if (partOf !== null)
    warnings.push({ code: 'parent-as-part-of-line', detail: `Part of #${partOf}` })

  const textBlockers = onGitHub ? (body.blockedBy?.numbers ?? []) : []
  if (textBlockers.length > 0) warnings.push({ code: 'blockers-as-text-line' })
  if (local === null) {
    const slugs = body.blockedBy?.slugs ?? []
    if (slugs.length > 0) warnings.push({ code: 'blockers-as-slugs', detail: slugs.join(', ') })
  } else {
    warnings.push(...referenceLineWarnings(local.blockedBy, local.blocks))
  }

  let type: TicketType | null = null
  if (onGitHub) {
    const fromLabels = ticket.labels
      .filter((label) => label.startsWith('wayfinder:'))
      .map((label) => label.slice('wayfinder:'.length))
      .filter(isType)
    if (fromLabels.length > 1) {
      warnings.push({ code: 'type-several', detail: fromLabels.join(', ') })
    } else if (fromLabels[0] !== undefined) {
      type = fromLabels[0]
    } else if (lines.type?.value) {
      type = lines.type.value
      warnings.push({ code: 'type-as-line', detail: lines.type.raw })
    } else {
      warnings.push({
        code: 'type-missing',
        ...(lines.type === null ? {} : { detail: lines.type.raw }),
      })
    }
  } else if (lines.type?.value) {
    type = lines.type.value
  } else {
    warnings.push({
      code: 'type-missing',
      ...(lines.type === null ? {} : { detail: lines.type.raw }),
    })
  }

  let state: TicketState = ticket.state ?? 'open'
  let claim: Claim | null = null
  let role: TriageRole | null = null
  let statusLine: string | null = null
  if (onGitHub) {
    if (ticket.assignees.length > 0) claim = { by: ticket.assignees }
    if (ticket.labels.includes('wayfinder:claimed')) {
      claim = { by: ticket.assignees }
      warnings.push({ code: 'claim-legacy-label' })
    }
  } else {
    const status = readTicketStatus(body.header)
    state = status.state
    claim = status.claim
    role = status.role
    statusLine = status.statusLine
    warnings.push(...status.warnings)
  }

  if (!body.hasQuestion) warnings.push({ code: 'no-question-heading' })

  const unknown = unknownLabels(ticket.labels)
  if (unknown.length > 0)
    warnings.push({ code: 'unknown-wayfinder-labels', detail: unknown.join(', ') })

  const resolution = onGitHub
    ? ticket.lastComment
    : body.answer === null
      ? null
      : { body: body.answer, author: null, at: null }
  if (state === 'closed' && resolution === null) warnings.push({ code: 'closed-no-resolution' })

  return {
    number: ticket.number,
    title,
    ref: ticket.ref,
    state,
    type,
    labels: onGitHub ? ticket.labels : (lines.labels ?? ticket.labels),
    claim,
    role,
    statusLine,
    body: ticket.body,
    resolution,
    parent: ticket.parent,
    partOf,
    nativeBlockers: ticket.blockedBy,
    textBlockers,
    blockedByItems: local?.blockedBy?.items ?? [],
    blocksItems: local?.blocks?.items ?? [],
    warnings,
  }
}

/**
 * What a local ticket's `Blocked by:` and `Blocks:` lines raise. A none marker raises nothing. A
 * `Blocked by:` item with no reference at its start is a slug or unread; a value that names a
 * ticket off the template's `NN, NN` is noted once. Any `Blocks:` line that names something is
 * noted; an item of it that names no issue file of the effort is dropped without a word.
 */
function referenceLineWarnings(
  blockedBy: ReferenceLine | null,
  blocks: ReferenceLine | null,
): DriftWarning[] {
  const warnings: DriftWarning[] = []
  if (blockedBy !== null && !blockedBy.none) {
    const slugs = blockedBy.items.flatMap((item) => (item.kind === 'slug' ? [item.text] : []))
    if (slugs.length > 0) warnings.push({ code: 'blockers-as-slugs', detail: slugs.join(', ') })
    for (const item of blockedBy.items)
      if (item.kind === 'unread') warnings.push({ code: 'blocker-unread', detail: item.text })
    const named = blockedBy.items.some((item) => item.kind === 'number' || item.kind === 'file')
    if (named && !blockedBy.template)
      warnings.push({ code: 'blockers-not-template', detail: blockedBy.raw })
  }
  if (blocks !== null && !blocks.none) warnings.push({ code: 'blocks-line', detail: blocks.raw })
  return warnings
}

const segments = (ref: Ref): ReadonlyArray<string> =>
  (ref.tracker === 'local' ? ref.path : ref.url).split('/').filter((segment) => segment !== '')

/** The file name a local ticket's path ends in. */
const fileOf = (ref: Ref): string => segments(ref).at(-1) ?? ''

/** The directory a local map's file sits in. */
const directoryOf = (ref: Ref): string => segments(ref).at(-2) ?? ''

/** `.scratch/e/issues/03-x.md` → `.scratch/e/issues`. */
const directoryOfPath = (path: string): string => path.split('/').slice(0, -1).join('/')

/** `03-foo-bar.md` → `Foo bar`; `#n` when there is nothing to read. */
function humanize(slug: string, number: number): string {
  const words = slug.replace(/\.md$/i, '').replace(/^\d+-/, '').replace(/[-_]+/g, ' ').trim()
  if (words === '') return `#${number}`
  return words.charAt(0).toUpperCase() + words.slice(1)
}
