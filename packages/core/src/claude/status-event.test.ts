import { describe, expect, test } from 'vite-plus/test'

import { fixtureNames, fixtureText } from './fixtures.ts'
import { readStatusEvent, readStatusEvents } from './status-event.ts'

const runs = fixtureNames('status')
  .filter((name) => !name.endsWith('.prototype.events.jsonl'))
  .map((name) => name.replace('.events.jsonl', ''))

describe.each(runs)('the prototype run %s', (run) => {
  test('decodes line by line, in the plugin shape and as the prototype first recorded it', () => {
    const current = readStatusEvents(fixtureText(`status/${run}.events.jsonl`))
    const recorded = readStatusEvents(fixtureText(`status/${run}.prototype.events.jsonl`))
    expect(current.warnings).toEqual([])
    expect(recorded.warnings).toEqual([])
    expect(current.value.length).toBeGreaterThan(0)
    // The two files come from two recorders on the same run, a few milliseconds apart.
    expect(recorded.value.map((event) => [event.hook, event.session])).toEqual(
      current.value.map((event) => [event.hook, event.session]),
    )
  })
})

describe('the three hooks the plugin registers', () => {
  test('a session start carries its id and its source', () => {
    const events = readStatusEvents(fixtureText('status/a-headless.events.jsonl')).value
    expect(events[0]).toEqual({
      ticket: '46',
      hook: 'SessionStart',
      session: '7533eedb-60c6-475a-af31-6be493c96b5b',
      detail: 'startup',
      at: 1790971746047,
      payload: {
        session_id: '7533eedb-60c6-475a-af31-6be493c96b5b',
        hook_event_name: 'SessionStart',
        source: 'startup',
      },
    })
  })

  test('a session end carries its reason, whatever it is', () => {
    const reasonOf = (run: string) =>
      readStatusEvents(fixtureText(`status/${run}.events.jsonl`))
        .value.filter((event) => event.hook === 'SessionEnd')
        .map((event) => event.detail)
    expect(reasonOf('a-headless')).toEqual(['other'])
    expect(reasonOf('b-interactive')).toContain('prompt_input_exit')
    expect(reasonOf('b-interactive')).toContain('clear')
  })

  test('a stop failure carries the error the payload names', () => {
    const failure = readStatusEvents(fixtureText('status/f-stopfailure3.events.jsonl')).value.find(
      (event) => event.hook === 'StopFailure',
    )
    expect(failure?.detail).toBe('model_not_found')
    expect(failure?.payload.error).toBe('model_not_found')
  })

  test('the prototype lines, which had no payload, still give session and detail', () => {
    const [start] = readStatusEvents(fixtureText('status/a-headless.prototype.events.jsonl')).value
    expect(start).toMatchObject({ hook: 'SessionStart', detail: 'startup', payload: {} })
    expect(start?.session).toBe('7533eedb-60c6-475a-af31-6be493c96b5b')
  })

  test('reads the detail and the id from the payload when the line leaves them out', () => {
    const read = readStatusEvent(
      '{"ticket":"46","hook":"SessionEnd","payload":{"session_id":"s","reason":"logout"}}',
    )
    expect(read.warnings).toEqual([])
    expect(read.value).toMatchObject({ session: 's', detail: 'logout', at: null })
  })

  test('reads the ISO time the plugin writes as epoch milliseconds', () => {
    const read = readStatusEvent(
      '{"ticket":"46","hook":"SessionStart","session":"s","detail":"startup","at":"2026-10-02T20:09:52.163Z","payload":{}}',
    )
    expect(read.warnings).toEqual([])
    expect(read.value?.at).toBe(Date.parse('2026-10-02T20:09:52.163Z'))
  })

  test('a time that is not a date reads as no time, not as a bad line', () => {
    const read = readStatusEvent('{"ticket":"46","hook":"SessionStart","session":"s","at":"soon"}')
    expect(read.warnings).toEqual([])
    expect(read.value?.at).toBeNull()
  })

  test('hooks of other kinds decode with no detail', () => {
    const read = readStatusEvent('{"ticket":"46","hook":"Stop","session":"s","detail":null,"at":1}')
    expect(read).toEqual({
      value: { ticket: '46', hook: 'Stop', session: 's', detail: null, at: 1, payload: {} },
      warnings: [],
    })
  })

  test('fields a later plugin adds are ignored', () => {
    const read = readStatusEvent(
      '{"ticket":"46","hook":"SessionStart","session":"s","detail":"startup","at":1,"payload":{"session_id":"s","effort":{"level":"high"}},"extra":true}',
    )
    expect(read.warnings).toEqual([])
    expect(read.value?.payload).toEqual({ session_id: 's' })
  })
})

describe('what an events file can get wrong', () => {
  test('a SessionStart without a session id is hook-payload-unreadable, and the event still comes', () => {
    const read = readStatusEvents(fixtureText('health/hook-payload-unreadable.events.jsonl'))
    expect(read.warnings.map((warning) => warning.code)).toEqual(['hook-payload-unreadable'])
    expect(read.value).toHaveLength(1)
    expect(read.value[0]).toMatchObject({ hook: 'SessionStart', session: null, detail: 'startup' })
  })

  test('a SessionEnd without a reason is hook-reason-missing, and the event still comes', () => {
    const read = readStatusEvents(fixtureText('health/hook-reason-missing.events.jsonl'))
    expect(read.warnings.map((warning) => warning.code)).toEqual(['hook-reason-missing'])
    expect(read.value[0]).toMatchObject({
      hook: 'SessionEnd',
      detail: null,
      session: 'f67b80b3-b3bd-4089-b27f-eaaf0146bc30',
    })
  })

  test('a line that is not JSON, or lacks its ticket or hook, gives no event and one warning', () => {
    for (const line of ['{"ticket":"46","hook":', '[]', '{"hook":"Stop"}', '{"ticket":"46"}']) {
      const read = readStatusEvent(line)
      expect(read.value).toBeNull()
      expect(read.warnings.map((warning) => warning.code)).toEqual(['hook-payload-unreadable'])
    }
  })

  test('blank lines and a missing final newline are not problems', () => {
    const text = `\n${fixtureText('status/a-headless.events.jsonl').trimEnd()}\n\n`
    const read = readStatusEvents(text)
    expect(read.warnings).toEqual([])
    expect(read.value).toHaveLength(4)
  })

  test('a bad line does not stop the lines after it, and its warning names the line', () => {
    const read = readStatusEvents(
      `${fixtureText('status/a-headless.events.jsonl')}garbage\n{"ticket":"46","hook":"Stop","session":"s"}\n`,
    )
    expect(read.value).toHaveLength(5)
    expect(read.warnings).toHaveLength(1)
    expect(read.warnings[0]?.detail?.startsWith('line 5:')).toBe(true)
  })
})
