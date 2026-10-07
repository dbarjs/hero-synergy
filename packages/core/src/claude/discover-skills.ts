import { Effect } from 'effect'

import { FileSystem, type FileSystemError, type FileSystemShape } from '../file-system.ts'
import { joinPath } from '../scout/paths.ts'
import type { HealthWarning } from '../snapshot/warnings.ts'
import { type Decoded, warn } from './decode.ts'
import { type PluginInstall, pluginNameOf, readPluginManifest } from './plugins.ts'
import { readSkillFrontmatter } from './skill.ts'

/**
 * Skill discovery: which skills the Cockpit can run, and as which command.
 * Claude Code names a project or personal skill `/<name>` and a plugin skill
 * `/<plugin>:<name>`; where both exist the unnamespaced copy is the one the
 * Cockpit launches. The inventory is read on demand and is not snapshot data.
 */

export type SkillSource = 'project' | 'personal' | 'plugin'

export interface DiscoveredSkill {
  /** The skill's name: its frontmatter `name`, else its folder name. */
  readonly name: string
  /** What is typed in Claude Code: `/<name>`, or `/<plugin>:<name>` for a plugin skill. */
  readonly command: string
  readonly source: SkillSource
  /** Where the copy came from, as the Run skill… list shows it: `project`, `personal` or `plugin <version>`. */
  readonly origin: string
  /** The frontmatter description, read from the file. */
  readonly description: string
  /** `disable-model-invocation: true`: a skill the user invokes, the ones Run skill… lists. */
  readonly userInvoked: boolean
}

export interface SkillInventory {
  /** One entry per skill name, the winning copy: project, then personal, then plugins in list order. */
  readonly skills: ReadonlyArray<DiscoveredSkill>
  readonly warnings: ReadonlyArray<HealthWarning>
}

export interface DiscoverSkillsInput {
  /** The repo root; its `.claude/skills` is the project's skills directory. */
  readonly repoRoot: string
  /** The home directory; its `.claude/skills` is the personal one. Null skips the personal directory. */
  readonly home: string | null
  /** The decoded `claude plugin list --json`. */
  readonly plugins: ReadonlyArray<PluginInstall>
}

const SKILLS_DIRECTORY = ['.claude', 'skills'] as const

/** A copy of a skill found in one place, before the copies are ranked. */
interface Copy extends DiscoveredSkill {
  /** The plugin's name for a plugin copy. */
  readonly plugin: string | null
}

export function discoverSkills(
  input: DiscoverSkillsInput,
): Effect.Effect<SkillInventory, never, FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem
    const warnings: HealthWarning[] = []
    const note = (decoded: Decoded<unknown>) => warnings.push(...decoded.warnings)

    const copies: Copy[] = []

    for (const [source, root] of [
      ['project', input.repoRoot],
      ['personal', input.home],
    ] as const) {
      if (root === null) continue
      const found = yield* readSkillsDirectory(fs, joinPath(root, ...SKILLS_DIRECTORY), source)
      copies.push(...found.value.map((skill) => ({ ...skill, plugin: null })))
      note(found)
    }

    // A disabled plugin's skills are read too, to say what its being disabled takes away.
    const disabled: Array<{ plugin: string; names: ReadonlyArray<string> }> = []
    for (const install of input.plugins) {
      const read = yield* readPluginSkills(fs, install)
      note(read)
      if (install.enabled) copies.push(...read.value)
      else disabled.push({ plugin: pluginNameOf(install.id), names: read.value.map((s) => s.name) })
    }

    const byName = new Map<string, Copy[]>()
    for (const copy of copies) byName.set(copy.name, [...(byName.get(copy.name) ?? []), copy])

    const skills: DiscoveredSkill[] = []
    for (const [name, group] of byName) {
      // Project, personal, then plugins: the input order already is that rank.
      const [winner] = group
      if (winner === undefined) continue
      const { plugin: _plugin, ...skill } = winner
      skills.push(skill)
      if (group.length > 1) {
        const places = group.map((copy) => copy.origin).join(', ')
        warnings.push(warn('skill-installed-twice', `${name}: ${places}`))
      }
    }

    for (const { plugin, names } of disabled) {
      const missing = names.filter((name) => !byName.has(name))
      if (missing.length > 0) {
        warnings.push(
          warn('plugin-disabled', `${plugin} is disabled; not installed: ${missing.join(', ')}`),
        )
      }
    }

    return { skills, warnings }
  })
}

/** The command of the skill with this name, or null when it is not installed. */
export function commandOf(skills: ReadonlyArray<DiscoveredSkill>, name: string): string | null {
  return skills.find((skill) => skill.name === name)?.command ?? null
}

/** Every skill the user invokes, in command order: what Run skill… lists. */
export function userInvokedSkills(
  skills: ReadonlyArray<DiscoveredSkill>,
): ReadonlyArray<DiscoveredSkill> {
  return skills
    .filter((skill) => skill.userInvoked)
    .toSorted((a, b) => (a.command < b.command ? -1 : a.command > b.command ? 1 : 0))
}

const SKILL_FILE = 'SKILL.md'

