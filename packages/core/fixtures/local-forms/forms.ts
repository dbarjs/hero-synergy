import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const FIXTURE = dirname(fileURLToPath(import.meta.url))

/**
 * Where a closed ticket's resolution sits, the placements the survey of map #130 catalogued:
 * `## Answer`, three Resolution labels (#138), and two kinds of last comment under `## Comments`.
 */
export type ResolutionPlacement =
  | 'answer'
  | 'resolution'
  | 'comments-resolution'
  | 'bold-paragraph'
  | 'comments-item'
  | 'comments-text'

/** The careful reading of one ticket file: what a reader of the whole file concludes. */
export interface TicketReading {
  /** Null where the reading is unsettled. */
  readonly state: 'open' | 'claimed' | 'closed' | null
  /** The triage role the file names, on its Status line or a `Labels:` line. */
  readonly role:
    | 'needs-triage'
    | 'needs-info'
    | 'ready-for-agent'
    | 'ready-for-human'
    | 'wontfix'
    | null
  /** Who the `Assignee:` line names, before any parenthesis or dash; null for `—`, empty or unclaimed. */
  readonly assignee: string | null
  readonly type: 'research' | 'prototype' | 'grilling' | 'task' | null
  /** The leading `AFK` or `HITL` the type line's parenthesis carries; null when it carries none. */
  readonly mode: 'AFK' | 'HITL' | null
  /** The map the ticket belongs to, as a path from the fixture root; null in an effort without a map. */
  readonly map: string | null
  /** The PRD a `/to-tickets` issue names as its parent. */
  readonly parent: string | null
  /**
   * The tickets this file's own `Blocked by:` line names, closed blockers included; a none marker
   * names none. Edges another file's `Blocks:` line adds are not merged in.
   */
  readonly blockedBy: ReadonlyArray<number>
  /** The tickets this file's own `Blocks:` line names. */
  readonly blocks: ReadonlyArray<number>
  /** A closed ticket's one resolution: where it sits, its first line, and its byline. */
  readonly resolution: {
    readonly placement: ResolutionPlacement
    readonly firstLine: string
    readonly at: string | null
    readonly author: string | null
  } | null
}

/** The careful reading of one map file. */
export interface MapReading {
  /** Null where the reading is unsettled. */
  readonly state: 'open' | 'closed' | null
  /** The ticket numbers its Decisions so far links, in order. */
  readonly decisions: ReadonlyArray<number>
}

interface Common {
  /** The file, from the fixture root: `.scratch/<effort>/…`. */
  readonly path: string
  /** The catalogued form the file stands for. */
  readonly form: string
  /** Fields the careful reading leaves open until #134 settles them; each is null in `reading`. */
  readonly unsettled?: { readonly fields: ReadonlyArray<string>; readonly why: string }
}

export type FormTruth =
  | (Common & { readonly kind: 'ticket'; readonly reading: TicketReading })
  | (Common & { readonly kind: 'map'; readonly reading: MapReading })
  | (Common & { readonly kind: 'note'; readonly reading: null })

export type LocalForm = FormTruth & { readonly body: string }

/** Every Markdown file of the fixture with its truth, in path order. */
export function localForms(): ReadonlyArray<LocalForm> {
  const truth = JSON.parse(readFileSync(join(FIXTURE, 'truth.json'), 'utf8')) as FormTruth[]
  return truth.map((entry) => ({ ...entry, body: readFileSync(join(FIXTURE, entry.path), 'utf8') }))
}

/** The paths of every file under `.scratch`, from the fixture root. */
export function scratchFiles(): ReadonlyArray<string> {
  return readdirSync(join(FIXTURE, '.scratch'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(FIXTURE, join(entry.parentPath, entry.name)).split('\\').join('/'))
    .sort()
}

/** The fixture's `.scratch` as `FileSystem.inMemory` takes it, placed under a made-up repo root. */
export function formsRepo(root: string): Record<string, string> {
  const files: Record<string, string> = {}
  for (const path of scratchFiles())
    files[`${root}/${path}`] = readFileSync(join(FIXTURE, path), 'utf8')
  return files
}
