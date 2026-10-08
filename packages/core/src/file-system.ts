import { mkdir, open, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import posix from 'node:path/posix'
import { Context, Data, Effect, Layer } from 'effect'

export type FileSystemOperation = 'readFile' | 'readFrom' | 'writeFile' | 'exists' | 'readDirectory'

export type FileSystemErrorCode =
  | 'NotFound'
  | 'IsADirectory'
  | 'NotADirectory'
  | 'PermissionDenied'
  | 'Other'

export class FileSystemError extends Data.TaggedError('FileSystemError')<{
  readonly operation: FileSystemOperation
  readonly path: string
  readonly code: FileSystemErrorCode
  readonly message: string
}> {}

export interface FileSystemShape {
  /** The file's content as UTF-8 text. */
  readonly readFile: (path: string) => Effect.Effect<string, FileSystemError>
  /**
   * The file's bytes from `offset` to the end, as UTF-8 text, with the file's whole size in bytes.
   * An offset past the end gives no text, so a caller sees a file that shrank by `size < offset`.
   * A multi-byte character cut by `offset` or by the end reads as U+FFFD.
   */
  readonly readFrom: (
    path: string,
    offset: number,
  ) => Effect.Effect<{ readonly text: string; readonly size: number }, FileSystemError>
  /** Writes UTF-8 text, replacing the file and creating missing parent directories. */
  readonly writeFile: (path: string, content: string) => Effect.Effect<void, FileSystemError>
  /** Whether a file or directory is at the path. */
  readonly exists: (path: string) => Effect.Effect<boolean, FileSystemError>
  /** The names (not paths) of the directory's entries, sorted. */
  readonly readDirectory: (path: string) => Effect.Effect<ReadonlyArray<string>, FileSystemError>
}

/**
 * The files the Cockpit reads and writes: skill directories, a local tracker,
 * the scout's cache. `live` is the real disk; `inMemory` is a map a test seeds,
 * speaking POSIX paths.
 */
export class FileSystem extends Context.Service<FileSystem, FileSystemShape>()(
  '@hero-synergy/core/FileSystem',
) {
  static readonly live: Layer.Layer<FileSystem> = Layer.succeed(FileSystem, liveFileSystem())

  static readonly inMemory: (files?: Readonly<Record<string, string>>) => Layer.Layer<FileSystem> =
    inMemoryLayer
}

const codeOf = (error: unknown): FileSystemErrorCode => {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  switch (code) {
    case 'ENOENT':
      return 'NotFound'
    case 'EISDIR':
      return 'IsADirectory'
    case 'ENOTDIR':
      return 'NotADirectory'
    case 'EACCES':
    case 'EPERM':
      return 'PermissionDenied'
    default:
      return 'Other'
  }
}

const liveError =
  (operation: FileSystemOperation, path: string) =>
  (error: unknown): FileSystemError =>
    new FileSystemError({
      operation,
      path,
      code: codeOf(error),
      message: error instanceof Error ? error.message : String(error),
    })

function liveFileSystem(): FileSystemShape {
  return {
    readFile: (path) =>
      Effect.tryPromise({
        try: () => readFile(path, 'utf8'),
        catch: liveError('readFile', path),
      }),
    readFrom: (path, offset) =>
      Effect.tryPromise({
        try: async () => {
          const handle = await open(path, 'r')
          try {
            const { size } = await handle.stat()
            if (offset >= size) return { text: '', size }
            const buffer = Buffer.alloc(size - offset)
            const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset)
            return { text: buffer.subarray(0, bytesRead).toString('utf8'), size }
          } finally {
            await handle.close()
          }
        },
        catch: liveError('readFrom', path),
      }),
    writeFile: (path, content) =>
      Effect.tryPromise({
        try: async () => {
          await mkdir(dirname(path), { recursive: true })
          await writeFile(path, content, 'utf8')
        },
        catch: liveError('writeFile', path),
      }),
    exists: (path) =>
      Effect.tryPromise({
        try: () =>
          stat(path).then(
            () => true,
            (error: unknown) => {
              if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') return false
              throw error
            },
          ),
        catch: liveError('exists', path),
      }),
    readDirectory: (path) =>
      Effect.tryPromise({
        try: () => readdir(path).then((names) => [...names].sort()),
        catch: liveError('readDirectory', path),
      }),
  }
}

const normalize = (path: string): string => {
  const normalized = posix.normalize(path)
  return normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
}

const childPrefix = (directory: string): string => (directory === '/' ? '/' : `${directory}/`)

const ancestors = function* (path: string): Generator<string> {
  let current = posix.dirname(path)
  while (current !== path && current !== '.' && current !== '/') {
    yield current
    path = current
    current = posix.dirname(current)
  }
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function inMemoryLayer(files: Readonly<Record<string, string>> = {}): Layer.Layer<FileSystem> {
  return Layer.sync(FileSystem, () => {
    const store = new Map<string, string>()
    for (const [path, content] of Object.entries(files)) store.set(normalize(path), content)

    const isDirectory = (path: string): boolean => {
      const prefix = childPrefix(path)
      for (const key of store.keys()) if (key.startsWith(prefix)) return true
      return false
    }

    const fail = (
      operation: FileSystemOperation,
      path: string,
      code: FileSystemErrorCode,
      message: string,
    ) => Effect.fail(new FileSystemError({ operation, path, code, message }))

    return {
      readFile: (path) =>
        Effect.suspend(() => {
          const key = normalize(path)
          const content = store.get(key)
          if (content !== undefined) return Effect.succeed(content)
          return isDirectory(key)
            ? fail('readFile', path, 'IsADirectory', `${path} is a directory`)
            : fail('readFile', path, 'NotFound', `${path} does not exist`)
        }),
      readFrom: (path, offset) =>
        Effect.suspend(() => {
          const key = normalize(path)
          const content = store.get(key)
          if (content === undefined) {
            return isDirectory(key)
              ? fail('readFrom', path, 'IsADirectory', `${path} is a directory`)
              : fail('readFrom', path, 'NotFound', `${path} does not exist`)
          }
          const bytes = encoder.encode(content)
          return Effect.succeed({
            text: offset >= bytes.length ? '' : decoder.decode(bytes.subarray(offset)),
            size: bytes.length,
          })
        }),
      writeFile: (path, content) =>
        Effect.suspend(() => {
          const key = normalize(path)
          if (isDirectory(key))
            return fail('writeFile', path, 'IsADirectory', `${path} is a directory`)
          for (const ancestor of ancestors(key)) {
            if (store.has(ancestor))
              return fail('writeFile', path, 'NotADirectory', `${ancestor} is a file`)
          }
          store.set(key, content)
          return Effect.void
        }),
      exists: (path) =>
        Effect.sync(() => {
          const key = normalize(path)
          return store.has(key) || isDirectory(key)
        }),
      readDirectory: (path) =>
        Effect.suspend(() => {
          const key = normalize(path)
          if (store.has(key))
            return fail('readDirectory', path, 'NotADirectory', `${path} is a file`)
          if (!isDirectory(key))
            return fail('readDirectory', path, 'NotFound', `${path} does not exist`)
          const prefix = childPrefix(key)
          const names = new Set<string>()
          for (const entry of store.keys()) {
            if (!entry.startsWith(prefix)) continue
            const [name] = entry.slice(prefix.length).split('/')
            if (name !== undefined && name !== '') names.add(name)
          }
          return Effect.succeed([...names].sort())
        }),
    }
  })
}
