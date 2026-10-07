// The status plugin's one handler. Claude Code runs it on SessionStart, SessionEnd and
// StopFailure (see hooks/hooks.json) with the hook payload on stdin. It appends one JSON
// line to the events file the Cockpit watches, then exits 0 whatever happened: a hook that
// fails is noise in the session, and a line that is missing is a status the Cockpit never sees.
//
// Plain Node, no dependencies, no build step. Runs on Node >= 22.18.

import { appendFileSync, readFileSync } from 'node:fs'

const MAX_STDIN_KEPT = 64 * 1024

/** What the hook received on stdin, read defensively: '' when there is nothing to read. */
function readStdin() {
  try {
    return readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

/** The payload as an object when stdin is a JSON object, otherwise null. */
function parsePayload(text) {
  try {
    const value = JSON.parse(text)
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

/** A string field of the payload, or null when absent or not a string. */
function stringField(payload, key) {
  const value = payload?.[key]
  return typeof value === 'string' ? value : null
}

/**
 * One status event: the fields the Cockpit reads first, then the whole payload so a decoder
 * can read anything else leniently. `detail` is the one field that varies per hook: `source`
 * for a start, `reason` for an end, `error` for a failure. When stdin was not a JSON object,
 * `payload` is null and `stdin` carries the text as it came.
 */
function buildEvent({ ticket, stdin, now }) {
  const payload = parsePayload(stdin)
  const event = {
    ticket: ticket ?? null,
    hook: stringField(payload, 'hook_event_name'),
    session: stringField(payload, 'session_id'),
    detail:
      stringField(payload, 'source') ??
      stringField(payload, 'reason') ??
      stringField(payload, 'error'),
    at: now.toISOString(),
    payload,
  }
  if (payload === null) event.stdin = stdin.slice(0, MAX_STDIN_KEPT)
  return event
}

function main() {
  const file = process.env.HERO_SYNERGY_EVENTS
  if (!file) return // not a Cockpit session

  const event = buildEvent({
    ticket: process.env.HERO_SYNERGY_TICKET,
    stdin: readStdin(),
    now: new Date(),
  })
  try {
    appendFileSync(file, `${JSON.stringify(event)}\n`)
  } catch (error) {
    // The Cockpit creates the file before it watches it; if it is gone there is no one to tell.
    process.stderr.write(`hero-synergy-status: could not append to ${file}: ${String(error)}\n`)
  }
}

main()
