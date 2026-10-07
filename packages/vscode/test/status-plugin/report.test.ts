import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test'

/**
 * The status plugin from both sides: spawn its report as Claude Code does (a hook payload on
 * stdin, the Cockpit's two variables in the environment) and assert the line it appends; then
 * read the recordings of the prototype's real sessions to pin the line shape the Cockpit decodes.
 */

const PLUGIN_DIR = resolve(import.meta.dirname, '../../claude-plugin')
const REPORT = join(PLUGIN_DIR, 'report.mjs')
const FIXTURES = resolve(import.meta.dirname, '../fixtures/status-events')
const HOOKS = ['SessionStart', 'SessionEnd', 'StopFailure'] as const

type StatusEvent = {
  ticket: string | null
  hook: string | null
  session: string | null
  detail: string | null
  at: string
  payload: Record<string, unknown> | null
  stdin?: string
}

type ProbeRecord = { at: number; hook: string; input: Record<string, unknown> }

/** Runs the report once as a hook would be run; `events` unset leaves HERO_SYNERGY_EVENTS out. */
function report(options: { events?: string; ticket?: string; stdin?: string }) {
  const env: Record<string, string> = { PATH: process.env.PATH ?? '' }
  if (options.events !== undefined) env.HERO_SYNERGY_EVENTS = options.events
  if (options.ticket !== undefined) env.HERO_SYNERGY_TICKET = options.ticket
  return spawnSync(process.execPath, [REPORT], {
    env,
    input: options.stdin ?? '',
    encoding: 'utf8',
    timeout: 10_000,
  })
}

function readLines(file: string): StatusEvent[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as StatusEvent)
}

function readProbe(file: string): ProbeRecord[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ProbeRecord)
}

const isIsoTime = (value: unknown) =>
  typeof value === 'string' &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === value

