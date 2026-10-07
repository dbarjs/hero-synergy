import { Schema } from 'effect'

import { warningCodes } from './warnings.ts'

/**
 * The snapshot: the typed state of every open map in a repo at one moment.
 *
 * Three kinds of value, nested per map: facts the tracker reports, sections
 * code read from bodies, and coded drift warnings. Nothing derived (the
 * frontier, the ordering and the neighbourhood are functions over it) and
 * nothing about sessions. Boundary data is plain JSON: the decoded and the
 * encoded shapes are the same, timestamps stay ISO strings, nothing transforms.
 *
 * The schemas stay in this module; the package exports the types and the two
 * parse functions.
 */

const Ref = Schema.Union([
  Schema.Struct({ tracker: Schema.Literal('github'), url: Schema.String }),
  Schema.Struct({ tracker: Schema.Literal('local'), path: Schema.String }),
])

const Tracker = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('github'), owner: Schema.String, repo: Schema.String }),
  Schema.Struct({ kind: Schema.Literal('local') }),
])

const TicketState = Schema.Literals(['open', 'closed'])
const TicketType = Schema.Literals(['research', 'prototype', 'grilling', 'task'])
const Outcome = Schema.Literals(['decided', 'out-of-scope', 'unrecorded'])

const DriftWarning = Schema.Struct({
  code: Schema.Literals(warningCodes),
  detail: Schema.optionalKey(Schema.String),
})

const Claim = Schema.Struct({ by: Schema.Array(Schema.String) })

const Blocker = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  state: TicketState,
  ref: Ref,
})

const Resolution = Schema.Struct({
  body: Schema.String,
  author: Schema.NullOr(Schema.String),
  at: Schema.NullOr(Schema.String),
})

const Decision = Schema.Struct({
  number: Schema.NullOr(Schema.Number),
  title: Schema.String,
  link: Schema.String,
  gist: Schema.String,
})

const SectionEntry = Schema.Struct({
  text: Schema.String,
  tickets: Schema.Array(Schema.Number),
})

const Ticket = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  ref: Ref,
  state: TicketState,
  type: Schema.NullOr(TicketType),
  claim: Schema.NullOr(Claim),
  blockedBy: Schema.Array(Blocker),
  body: Schema.String,
  resolution: Schema.NullOr(Resolution),
  outcome: Schema.NullOr(Outcome),
  gist: Schema.NullOr(Schema.String),
  warnings: Schema.Array(DriftWarning),
})

const WayfinderMap = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  ref: Ref,
  body: Schema.String,
  tickets: Schema.Array(Ticket),
  destination: Schema.NullOr(Schema.String),
  notes: Schema.NullOr(Schema.String),
  decisions: Schema.Array(Decision),
  notYetSpecified: Schema.Array(SectionEntry),
  outOfScope: Schema.Array(SectionEntry),
  warnings: Schema.Array(DriftWarning),
})

const Snapshot = Schema.Struct({
  tracker: Tracker,
  repoRoot: Schema.String,
  collectedAt: Schema.String,
  maps: Schema.Array(WayfinderMap),
  unmapped: Schema.Array(Ticket),
  warnings: Schema.Array(DriftWarning),
})

/** How to open and launch an item: a URL on GitHub, a repo-relative path on a local tracker. */
export type Ref = typeof Ref.Type
/** Where the maps were read from. */
export type Tracker = typeof Tracker.Type
export type TicketState = typeof TicketState.Type
export type TicketType = typeof TicketType.Type
/** How the map records a closed ticket: in Decisions so far, in Out of scope, or nowhere. */
export type Outcome = typeof Outcome.Type
/** A ticket marked as taken. `by` names the assignees on GitHub and nobody on a local tracker. */
export type Claim = typeof Claim.Type
/** A ticket this ticket waits on, with enough to render and gate on it wherever it lives. */
export type Blocker = typeof Blocker.Type
/** The answer: the last comment on GitHub, the `## Answer` section locally. */
export type Resolution = typeof Resolution.Type
/** One line of the map's Decisions so far. */
export type Decision = typeof Decision.Type
/** One entry of Not yet specified or Out of scope: its text and the tickets it links. */
export type SectionEntry = typeof SectionEntry.Type
export type Ticket = typeof Ticket.Type
/** A wayfinder map (`Map` would shadow the global). */
export type WayfinderMap = typeof WayfinderMap.Type
export type Snapshot = typeof Snapshot.Type

/** The JSON form of a snapshot: the same shape, since nothing transforms. */
export type SnapshotJson = typeof Snapshot.Encoded

/**
 * Validates a JSON value (the scout's cache, a message) as a snapshot. Throws a
 * `SchemaError` naming the first field that does not fit.
 */
export const decodeSnapshot: (input: unknown) => Snapshot = Schema.decodeUnknownSync(Snapshot)

/** The snapshot as the JSON it is stored and sent as. */
export const encodeSnapshot: (snapshot: Snapshot) => SnapshotJson = Schema.encodeSync(Snapshot)

/**
 * The shape of a stored snapshot. Bump it whenever the schema above changes, so
 * a cache written under the old shape is ignored instead of decoded.
 */
export const snapshotSchemaVersion = 1
