import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, layer } from '@effect/vitest'
import { Effect } from 'effect'

import claudeVersion from '../fixtures/process/claude-version.json' with { type: 'json' }
import ghVersion from '../fixtures/process/gh-version.json' with { type: 'json' }
import { ProcessRunner, toRecording } from './process-runner.ts'

// The runner spawns whatever executable it is given; Node itself is the one every machine has.
const node = process.execPath
const script = (source: string) => [`-e`, source]

describe('ProcessRunner.live', () => {
  const live = <A, E>(effect: Effect.Effect<A, E, ProcessRunner>) =>
    Effect.provide(effect, ProcessRunner.live)

  it.live('returns stdout, stderr and the exit code, whatever the exit code', () =>
    live(
      Effect.gen(function* () {
        const runner = yield* ProcessRunner
        const result = yield* runner.run({
          command: node,
          args: script('process.stdout.write("out"); process.stderr.write("err"); process.exit(3)'),
        })
        expect(result).toEqual({ stdout: 'out', stderr: 'err', exitCode: 3, timedOut: false })
      }),
    ),
  )

  it.live('feeds stdin to the process and lays the given env over the environment', () =>
    live(
      Effect.gen(function* () {
        const runner = yield* ProcessRunner
        const result = yield* runner.run({
          command: node,
          args: script(
            'let s = ""; process.stdin.on("data", (d) => { s += d }).on("end", () => process.stdout.write(s.toUpperCase() + " " + process.env.HERO_SYNERGY_TEST + " " + (process.env.PATH !== undefined)))',
          ),
          stdin: 'hello',
          env: { HERO_SYNERGY_TEST: 'set' },
        })
        expect(result.stdout).toBe('HELLO set true')
        expect(result.exitCode).toBe(0)
      }),
    ),
  )

  it.live('runs in the given working directory', () =>
    live(
      Effect.gen(function* () {
        const runner = yield* ProcessRunner
        const cwd = resolve(dirname(fileURLToPath(import.meta.url)), '..')
        const result = yield* runner.run({
          command: node,
          args: script('process.stdout.write(process.cwd())'),
          cwd,
        })
        expect(result.stdout).toBe(cwd)
      }),
    ),
  )

  it.live('kills a process after its timeout and still returns what was captured', () =>
    live(
      Effect.gen(function* () {
        const runner = yield* ProcessRunner
        const result = yield* runner.run({
          command: node,
          args: script('process.stdout.write("started"); setTimeout(() => {}, 60_000)'),
          timeout: '300 millis',
        })
        expect(result).toEqual({ stdout: 'started', stderr: '', exitCode: null, timedOut: true })
      }),
    ),
  )

  it.live('fails with ProcessSpawnFailed when the command does not exist', () =>
    live(
      Effect.gen(function* () {
        const runner = yield* ProcessRunner
        const error = yield* Effect.flip(
          runner.run({ command: 'hero-synergy-no-such-command', args: ['--version'] }),
        )
        expect(error._tag).toBe('ProcessSpawnFailed')
        expect(error.message).toContain('ENOENT')
      }),
    ),
  )
})

layer(ProcessRunner.replay([ghVersion, claudeVersion]))('ProcessRunner.replay', (it) => {
  it.effect('serves the recorded fixture for a named command and arguments', () =>
    Effect.gen(function* () {
      const runner = yield* ProcessRunner
      const result = yield* runner.run({ command: 'gh', args: ['--version'] })
      expect(result).toEqual({
        stdout:
          'gh version 2.100.0 (2026-09-03)\nhttps://github.com/cli/cli/releases/tag/v2.100.0\n',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      })
    }),
  )

  it.effect('keys recordings on the exact arguments, so cwd and env do not matter', () =>
    Effect.gen(function* () {
      const runner = yield* ProcessRunner
      const result = yield* runner.run({
        command: 'claude',
        args: ['--version'],
        cwd: '/somewhere/else',
        env: { HOME: '/nobody' },
      })
      expect(result.stdout).toBe('2.1.292 (Claude Code)\n')
    }),
  )

  it.effect('fails with ProcessNotRecorded, naming what is recorded, for anything else', () =>
    Effect.gen(function* () {
      const runner = yield* ProcessRunner
      const error = yield* Effect.flip(runner.run({ command: 'gh', args: ['auth', 'status'] }))
      expect(error._tag).toBe('ProcessNotRecorded')
      if (error._tag !== 'ProcessNotRecorded') return
      expect(error.recorded).toEqual(['gh --version', 'claude --version'])
      expect(error.message).toContain('`gh auth status`')
    }),
  )
})

describe('toRecording', () => {
  it('keeps the command line and what it produced, in the fixture shape', () => {
    const recording = toRecording(
      { command: 'gh', args: ['--version'], cwd: '/repo', timeout: '5 seconds' },
      { stdout: 'gh version 2.100.0\n', stderr: '', exitCode: 0, timedOut: false },
    )
    expect(recording).toEqual({
      command: 'gh',
      args: ['--version'],
      stdout: 'gh version 2.100.0\n',
      stderr: '',
      exitCode: 0,
    })
  })

  it('marks a timed-out run', () => {
    const recording = toRecording(
      { command: 'claude', args: ['agents', '--json'] },
      { stdout: '', stderr: '', exitCode: null, timedOut: true },
    )
    expect(recording.timedOut).toBe(true)
    expect(recording.exitCode).toBeNull()
  })
})
