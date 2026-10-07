import { execFile } from 'node:child_process'

export interface Ran {
  readonly stdout: string
  readonly stderr: string
  /** `null` when the process never started or was killed. */
  readonly code: number | null
}

/** Runs a command to the end, whatever it exits with; never through a shell. */
export function run(
  command: string,
  args: ReadonlyArray<string>,
  options: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<Ran> {
  return new Promise((resolve) => {
    execFile(
      command,
      [...args],
      {
        cwd: options.cwd,
        env: options.env,
        timeout: options.timeoutMs ?? 120_000,
        maxBuffer: 64 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const code = error === null ? 0 : typeof error.code === 'number' ? error.code : null
        resolve({
          stdout,
          stderr: error !== null && code === null ? `${stderr}${error.message}` : stderr,
          code,
        })
      },
    )
  })
}

export const transcript = (command: string, args: ReadonlyArray<string>, ran: Ran): string =>
  `$ ${[command, ...args].join(' ')}\n${ran.stdout}${ran.stderr}[exit ${ran.code}]\n`