type Found<A> = Effect.Effect<Decoded<A>>

/** The `SKILL.md` text at a folder, or null when there is none; a failure to read is a warning. */
const readSkillFile = (
  fs: FileSystemShape,
  folder: string,
): Effect.Effect<{ text: string | null; warning: HealthWarning | null }> =>
  fs.readFile(joinPath(folder, SKILL_FILE)).pipe(
    Effect.map((text) => ({ text, warning: null })),
    Effect.catch((error: FileSystemError) =>
      Effect.succeed(
        error.code === 'NotFound' || error.code === 'IsADirectory'
          ? { text: null, warning: null }
          : { text: null, warning: warn('skill-unreadable', `${folder}: ${error.message}`) },
      ),
    ),
  )

const readSkill = (
  fs: FileSystemShape,
  folder: string,
  folderName: string,
  place: { source: SkillSource; origin: string; namespace: string | null },
): Effect.Effect<{ skill: Copy | null; warnings: ReadonlyArray<HealthWarning> }> =>
  Effect.gen(function* () {
    const file = yield* readSkillFile(fs, folder)
    if (file.warning !== null) return { skill: null, warnings: [file.warning] }
    if (file.text === null) return { skill: null, warnings: [] }
    const read = readSkillFrontmatter(file.text)
    if (read.value === null) {
      return {
        skill: null,
        warnings: read.warnings.map((w) =>
          warn('skill-unreadable', `${place.origin} ${folderName}: ${w.detail ?? 'unreadable'}`),
        ),
      }
    }
    const name = read.value.name ?? folderName
    return {
      skill: {
        name,
        command: place.namespace === null ? `/${name}` : `/${place.namespace}:${name}`,
        source: place.source,
        origin: place.origin,
        description: read.value.description,
        userInvoked: read.value.userInvoked,
        plugin: place.namespace,
      },
      warnings: [],
    }
  })

/** The skills in a `.claude/skills` directory: one folder per skill, a missing directory is no skills. */
const readSkillsDirectory = (
  fs: FileSystemShape,
  directory: string,
  source: 'project' | 'personal',
): Found<ReadonlyArray<DiscoveredSkill>> =>
  Effect.gen(function* () {
    const names = yield* fs
      .readDirectory(directory)
      .pipe(
        Effect.catch((error: FileSystemError) =>
          Effect.succeed(
            error.code === 'NotFound' || error.code === 'NotADirectory'
              ? ([] as ReadonlyArray<string>)
              : null,
          ),
        ),
      )
    if (names === null) {
      return {
        value: [],
        warnings: [warn('skill-unreadable', `${directory}: cannot list the skills directory`)],
      }
    }
    const skills: DiscoveredSkill[] = []
    const warnings: HealthWarning[] = []
    for (const folderName of names) {
      const read = yield* readSkill(fs, joinPath(directory, folderName), folderName, {
        source,
        origin: source,
        namespace: null,
      })
      if (read.skill !== null) skills.push(read.skill)
      warnings.push(...read.warnings)
    }
    return { value: skills, warnings }
  })

/** The `plugin.json` locations Claude Code reads, in the order they are tried. */
const MANIFEST_PATHS = [['.claude-plugin', 'plugin.json'], ['plugin.json']] as const

/**
 * The skills one plugin lists: the install path from the plugin list, the
 * manifest's `skills` array, each folder's `SKILL.md`. Warnings carry the
 * plugin's version so a skills update that changed shape is recognisable.
 */
const readPluginSkills = (
  fs: FileSystemShape,
  install: PluginInstall,
): Found<ReadonlyArray<Copy>> =>
  Effect.gen(function* () {
    const label = `${install.id} ${install.version}`
    let text: string | null = null
    for (const parts of MANIFEST_PATHS) {
      text = yield* fs
        .readFile(joinPath(install.installPath, ...parts))
        .pipe(Effect.catch(() => Effect.succeed(null)))
      if (text !== null) break
    }
    if (text === null) {
      return {
        value: [],
        warnings: [warn('plugin-manifest-unreadable', `${label}: no plugin.json found`)],
      }
    }
    const manifest = readPluginManifest(text)
    if (manifest.value === null) {
      return {
        value: [],
        warnings: manifest.warnings.map((w) =>
          warn('plugin-manifest-unreadable', `${label}: ${w.detail ?? 'unreadable'}`),
        ),
      }
    }
    const plugin = manifest.value.name
    const skills: Copy[] = []
    const warnings: HealthWarning[] = []
    for (const entry of manifest.value.skills) {
      const folder = joinPath(install.installPath, entry.replace(/^\.\//, '').replace(/\/+$/, ''))
      const folderName = folder.split('/').pop() ?? folder
      const read = yield* readSkill(fs, folder, folderName, {
        source: 'plugin',
        origin: `plugin ${install.version}`,
        namespace: plugin,
      })
      if (read.skill !== null) skills.push(read.skill)
      warnings.push(
        ...read.warnings.map((w) => warn(w.code, `plugin ${install.version}: ${w.detail ?? ''}`)),
      )
    }
    return { value: skills, warnings }
  })
