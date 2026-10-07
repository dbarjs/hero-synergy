import { Effect } from 'effect'

/**
 * Where `claude` is: the setting when it names a location, else the first match on
 * `PATH`. Windows prefers `claude.exe`, which can be the terminal's own process;
 * an npm `claude.cmd` shim is best effort, found only when no `.exe` is on `PATH`.
 */

export interface ResolveClaudeInput {
  /** `heroSynergy.claude.path`; empty or blank means resolve on `PATH`. */
  readonly setting: string
  /** The `PATH` variable, or an empty string when the host has none. */
  readonly pathVariable: string
  /** `process.platform`. */
  readonly platform: string
  /** Whether a file is at this path. */
  readonly isFile: (path: string) => Effect.Effect<boolean>
}

export interface ResolvedClaude {
  readonly path: string
  readonly source: 'setting' | 'path'
  /** An npm shim rather than the binary: it may need a shell, so it only works best effort. */
  readonly shim: boolean
}

export type ClaudeResolution =
  | { readonly kind: 'found'; readonly claude: ResolvedClaude }
  | { readonly kind: 'missing'; readonly reason: string }

const isWindows = (platform: string): boolean => platform === 'win32'

const joinPath = (platform: string, directory: string, name: string): string => {
  const separator = isWindows(platform) ? '\\' : '/'
  return directory.endsWith(separator) ? `${directory}${name}` : `${directory}${separator}${name}`
}

const isShim = (path: string): boolean => /\.(cmd|bat)$/i.test(path)

export const resolveClaude = (input: ResolveClaudeInput): Effect.Effect<ClaudeResolution> =>
  Effect.gen(function* () {
    const setting = input.setting.trim()
    if (setting !== '') {
      if (yield* input.isFile(setting)) {
        return {
          kind: 'found',
          claude: { path: setting, source: 'setting', shim: isShim(setting) },
        } satisfies ClaudeResolution
      }
      return {
        kind: 'missing',
        reason: `heroSynergy.claude.path names ${setting}, which is not a file.`,
      } satisfies ClaudeResolution
    }

    const windows = isWindows(input.platform)
    const delimiter = windows ? ';' : ':'
    const directories = input.pathVariable
      .split(delimiter)
      .map((directory) => (windows ? directory.replace(/^"|"$/g, '') : directory).trim())
      .filter((directory) => directory !== '')
    // `.exe` across the whole PATH first, so a shim early on PATH never beats the binary.
    const names = windows ? ['claude.exe', 'claude.cmd'] : ['claude']
    for (const name of names) {
      for (const directory of directories) {
        const candidate = joinPath(input.platform, directory, name)
        if (yield* input.isFile(candidate)) {
          return {
            kind: 'found',
            claude: { path: candidate, source: 'path', shim: isShim(candidate) },
          } satisfies ClaudeResolution
        }
      }
    }
    return {
      kind: 'missing',
      reason: 'claude was not found on PATH. Set heroSynergy.claude.path to its location.',
    } satisfies ClaudeResolution
  })