describe('the report, spawned as a hook', () => {
  let dir: string
  let events: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hero-synergy-status-'))
    events = join(dir, 'events.jsonl')
    writeFileSync(events, '') // the Cockpit creates the file before it watches it
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  test('SessionStart appends one line with the ticket, the hook, the session, the source and the payload', () => {
    const payload = {
      session_id: 'sid-start',
      hook_event_name: 'SessionStart',
      source: 'startup',
      cwd: '/repo',
    }
    const result = report({ events, ticket: '40', stdin: JSON.stringify(payload) })

    expect(result.status).toBe(0)
    const lines = readLines(events)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toEqual({
      ticket: '40',
      hook: 'SessionStart',
      session: 'sid-start',
      detail: 'startup',
      at: expect.any(String),
      payload,
    })
    expect(isIsoTime(lines[0]?.at)).toBe(true)
  })

  test('SessionEnd carries the reason as its detail', () => {
    const payload = {
      session_id: 'sid-end',
      hook_event_name: 'SessionEnd',
      reason: 'prompt_input_exit',
    }
    const result = report({ events, ticket: '40', stdin: JSON.stringify(payload) })

    expect(result.status).toBe(0)
    expect(readLines(events)).toEqual([
      {
        ticket: '40',
        hook: 'SessionEnd',
        session: 'sid-end',
        detail: 'prompt_input_exit',
        at: expect.any(String),
        payload,
      },
    ])
  })

  test('StopFailure carries the error as its detail', () => {
    const payload = {
      session_id: 'sid-fail',
      hook_event_name: 'StopFailure',
      error: 'model_not_found',
      last_assistant_message: 'There is an issue with the selected model.',
    }
    const result = report({ events, ticket: '40', stdin: JSON.stringify(payload) })

    expect(result.status).toBe(0)
    expect(readLines(events)).toEqual([
      {
        ticket: '40',
        hook: 'StopFailure',
        session: 'sid-fail',
        detail: 'model_not_found',
        at: expect.any(String),
        payload,
      },
    ])
  })

  test('three hooks in a row append three lines in order, each a complete JSON line', () => {
    const payloads = [
      { session_id: 's', hook_event_name: 'SessionStart', source: 'resume' },
      { session_id: 's', hook_event_name: 'StopFailure', error: 'rate_limit' },
      { session_id: 's', hook_event_name: 'SessionEnd', reason: 'other' },
    ]
    for (const payload of payloads) report({ events, ticket: '7', stdin: JSON.stringify(payload) })

    const raw = readFileSync(events, 'utf8')
    expect(raw.endsWith('\n')).toBe(true)
    expect(raw.split('\n').filter(Boolean)).toHaveLength(3)
    expect(readLines(events).map((e) => [e.hook, e.detail])).toEqual([
      ['SessionStart', 'resume'],
      ['StopFailure', 'rate_limit'],
      ['SessionEnd', 'other'],
    ])
  })

  test('with HERO_SYNERGY_EVENTS unset it exits 0 and touches nothing', () => {
    const payload = { session_id: 'sid', hook_event_name: 'SessionStart', source: 'startup' }
    const result = report({ ticket: '40', stdin: JSON.stringify(payload) })

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
    expect(readFileSync(events, 'utf8')).toBe('')
    expect(readdirSync(dir)).toEqual(['events.jsonl'])
  })

  test('an empty stdin exits 0 and appends a line with null fields and the empty text', () => {
    const result = report({ events, ticket: '40', stdin: '' })

    expect(result.status).toBe(0)
    expect(readLines(events)).toEqual([
      {
        ticket: '40',
        hook: null,
        session: null,
        detail: null,
        at: expect.any(String),
        payload: null,
        stdin: '',
      },
    ])
  })

  test('a malformed stdin exits 0 and appends a line carrying the text it got', () => {
    const result = report({ events, ticket: '40', stdin: '{"session_id": "half' })

    expect(result.status).toBe(0)
    expect(readLines(events)).toEqual([
      {
        ticket: '40',
        hook: null,
        session: null,
        detail: null,
        at: expect.any(String),
        payload: null,
        stdin: '{"session_id": "half',
      },
    ])
  })

  test('a JSON payload that is not an object is kept as text, not as the payload', () => {
    const result = report({ events, ticket: '40', stdin: '[1, 2]' })

    expect(result.status).toBe(0)
    const [line] = readLines(events)
    expect(line?.payload).toBeNull()
    expect(line?.stdin).toBe('[1, 2]')
  })

  test('a payload with the fields in unexpected types keeps them in the payload and nulls the decoded ones', () => {
    const payload = { session_id: 42, hook_event_name: 'SessionStart', source: ['startup'] }
    const result = report({ events, ticket: '40', stdin: JSON.stringify(payload) })

    expect(result.status).toBe(0)
    expect(readLines(events)).toEqual([
      {
        ticket: '40',
        hook: 'SessionStart',
        session: null,
        detail: null,
        at: expect.any(String),
        payload,
      },
    ])
  })

  test('with no HERO_SYNERGY_TICKET the ticket is null and the line is still appended', () => {
    const payload = { session_id: 'sid', hook_event_name: 'SessionEnd', reason: 'logout' }
    const result = report({ events, stdin: JSON.stringify(payload) })

    expect(result.status).toBe(0)
    expect(readLines(events)[0]).toMatchObject({
      ticket: null,
      hook: 'SessionEnd',
      detail: 'logout',
    })
  })

  test('an events path whose directory is missing exits 0 and reports on stderr', () => {
    const payload = { session_id: 'sid', hook_event_name: 'SessionStart', source: 'startup' }
    const result = report({
      events: join(dir, 'missing', 'events.jsonl'),
      ticket: '40',
      stdin: JSON.stringify(payload),
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toContain('hero-synergy-status')
  })
})

describe('the plugin as Claude Code loads it', () => {
  test('plugin.json names the plugin', () => {
    const manifest = JSON.parse(
      readFileSync(join(PLUGIN_DIR, '.claude-plugin/plugin.json'), 'utf8'),
    ) as {
      name: string
      description: string
    }
    expect(manifest.name).toBe('hero-synergy-status')
    expect(manifest.description).toContain('Cockpit')
  })

  test('hooks.json declares exactly SessionStart, SessionEnd and StopFailure, each exec-form and async', () => {
    const manifest = JSON.parse(readFileSync(join(PLUGIN_DIR, 'hooks/hooks.json'), 'utf8')) as {
      hooks: Record<
        string,
        { hooks: { type: string; command: string; args: string[]; async: boolean }[] }[]
      >
    }
    expect(Object.keys(manifest.hooks).sort()).toEqual([...HOOKS].sort())
    for (const hook of HOOKS) {
      const matchers = manifest.hooks[hook]
      expect(matchers).toHaveLength(1)
      expect(matchers?.[0]?.hooks).toEqual([
        {
          type: 'command',
          command: 'node',
          args: ['${CLAUDE_PLUGIN_ROOT}/report.mjs'],
          async: true,
        },
      ])
    }
  })

  test('the report has no dependencies: it imports only node built-ins', () => {
    const source = readFileSync(REPORT, 'utf8')
    const imports = [...source.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1])
    expect(imports.length).toBeGreaterThan(0)
    for (const specifier of imports) expect(specifier).toMatch(/^node:/)
  })

  test('the extension packages the plugin directory', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8'),
    ) as {
      files: string[]
    }
    expect(manifest.files).toContain('claude-plugin')
  })
})

