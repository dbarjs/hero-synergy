import { appendFileSync, readFileSync } from 'node:fs'

const file = process.env.HERO_SYNERGY_EVENTS
if (!file) process.exit(0) // not a Cockpit session

const input = JSON.parse(readFileSync(0, 'utf8'))
const event = {
  ticket: process.env.HERO_SYNERGY_TICKET,
  hook: input.hook_event_name,
  detail: input.notification_type ?? input.source ?? input.reason ?? null,
  session: input.session_id,
  at: Date.now(),
}
appendFileSync(file, `${JSON.stringify(event)}\n`)
