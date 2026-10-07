// Prints the body of the GitHub release for the extension's current version: its changelog entry,
// an install line and a compare link. `--title` prints the release title instead.
//
//   node scripts/release-notes.ts > notes.md
//   node scripts/release-notes.ts --title
//
// Runs on Node's built-in type stripping, so it uses only erasable TypeScript. The `PUBLISH_*`
// variables decide which registry links the install line carries; core's changelog is never linked.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const REPO = 'dbarjs/hero-synergy'
const EXTENSION_DIR = 'packages/vscode'

export interface Manifest {
  name: string
  version: string
  publisher: string
}

export interface Registries {
  marketplace: boolean
  openVsx: boolean
}

export const releaseTitle = (version: string): string => `hero-synergy v${version}`

/**
 * The `## <version>` entry of a Changesets changelog, without its `Updated dependencies` items.
 * Fixed versioning writes those for every package that moved only because another one did; they
 * are noise to the person updating.
 */
export function changelogEntry(changelog: string, version: string): string {
  const lines = changelog.split('\n')
  const start = lines.findIndex((line) => line.trim() === `## ${version}`)
  if (start === -1) return ''
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '))
  const groups: { heading: string; lines: string[] }[] = []
  let skipping = false
  for (const line of lines.slice(start + 1, end === -1 ? undefined : end)) {
    if (line.startsWith('### ')) {
      groups.push({ heading: line, lines: [] })
      skipping = false
      continue
    }
    // An item and everything indented under it go together.
    if (line.startsWith('- ')) skipping = line.startsWith('- Updated dependencies')
    if (!skipping) groups.at(-1)?.lines.push(line)
  }
  return groups
    .filter((group) => group.lines.some((line) => line.trim() !== ''))
    .map((group) => [group.heading, ...group.lines].join('\n').trim())
    .join('\n\n')
}

/** The newest `v*` tag that is not the release's own, from the tags in any order. */
export function previousTag(tags: string[], tag: string): string | undefined {
  const parse = (name: string) => /^v(\d+)\.(\d+)\.(\d+)$/.exec(name)?.slice(1).map(Number)
  return tags
    .filter((name) => name !== tag && parse(name) !== undefined)
    .sort((a, b) => {
      const [pa, pb] = [parse(a)!, parse(b)!]
      return pb[0]! - pa[0]! || pb[1]! - pa[1]! || pb[2]! - pa[2]!
    })[0]
}

export function releaseNotes(input: {
  manifest: Manifest
  changelog: string
  registries: Registries
  tags: string[]
}): string {
  const { manifest, changelog, registries, tags } = input
  const tag = `v${manifest.version}`
  const install = [
    registries.marketplace &&
      `[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=${manifest.publisher}.${manifest.name})`,
    registries.openVsx &&
      `[Open VSX](https://open-vsx.org/extension/${manifest.publisher}/${manifest.name})`,
    'the `.vsix` attached below',
  ].filter((part) => part !== false)
  const previous = previousTag(tags, tag)
  return [
    changelogEntry(changelog, manifest.version),
    `**Install:** ${install.join(' · ')}`,
    previous && `**Full changelog:** https://github.com/${REPO}/compare/${previous}...${tag}`,
  ]
    .filter((part) => part)
    .join('\n\n')
}

function main() {
  const manifest: Manifest = JSON.parse(readFileSync(`${EXTENSION_DIR}/package.json`, 'utf8'))
  if (process.argv.includes('--title')) {
    console.log(releaseTitle(manifest.version))
    return
  }
  const file = `${EXTENSION_DIR}/CHANGELOG.md`
  const tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' }).split('\n')
  console.log(
    releaseNotes({
      manifest,
      changelog: existsSync(file) ? readFileSync(file, 'utf8') : '',
      registries: {
        marketplace: process.env.PUBLISH_MARKETPLACE === 'true',
        openVsx: process.env.PUBLISH_OPEN_VSX === 'true',
      },
      tags,
    }),
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
