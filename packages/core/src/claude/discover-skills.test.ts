import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'

import { FileSystem } from '../file-system.ts'
import {
  commandOf,
  discoverSkills,
  discoverSkillsPromise,
  userInvokedSkills,
} from './discover-skills.ts'
import type { PluginInstall } from './plugins.ts'

const skillFile = (name: string, description: string, userInvoked = false): string =>
  `---\nname: ${name}\ndescription: ${description}\n${userInvoked ? 'disable-model-invocation: true\n' : ''}---\n\n# ${name}\n`

const manifest = (name: string, skills: ReadonlyArray<string>, version = '1.2.3'): string =>
  JSON.stringify({ name, version, skills })

const install = (id: string, enabled = true, version = '1.2.3'): PluginInstall => ({
  id,
  version,
  enabled,
  installPath: `/plugins/${id}`,
  scope: 'user',
})

const discover = (files: Record<string, string>, plugins: ReadonlyArray<PluginInstall> = []) =>
  discoverSkills({ repoRoot: '/repo', home: '/home/ana', plugins }).pipe(
    Effect.provide(FileSystem.inMemory(files)),
  )

const pluginFiles = (
  id: string,
  skills: Record<string, string>,
  name = id.split('@')[0] ?? id,
): Record<string, string> => ({
  [`/plugins/${id}/.claude-plugin/plugin.json`]: manifest(
    name,
    Object.keys(skills).map((skill) => `./skills/${skill}`),
  ),
  ...Object.fromEntries(
    Object.entries(skills).map(([skill, text]) => [
      `/plugins/${id}/skills/${skill}/SKILL.md`,
      text,
    ]),
  ),
})