describe('the recorded runs, ported from the prototype', () => {
  const runs = readdirSync(FIXTURES)
    .filter((name) => name.endsWith('.events.jsonl'))
    .map((name) => name.replace(/\.events\.jsonl$/, ''))
    .sort()

  test('every run is recorded', () => {
    expect(runs).toEqual([
      'a-headless',
      'b-interactive',
      'c-resume',
      'd-hup-working',
      'e-sigkill',
      'f-stopfailure3',
      'g-auto-worktree',
      'h-auto',
      'i-interrupt',
    ])
  })

  test.each(runs)('%s: every line has the shape the Cockpit decodes', (run) => {
    const lines = readLines(join(FIXTURES, `${run}.events.jsonl`))
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      expect(Object.keys(line)).toEqual(['ticket', 'hook', 'session', 'detail', 'at', 'payload'])
      expect(line.ticket).toBe('6')
      expect(HOOKS).toContain(line.hook)
      expect(line.session).toMatch(/^[0-9a-f-]{36}$/)
      expect(isIsoTime(line.at)).toBe(true)
      expect(line.payload?.hook_event_name).toBe(line.hook)
      expect(line.payload?.session_id).toBe(line.session)
      const expectedDetail =
        line.hook === 'SessionStart'
          ? line.payload?.source
          : line.hook === 'SessionEnd'
            ? line.payload?.reason
            : line.payload?.error
      expect(line.detail).toBe(expectedDetail)
    }
  })

  test.each(runs)(
    '%s: the report reproduces the recorded lines from the recorded payloads',
    (run) => {
      const dir = mkdtempSync(join(tmpdir(), 'hero-synergy-status-'))
      try {
        const events = join(dir, 'events.jsonl')
        writeFileSync(events, '')
        const payloads = readProbe(join(FIXTURES, `${run}.payloads.jsonl`))
        for (const record of payloads) {
          const result = report({ events, ticket: '6', stdin: JSON.stringify(record.input) })
          expect(result.status).toBe(0)
        }
        const strip = (event: StatusEvent) => ({ ...event, at: undefined })
        const written = readLines(events).map(strip)
        const recorded = readLines(join(FIXTURES, `${run}.events.jsonl`)).map(strip)
        expect(written).toEqual(recorded)
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    },
  )

  test('the details seen across the runs are the ones the Cockpit maps', () => {
    const details = new Map<string, Set<string>>()
    for (const run of runs) {
      for (const line of readLines(join(FIXTURES, `${run}.events.jsonl`))) {
        if (!details.has(line.hook ?? '')) details.set(line.hook ?? '', new Set())
        details.get(line.hook ?? '')?.add(line.detail ?? 'null')
      }
    }
    expect([...(details.get('SessionStart') ?? [])].sort()).toEqual([
      'clear',
      'compact',
      'resume',
      'startup',
    ])
    expect([...(details.get('SessionEnd') ?? [])].sort()).toEqual([
      'clear',
      'other',
      'prompt_input_exit',
    ])
    expect([...(details.get('StopFailure') ?? [])]).toEqual(['model_not_found'])
  })

  test('a session that was killed with SIGKILL has a start and no end', () => {
    const hooks = readLines(join(FIXTURES, 'e-sigkill.events.jsonl')).map((e) => e.hook)
    expect(hooks).toEqual(['SessionStart'])
  })

  test('/clear ends one session id and starts another in the same run', () => {
    const lines = readLines(join(FIXTURES, 'b-interactive.events.jsonl'))
    const clearEnd = lines.find((e) => e.hook === 'SessionEnd' && e.detail === 'clear')
    const clearStart = lines.find((e) => e.hook === 'SessionStart' && e.detail === 'clear')
    expect(clearEnd?.session).toBeDefined()
    expect(clearStart?.session).toBeDefined()
    expect(clearStart?.session).not.toBe(clearEnd?.session)
  })
})
