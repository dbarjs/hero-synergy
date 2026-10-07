import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { pluginNameOf, readPluginManifest, readSkillFrontmatter } from '@hero-synergy/core'

import { run } from './exec.ts'
import type { Failure, Report } from './report.ts'

/** The skills the Cockpit spawns by name, in every manifest from 1.1.0. */
const spawnedSkills = [
  'wayfinder',
  'to-spec',
  'to-tickets',
  'implement',
  'setup-matt-pocock-skills',
]

const mapHeadings = [
  '## Destination',
  '## Notes',
  '## Decisions so far',
  '## Not yet specified',
  '## Out of scope',
]
/** How the skill names the labels: `wayfinder:map`, and `wayfinder:<type>` with the four types listed. */
const labelNeedles = [
  { name: 'wayfinder:map', needle: '`wayfinder:map`' },
  { name: 'wayfinder:<type>', needle: '`wayfinder:<type>`' },
  ...['research', 'prototype', 'grilling', 'task'].map((type) => ({
    name: `ticket type ${type}`,
    needle: `\`${type}\``,
  })),
]
/** What the scout reads of the GitHub tracker template, one needle per operation. */
const trackerNeedles = [
  '# Issue tracker: GitHub',
  '## Wayfinding operations',
  '--add-assignee @me',
  'dependencies/blocked_by',
  'sub-issue',
  'Blocked by:',
  'Part of #',
]

const row = (what: string): string => `What the scout reads › ${what}`

async function findFiles(root: string, name: string): Promise<string[]> {
  const found: string[] = []
  const walk = async (dir: string): Promise<void> => {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.name === name) found.push(full)
    }
  }
  await walk(root)
  return found.sort()
}

const read = (file: string): Promise<string> => readFile(file, 'utf8')

/**
 * One copy of mattpocock-skills against what the Cockpit reads: every `SKILL.md` frontmatter
 * decodes, the manifest lists the skills the Cockpit spawns, and the wayfinder skill and the
 * GitHub tracker template still carry the headings, labels and operations the scout reads.
 * Skills and text added later never fail anything.
 */
