import { Schema } from 'effect'

import type { HealthWarning } from '../snapshot/warnings.ts'
import { attempt, type Decoded, decoder, parseJson, warn } from './decode.ts'

/**
 * One line of the events file, as the status plugin's report writes it:
 * `{ticket, hook, session, detail, at, payload}`. `ticket` is the
 * `HERO_SYNERGY_TICKET` env var, `hook` the hook name, `session` and `detail`
 * what the payload carried (`source` for a start, `reason` for an end, `error`
 * for a failure), `at` the write time (the plugin writes an ISO string; the
 * prototype's lines carry epoch milliseconds, which decode too), `payload` the
 * fields of the hook payload the Cockpit reads. The prototype's first lines
 * had no `payload`; they decode too, `session` and `detail` standing in.
 *
 * Every field but `ticket` and `hook` is optional here, so a line from a
 * plugin of another version still decodes, and a missing field becomes a coded
 * warning only where the Cockpit needs it.
 */

const Payload = Schema.Struct({
  session_id: Schema.optionalKey(Schema.String),
  hook_event_name: Schema.optionalKey(Schema.String),
  source: Schema.optionalKey(Schema.String),
  reason: Schema.optionalKey(Schema.String),
  error: Schema.optionalKey(Schema.String),
})

const Line = Schema.Struct({
  ticket: Schema.String,
  hook: Schema.String,
  session: Schema.optionalKey(Schema.NullOr(Schema.String)),
  detail: Schema.optionalKey(Schema.NullOr(Schema.String)),
  at: Schema.optionalKey(Schema.Union([Schema.Number, Schema.String])),
  payload: Schema.optionalKey(Payload),
})

const decodeLine = decoder(Line)

/** A write time as epoch milliseconds: a number as it is, an ISO string parsed, anything unreadable null. */
const millisOf = (at: number | string | undefined): number | null => {
  if (at === undefined) return null
  if (typeof at === 'number') return at
  const parsed = Date.parse(at)
  return Number.isNaN(parsed) ? null : parsed
}

export interface HookPayload {
  readonly session_id?: string
  readonly hook_event_name?: string
  readonly source?: string
  readonly reason?: string
  readonly error?: string
}

export interface StatusEvent {
  /** The ticket number or reference the Cockpit launched the session for. */
  readonly ticket: string
  /** The hook name; `SessionStart`, `SessionEnd` and `StopFailure` are the ones the plugin registers. */
  readonly hook: string
  /** The session id, from the line or else the payload; null when neither has one. */
  readonly session: string | null
  /** `source` of a start, `reason` of an end, `error` of a failure; null when there is none. */
  readonly detail: string | null
  /** Epoch milliseconds the plugin wrote the line; null when the line has none. */
  readonly at: number | null
  readonly payload: HookPayload
}

/** One line of the events file; blank lines give no event and no warning. */
export function readStatusEvent(line: string): Decoded<StatusEvent | null> {
  if (line.trim() === '') return { value: null, warnings: [] }

  const parsed = parseJson(line)
  if (!parsed.ok) {
    return { value: null, warnings: [warn('hook-payload-unreadable', parsed.message)] }
  }
  const decoded = attempt(decodeLine, parsed.value)
  if (!decoded.ok) {
    return { value: null, warnings: [warn('hook-payload-unreadable', decoded.message)] }
  }

  const { ticket, hook, session, detail, at, payload = {} } = decoded.value
  const warnings: HealthWarning[] = []

  const sessionId = session ?? payload.session_id ?? null
  const hookDetail = detail ?? detailOf(hook, payload) ?? null
  // A start without a session id still makes the session live; only the id is lost.
  if (hook === 'SessionStart' && sessionId === null) {
    warnings.push(
      warn('hook-payload-unreadable', `SessionStart for ticket ${ticket} has no session id`),
    )
  }
  if (hook === 'SessionEnd' && hookDetail === null) {
    warnings.push(warn('hook-reason-missing', `SessionEnd for ticket ${ticket} has no reason`))
  }

  return {
    value: { ticket, hook, session: sessionId, detail: hookDetail, at: millisOf(at), payload },
    warnings,
  }
}

function detailOf(hook: string, payload: HookPayload): string | undefined {
  switch (hook) {
    case 'SessionStart':
      return payload.source
    case 'SessionEnd':
      return payload.reason
    case 'StopFailure':
      return payload.error
    default:
      return undefined
  }
}

/** A whole events file (or the new bytes of one): its events in line order and every warning, each naming its line. */
export function readStatusEvents(text: string): Decoded<ReadonlyArray<StatusEvent>> {
  const events: StatusEvent[] = []
  const warnings: HealthWarning[] = []
  for (const [index, line] of text.split('\n').entries()) {
    const read = readStatusEvent(line)
    if (read.value !== null) events.push(read.value)
    for (const warning of read.warnings) {
      warnings.push({ ...warning, detail: `line ${index + 1}: ${warning.detail ?? ''}` })
    }
  }
  return { value: events, warnings }
}
