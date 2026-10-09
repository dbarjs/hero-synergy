/**
 * Checks files derived from a private corpus for words that could leak it.
 *
 *   node leak-check.ts --corpus <dir> [--dict <file>] [--safe <dir-or-file>]... <artifact>...
 *
 * A word of an artifact LEAKS when the corpus uses it and nothing safe does: it is not a
 * lower-case dictionary word (`/usr/share/dict/american-english`, from Debian's `wamerican`),
 * not in `reviewed-words.txt` and not in a safe source. The safe sources default to the
 * repo's public text: `CONTEXT.md`, `README.md`, `docs/` and `packages/`, minus this mirror.
 * Words are runs of letters (accents included), split at camelCase, lower-cased, three
 * letters or more.
 *
 * Also reported for review, never failing on their own: corpus words that pass only because
 * a safe source holds them, and six-word sequences shared verbatim with the corpus. A URL off
 * GitHub's hero-synergy and skills repos, aihero.dev and the mirror's placeholder fails.
 * Exits 1 when anything leaks.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const N_GRAM = 6
const ALLOWED_URL =
  /^https:\/\/(?:github\.com\/(?:dbarjs\/hero-synergy|mattpocock\/skills)\b|(?:www\.)?aihero\.dev\b|example\.com\/$)/
const SKIPPED = new Set(['.git', 'node_modules', 'dist', 'worktrees', '.scratch', 'scratch-mirror'])
const TOOLS = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(TOOLS, '../../../../..')

/** The words of a text as the check compares them. */
export function words(text: string): string[] {
  const out: string[] = []
  for (const token of text.match(/[\p{L}\p{M}]+/gu) ?? []) {
    const parts = token.match(/\p{Lu}?\p{Ll}+|\p{Lu}+(?!\p{Ll})/gu) ?? [token]
    if (parts.length > 1) out.push(token.toLowerCase())
    out.push(...parts.map((part) => part.toLowerCase()))
  }
  return out.filter((word) => word.length >= 3)
}

const sequence = (text: string): string[] =>
  (text.match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).map((token) => token.toLowerCase())

const readText = (path: string): string | null => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path))
  } catch {
    return null
  }
}

function* textsUnder(path: string): Generator<string> {
  if (statSync(path).isFile()) {
    const text = readText(path)
    if (text !== null) yield text
    return
  }
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (SKIPPED.has(entry.name)) continue
    const full = join(path, entry.name)
    if (entry.isDirectory()) yield* textsUnder(full)
    else if (entry.isFile() && statSync(full).size <= 2_000_000) {
      const text = readText(full)
      if (text !== null) yield text
    }
  }
}

export interface Report {
  readonly artifact: string
  readonly leaks: ReadonlyArray<string>
  readonly review: ReadonlyArray<string>
  readonly shared: ReadonlyArray<string>
  readonly outside: ReadonlyArray<string>
}

export interface Sources {
  readonly corpus: ReadonlyArray<string>
  readonly dictionary: ReadonlyArray<string>
  readonly safe: ReadonlyArray<string>
}

/** Checks each artifact text against the corpus, the dictionary and the safe texts. */
export function check(sources: Sources, artifacts: ReadonlyArray<[string, string]>): Report[] {
  const corpusWords = new Set<string>()
  const corpusGrams = new Set<string>()
  for (const text of sources.corpus) {
    for (const word of words(text)) corpusWords.add(word)
    const tokens = sequence(text)
    for (let index = 0; index + N_GRAM <= tokens.length; index++) {
      corpusGrams.add(tokens.slice(index, index + N_GRAM).join(' '))
    }
  }
  const dictionary = new Set(
    sources.dictionary.flatMap((text) =>
      text
        .split('\n')
        .map((line) => line.trim())
        .filter((entry) => entry !== '' && entry === entry.toLowerCase() && !entry.includes("'")),
    ),
  )
  const safeWords = new Set(sources.safe.flatMap(words))

  return artifacts.map(([artifact, text]) => {
    const found = new Set(words(text))
    const corpusOnly = [...found].filter((word) => corpusWords.has(word) && !dictionary.has(word))
    const tokens = sequence(text)
    const shared = new Set<string>()
    for (let index = 0; index + N_GRAM <= tokens.length; index++) {
      const gram = tokens.slice(index, index + N_GRAM).join(' ')
      if (corpusGrams.has(gram)) shared.add(gram)
    }
    const urls = text.match(/https?:\/\/[^\s)>\]`'"]+/g) ?? []
    return {
      artifact,
      leaks: corpusOnly.filter((word) => !safeWords.has(word)).sort(),
      review: corpusOnly.filter((word) => safeWords.has(word)).sort(),
      shared: [...shared],
      outside: [...new Set(urls.filter((url) => !ALLOWED_URL.test(url)))].sort(),
    }
  })
}

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      corpus: { type: 'string' },
      dict: { type: 'string', default: '/usr/share/dict/american-english' },
      safe: { type: 'string', multiple: true },
      quiet: { type: 'boolean', default: false },
    },
  })
  if (values.corpus === undefined || positionals.length === 0) {
    throw new Error(
      'usage: leak-check.ts --corpus <dir> [--dict <file>] [--safe <path>]... <artifact>...',
    )
  }
  const safe =
    values.safe ?? ['CONTEXT.md', 'README.md', 'docs', 'packages'].map((path) => join(REPO, path))
  const reports = check(
    {
      corpus: [...textsUnder(values.corpus)],
      dictionary: [readFileSync(values.dict, 'utf8')],
      safe: [
        ...safe.flatMap((path) => [...textsUnder(path)]),
        readFileSync(join(TOOLS, 'reviewed-words.txt'), 'utf8'),
      ],
    },
    positionals.flatMap((path) => {
      const text = readText(path)
      if (text === null) console.log(`== ${path}: unreadable or not UTF-8`)
      return text === null ? [] : [[path, text] as [string, string]]
    }),
  )
  let failed = reports.length !== positionals.length
  const review = new Set<string>()
  let shared = 0
  for (const report of reports) {
    report.review.forEach((word) => review.add(word))
    shared += report.shared.length
    if (report.leaks.length > 0 || report.outside.length > 0) failed = true
    if (values.quiet && report.leaks.length === 0 && report.outside.length === 0) continue
    console.log(`== ${report.artifact}`)
    console.log(`   LEAK (${report.leaks.length}): ${report.leaks.join(', ') || '-'}`)
    console.log(
      `   URL outside allowed hosts (${report.outside.length}): ${report.outside.join(', ') || '-'}`,
    )
    if (!values.quiet) {
      console.log(`   six-word sequences shared with the corpus (${report.shared.length}):`)
      for (const gram of report.shared.slice(0, 80)) console.log(`     ${gram}`)
    }
  }
  const leaking = reports.filter((report) => report.leaks.length > 0 || report.outside.length > 0)
  console.log(
    `${reports.length} artifacts checked, ${leaking.length} leaking; ` +
      `${shared} shared six-word sequences; safe only by a public source: ${[...review].sort().join(', ') || '-'}`,
  )
  process.exitCode = failed ? 1 : 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
