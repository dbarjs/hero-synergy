import { spawn } from 'node:child_process'
import { Context, Data, Duration, Effect, Layer } from 'effect'

/**
 * What to run. The command is spawned directly, never through a shell, so
 * arguments reach the process exactly as given (the Windows research forbids a
 * shell between the Cockpit and `claude`).
 */
export interface ProcessRequest {
  /** The executable: a name resolved on `PATH` or a full path. */
  readonly command: string
  readonly args: ReadonlyArray<string>
  /** Working directory; the current process's when absent. */
  readonly cwd?: string
  /** Variables laid over the current environment. */
  readonly env?: Readonly<Record<string, string>>
  /** Written to the child's stdin, which is closed either way. */
  readonly stdin?: string
  /** How long the process may run before it is killed. Default: {@link defaultTimeout}. */
  readonly timeout?: Duration.Input
}

/** What a process produced, whatever its exit code. */
export interface ProcessResult {
  readonly stdout: string
  readonly stderr: string
  /** `null` when the process was killed before it exited, which is what a timeout does. */
  readonly exitCode: number | null
  readonly timedOut: boolean
}

/** A command, its arguments and what it produced: the shape of a fixture file. */
export interface ProcessRecording {
  readonly command: string
  readonly args: ReadonlyArray<string>
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number | null
  readonly timedOut?: boolean
}

/** The process never started: the command is missing from `PATH`, the directory does not exist. */
export class ProcessSpawnFailed extends Data.TaggedError('ProcessSpawnFailed')<{
  readonly command: string
  readonly args: ReadonlyArray<string>
  readonly message: string
}> {}

/** The replay layer holds no recording for this command and arguments. */
export class ProcessNotRecorded extends Data.TaggedError('ProcessNotRecorded')<{
  readonly command: string
  readonly args: ReadonlyArray<string>
  /** Every recorded command line, for the test that named the wrong fixture. */
  readonly recorded: ReadonlyArray<string>
  readonly message: string
}> {}

export type ProcessError = ProcessSpawnFailed | ProcessNotRecorded

export interface ProcessRunnerShape {
  readonly run: (request: ProcessRequest) => Effect.Effect<ProcessResult, ProcessError>
}

/** A process is killed when it has run this long and the request set no timeout. */
export const defaultTimeout: Duration.Duration = Duration.seconds(30)

/** After `SIGTERM` on a timeout, a process that is still alive gets `SIGKILL` this much later. */
const killGrace = Duration.seconds(2)

/**
 * Runs `gh`, `claude` and read-only `git` for the Cockpit.
 *
 * `live` spawns real processes. `replay` answers from recordings instead, so a
 * test names the fixture it expects and never touches the machine.
 */
export class ProcessRunner extends Context.Service<ProcessRunner, ProcessRunnerShape>()(
  '@hero-synergy/core/ProcessRunner',
) {
  static readonly live: Layer.Layer<ProcessRunner> = Layer.succeed(ProcessRunner, { run: runLive })

  static readonly replay: (
    recordings: ReadonlyArray<ProcessRecording>,
  ) => Layer.Layer<ProcessRunner> = replayLayer
}

/** Pairs a request with its result in the shape a fixture file stores. */
export function toRecording(request: ProcessRequest, result: ProcessResult): ProcessRecording {
  return {
    command: request.command,
    args: request.args,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    ...(result.timedOut ? { timedOut: true } : {}),
  }
}

function runLive(request: ProcessRequest): Effect.Effect<ProcessResult, ProcessSpawnFailed> {
  return Effect.callback<ProcessResult, ProcessSpawnFailed>((resume) => {
    const { command, args } = request
    const timeoutMillis = Duration.toMillis(request.timeout ?? defaultTimeout)

    const child = spawn(command, args, {
      cwd: request.cwd,
      env: request.env === undefined ? process.env : { ...process.env, ...request.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false
    let timer: NodeJS.Timeout | undefined
    let killTimer: NodeJS.Timeout | undefined

    const clearTimers = () => {
      clearTimeout(timer)
      clearTimeout(killTimer)
    }
    const settle = (outcome: Effect.Effect<ProcessResult, ProcessSpawnFailed>) => {
      if (settled) return
      settled = true
      clearTimers()
      resume(outcome)
    }

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    // A child that never started rejects the stdin write; the `error` event below carries the cause.
    child.stdin.on('error', () => {})

    child.on('error', (error) => {
      settle(Effect.fail(new ProcessSpawnFailed({ command, args, message: error.message })))
    })
    child.on('close', (code) => {
      settle(Effect.succeed({ stdout, stderr, exitCode: code, timedOut }))
    })

    // `setTimeout(Infinity)` fires at once, so an infinite timeout sets no timer.
    if (Number.isFinite(timeoutMillis)) {
      timer = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')
        killTimer = setTimeout(() => child.kill('SIGKILL'), Duration.toMillis(killGrace))
      }, timeoutMillis)
    }

    child.stdin.end(request.stdin ?? '')

    return Effect.sync(() => {
      clearTimers()
      child.kill('SIGKILL')
    })
  })
}

const commandLine = (command: string, args: ReadonlyArray<string>): string =>
  [command, ...args].join(' ')

const recordingKey = (command: string, args: ReadonlyArray<string>): string =>
  JSON.stringify([command, ...args])

function replayLayer(recordings: ReadonlyArray<ProcessRecording>): Layer.Layer<ProcessRunner> {
  const byKey = new Map(
    recordings.map((recording) => [recordingKey(recording.command, recording.args), recording]),
  )
  const recorded = recordings.map((recording) => commandLine(recording.command, recording.args))

  return Layer.succeed(ProcessRunner, {
    run: ({ command, args }) => {
      const recording = byKey.get(recordingKey(command, args))
      if (recording === undefined) {
        return Effect.fail(
          new ProcessNotRecorded({
            command,
            args,
            recorded,
            message: `No recording for \`${commandLine(command, args)}\`; recorded: ${
              recorded.length === 0 ? 'nothing' : recorded.map((line) => `\`${line}\``).join(', ')
            }`,
          }),
        )
      }
      return Effect.succeed({
        stdout: recording.stdout,
        stderr: recording.stderr,
        exitCode: recording.exitCode,
        timedOut: recording.timedOut ?? false,
      })
    },
  })
}
