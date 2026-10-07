import {
  decodeSnapshot,
  encodeSnapshot,
  type Snapshot,
  snapshotSchemaVersion,
  type SnapshotJson,
} from '@hero-synergy/core'

/** The key the cache is stored under in workspace storage. */
export const CACHE_KEY = 'snapshot-cache'

/** `github` or `local`, and who the repo is: `owner/name` or the repo root path. */
export interface RepoIdentity {
  readonly kind: 'github' | 'local'
  readonly identity: string
}

export const identityOf = (snapshot: Snapshot): RepoIdentity =>
  snapshot.tracker.kind === 'github'
    ? { kind: 'github', identity: `${snapshot.tracker.owner}/${snapshot.tracker.repo}` }
    : { kind: 'local', identity: snapshot.repoRoot }

/** One entry per repo and schema version. */
export const cacheKeyOf = ({ kind, identity }: RepoIdentity, version: number): string =>
  `${kind}|${identity}|v${version}`

interface Entry {
  readonly version: number
  readonly kind: 'github' | 'local'
  readonly identity: string
  /** The collect time the snapshot carries. */
  readonly collectedAt: string
  readonly snapshot: SnapshotJson
}

interface Stored {
  /** The entry the window's folders last resolved to, so activation finds it without spawning `git`. */
  readonly last: { readonly folders: ReadonlyArray<string>; readonly key: string } | null
  readonly entries: Readonly<Record<string, Entry>>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const stored = (raw: unknown): Stored => {
  if (!isRecord(raw) || !isRecord(raw.entries)) return { last: null, entries: {} }
  const last = raw.last
  return {
    last:
      isRecord(last) &&
      typeof last.key === 'string' &&
      Array.isArray(last.folders) &&
      last.folders.every((folder): folder is string => typeof folder === 'string')
        ? { folders: last.folders, key: last.key }
        : null,
    entries: raw.entries as Record<string, Entry>,
  }
}

export interface Cached {
  readonly key: string
  readonly repo: RepoIdentity
  readonly snapshot: Snapshot
}

/**
 * The snapshot the window's folders last resolved to, or null: nothing stored,
 * a cache written under another schema version, or one that does not decode.
 * An ignored entry is never an error; the next collect replaces it.
 */
export const readCache = (raw: unknown, folders: ReadonlyArray<string>): Cached | null => {
  const { last, entries } = stored(raw)
  if (last === null) return null
  if (last.folders.length !== folders.length || last.folders.some((f, i) => f !== folders[i])) {
    return null
  }
  const entry = entries[last.key]
  if (!isRecord(entry) || entry.version !== snapshotSchemaVersion) return null
  try {
    const snapshot = decodeSnapshot(entry.snapshot)
    const repo = identityOf(snapshot)
    // The key must name the repo the snapshot is of, so a moved or edited entry is not trusted.
    return cacheKeyOf(repo, snapshotSchemaVersion) === last.key
      ? { key: last.key, repo, snapshot }
      : null
  } catch {
    return null
  }
}

/** The stored value after a successful collect: this repo's entry replaced, other repos' entries of the current version kept. */
export const writeCache = (
  raw: unknown,
  folders: ReadonlyArray<string>,
  snapshot: Snapshot,
): unknown => {
  const repo = identityOf(snapshot)
  const key = cacheKeyOf(repo, snapshotSchemaVersion)
  const kept = Object.fromEntries(
    Object.entries(stored(raw).entries).filter(
      ([, entry]) => isRecord(entry) && entry.version === snapshotSchemaVersion,
    ),
  )
  const next: Stored = {
    last: { folders: [...folders], key },
    entries: {
      ...kept,
      [key]: {
        version: snapshotSchemaVersion,
        kind: repo.kind,
        identity: repo.identity,
        collectedAt: snapshot.collectedAt,
        snapshot: encodeSnapshot(snapshot),
      },
    },
  }
  return next
}