export async function checkSkillsCopy(label: string, dir: string): Promise<Failure[]> {
  const failures: Failure[] = []
  const fail = (contract: string, rowText: string, error: string): void => {
    failures.push({ contract: `${label}: ${contract}`, row: rowText, error })
  }

  const skillFiles = await findFiles(path.join(dir, 'skills'), 'SKILL.md')
  if (skillFiles.length === 0)
    fail('SKILL.md', row('skill frontmatter'), `no SKILL.md under ${dir}/skills`)
  for (const file of skillFiles) {
    const decoded = readSkillFrontmatter(await read(file))
    for (const warning of decoded.warnings) {
      fail(
        'SKILL.md frontmatter',
        row('frontmatter keys in use are read by a real YAML parser'),
        `${path.relative(dir, file)}: ${warning.code} ${warning.detail ?? ''}`.trim(),
      )
    }
  }

  let manifestText: string | null = null
  try {
    manifestText = await read(path.join(dir, '.claude-plugin', 'plugin.json'))
  } catch {
    fail(
      'plugin.json',
      row('`.claude-plugin/plugin.json`: the `skills` array is the skill list'),
      'no .claude-plugin/plugin.json',
    )
  }
  if (manifestText !== null) {
    const manifest = readPluginManifest(manifestText)
    for (const warning of manifest.warnings) {
      fail(
        'plugin.json',
        row('`.claude-plugin/plugin.json`: the `skills` array is the skill list'),
        warning.detail ?? warning.code,
      )
    }
    if (manifest.value !== null) {
      const names = manifest.value.skills.map((skill) => skill.split('/').pop())
      for (const skill of spawnedSkills) {
        if (!names.includes(skill)) {
          fail(
            `skill ${skill}`,
            row(
              'the skill names `wayfinder`, `to-spec`, `to-tickets`, `implement` and `setup-matt-pocock-skills`',
            ),
            `${skill} is not in the manifest's skills`,
          )
        }
      }
    }
  }

  const [wayfinder] = await findFiles(path.join(dir, 'skills'), 'SKILL.md').then((files) =>
    files.filter((file) => path.basename(path.dirname(file)) === 'wayfinder'),
  )
  if (wayfinder === undefined) {
    fail('wayfinder skill', row('`/wayfinder <map> [ticket]`'), 'no wayfinder/SKILL.md')
  } else {
    const text = await read(wayfinder)
    for (const heading of mapHeadings) {
      if (!new RegExp(`^${heading}$`, 'm').test(text)) {
        fail(
          `map heading ${heading}`,
          row(
            'map body H2s `Destination`, `Notes`, `Decisions so far`, `Not yet specified`, `Out of scope`',
          ),
          `wayfinder/SKILL.md has no "${heading}" line`,
        )
      }
    }
    for (const { name, needle } of labelNeedles) {
      if (!text.includes(needle)) {
        fail(
          `label ${name}`,
          row(
            name === 'wayfinder:map'
              ? 'the `wayfinder:map` label marks a map'
              : 'one `wayfinder:<type>` label per ticket',
          ),
          `wayfinder/SKILL.md no longer names ${needle}`,
        )
      }
    }
    if (!/^## Question$/m.test(text)) {
      fail(
        'ticket heading ## Question',
        row('a ticket body opens with `## Question`'),
        'wayfinder/SKILL.md has no "## Question" line',
      )
    }
  }

  const [tracker] = await findFiles(path.join(dir, 'skills'), 'issue-tracker-github.md')
  if (tracker === undefined) {
    fail(
      'GitHub tracker template',
      row(
        'the tracker doc: its H1 names the tracker and it carries a "Wayfinding operations" section',
      ),
      'no issue-tracker-github.md',
    )
  } else {
    const text = await read(tracker)
    for (const needle of trackerNeedles) {
      if (!text.includes(needle)) {
        fail(
          `tracker ${needle}`,
          row('the GitHub tracker template\'s "Wayfinding operations"'),
          `issue-tracker-github.md no longer contains "${needle}"`,
        )
      }
    }
  }

  return failures
}

/** The highest `vX.Y.Z` tag of a `git ls-remote --tags --refs` listing. */
export function latestTag(lsRemote: string): string | null {
  const tags = [...lsRemote.matchAll(/refs\/tags\/(v\d+\.\d+\.\d+)$/gm)].map((match) => match[1]!)
  const parts = (tag: string): number[] => tag.slice(1).split('.').map(Number)
  tags.sort((a, b) => {
    const [x, y] = [parts(a), parts(b)]
    return x[0]! - y[0]! || x[1]! - y[1]! || x[2]! - y[2]!
  })
  return tags.at(-1) ?? null
}

export interface SkillsSource {
  readonly label: string
  readonly dir: string
}

/** The `skills` job: the latest tag, `main`, and the marketplace install, each checked on its own. */
export async function checkSkills(
  sources: ReadonlyArray<SkillsSource>,
  seen: Readonly<Record<string, string>>,
): Promise<Report> {
  const failures: Failure[] = []
  for (const source of sources) failures.push(...(await checkSkillsCopy(source.label, source.dir)))
  const version = seen.tag ?? 'unknown'
  return { upstream: 'skills', version, seen, failures, output: '' }
}

/** The marketplace copy's version and where Claude Code put it, from `claude plugin list --json`. */
export async function marketplaceCopy(): Promise<{ dir: string; version: string } | null> {
  const ran = await run('claude', ['plugin', 'list', '--json'])
  if (ran.code !== 0) return null
  const list = JSON.parse(ran.stdout) as Array<{ id: string; version: string; installPath: string }>
  const hit = list.find((plugin) => pluginNameOf(plugin.id) === 'mattpocock-skills')
  return hit === undefined ? null : { dir: hit.installPath, version: hit.version }
}