describe('discoverSkills', () => {
  it.effect(
    'prefers the project copy of a skill found in the project, the personal directory and a plugin',
    () =>
      Effect.gen(function* () {
        const result = yield* discover(
          {
            '/repo/.claude/skills/wayfinder/SKILL.md': skillFile('wayfinder', 'project copy', true),
            '/home/ana/.claude/skills/wayfinder/SKILL.md': skillFile(
              'wayfinder',
              'personal copy',
              true,
            ),
            ...pluginFiles('mp@market', { wayfinder: skillFile('wayfinder', 'plugin copy', true) }),
          },
          [install('mp@market')],
        )
        expect(result.skills).toEqual([
          {
            name: 'wayfinder',
            command: '/wayfinder',
            source: 'project',
            origin: 'project',
            description: 'project copy',
            userInvoked: true,
          },
        ])
        expect(result.warnings).toEqual([
          {
            code: 'skill-installed-twice',
            detail: 'wayfinder: project, personal, plugin 1.2.3',
          },
        ])
      }),
  )

  it.effect('prefers the personal copy over a plugin copy', () =>
    Effect.gen(function* () {
      const result = yield* discover(
        {
          '/home/ana/.claude/skills/to-spec/SKILL.md': skillFile('to-spec', 'mine'),
          ...pluginFiles('mp@market', { 'to-spec': skillFile('to-spec', 'theirs') }),
        },
        [install('mp@market')],
      )
      expect(commandOf(result.skills, 'to-spec')).toBe('/to-spec')
      expect(result.skills[0]?.origin).toBe('personal')
      expect(result.warnings.map((w) => w.code)).toEqual(['skill-installed-twice'])
    }),
  )

  it.effect(
    'names a plugin-only skill with its plugin and shows the plugin version as its origin',
    () =>
      Effect.gen(function* () {
        const result = yield* discover(
          pluginFiles('mp@market', { wayfinder: skillFile('wayfinder', 'Chart a map', true) }),
          [install('mp@market', true, '1.3.1')],
        )
        expect(result.skills).toEqual([
          {
            name: 'wayfinder',
            command: '/mp:wayfinder',
            source: 'plugin',
            origin: 'plugin 1.3.1',
            description: 'Chart a map',
            userInvoked: true,
          },
        ])
        expect(result.warnings).toEqual([])
      }),
  )

  it.effect('treats a skill of a disabled plugin as not installed', () =>
    Effect.gen(function* () {
      const result = yield* discover(
        pluginFiles('mp@market', { wayfinder: skillFile('wayfinder', 'Chart a map', true) }),
        [install('mp@market', false)],
      )
      expect(result.skills).toEqual([])
      expect(commandOf(result.skills, 'wayfinder')).toBeNull()
      expect(result.warnings).toEqual([
        { code: 'plugin-disabled', detail: 'mp is disabled; not installed: wayfinder' },
      ])
    }),
  )

  it.effect('does not blame a disabled plugin for a skill installed elsewhere', () =>
    Effect.gen(function* () {
      const result = yield* discover(
        {
          '/repo/.claude/skills/wayfinder/SKILL.md': skillFile('wayfinder', 'local'),
          ...pluginFiles('mp@market', { wayfinder: skillFile('wayfinder', 'plugin') }),
        },
        [install('mp@market', false)],
      )
      expect(commandOf(result.skills, 'wayfinder')).toBe('/wayfinder')
      expect(result.warnings).toEqual([])
    }),
  )

  it.effect('marks user-invoked skills and lists them in command order', () =>
    Effect.gen(function* () {
      const result = yield* discover(
        {
          '/repo/.claude/skills/tdd/SKILL.md': skillFile('tdd', 'model-invoked'),
          ...pluginFiles('mp@market', {
            wayfinder: skillFile('wayfinder', 'w', true),
            implement: skillFile('implement', 'i', true),
          }),
        },
        [install('mp@market')],
      )
      expect(result.skills.find((s) => s.name === 'tdd')?.userInvoked).toBe(false)
      expect(userInvokedSkills(result.skills).map((s) => s.command)).toEqual([
        '/mp:implement',
        '/mp:wayfinder',
      ])
    }),
  )

  it.effect('uses the folder name when the frontmatter has no name', () =>
    Effect.gen(function* () {
      const result = yield* discover({
        '/repo/.claude/skills/grill/SKILL.md': '---\ndescription: asks questions\n---\n',
      })
      expect(result.skills[0]?.name).toBe('grill')
      expect(result.skills[0]?.command).toBe('/grill')
    }),
  )

  it.effect('finds nothing, quietly, when no skills directory exists', () =>
    Effect.gen(function* () {
      expect(yield* discover({})).toEqual({ skills: [], warnings: [] })
    }),
  )

  it.effect(
    'reports an unreadable SKILL.md and an unreadable manifest, with the plugin version',
    () =>
      Effect.gen(function* () {
        const result = yield* discover(
          {
            '/repo/.claude/skills/broken/SKILL.md': 'no frontmatter here',
            '/plugins/bad@market/.claude-plugin/plugin.json': '{ nope',
            ...pluginFiles('mp@market', { wayfinder: 'no frontmatter either' }),
          },
          [install('bad@market', true, '9.9.9'), install('mp@market', true, '1.2.3')],
        )
        expect(result.skills).toEqual([])
        expect(result.warnings.map((w) => w.code)).toEqual([
          'skill-unreadable',
          'plugin-manifest-unreadable',
          'skill-unreadable',
        ])
        expect(result.warnings[1]?.detail).toContain('bad@market 9.9.9')
        expect(result.warnings[2]?.detail).toContain('plugin 1.2.3')
      }),
  )

  it.effect('reports a plugin with no manifest on disk', () =>
    Effect.gen(function* () {
      const result = yield* discover({}, [install('ghost@market')])
      expect(result.warnings).toEqual([
        { code: 'plugin-manifest-unreadable', detail: 'ghost@market 1.2.3: no plugin.json found' },
      ])
    }),
  )
})

describe('discovering through a Promise', () => {
  it('reads the real disk: a project skill is found, no home means no personal skills', async () => {
    const root = await mkdtemp(join(tmpdir(), 'discover-skills-'))
    try {
      await mkdir(join(root, '.claude', 'skills', 'wayfinder'), { recursive: true })
      await writeFile(
        join(root, '.claude', 'skills', 'wayfinder', 'SKILL.md'),
        skillFile('wayfinder', 'Chart a map.'),
      )
      const inventory = await discoverSkillsPromise({ repoRoot: root, home: null, plugins: [] })
      expect(inventory.skills.map((skill) => skill.command)).toEqual(['/wayfinder'])
      expect(inventory.warnings).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
