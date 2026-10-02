// PROTOTYPE. Ground truth for the status-hooks experiment: one line per hook
// event, with the whole input (long strings cut short).
import { appendFileSync, readFileSync } from 'node:fs'

const file = process.env.HERO_SYNERGY_PROBE
if (!file) process.exit(0)

const at = Date.now()
const short = (value) =>
  typeof value === 'string' && value.length > 200
    ? `${value.slice(0, 200)}…`
    : Array.isArray(value)
      ? value.map(short)
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, short(v)]))
        : value
try {
  const input = JSON.parse(readFileSync(0, 'utf8'))
  appendFileSync(file, `${JSON.stringify({ at, hook: input.hook_event_name, input: short(input) })}\n`)
} catch (error) {
  appendFileSync(file, `${JSON.stringify({ at, hook: 'PROBE_ERROR', input: { error: String(error) } })}\n`)
}
