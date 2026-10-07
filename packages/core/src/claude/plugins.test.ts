import { describe, expect, test } from 'vite-plus/test'

import pluginList from '../../fixtures/process/claude-plugin-list-json.json' with { type: 'json' }
import { fixtureText } from './fixtures.ts'
import { pluginNameOf, readPluginList, readPluginManifest } from './plugins.ts'

describe('claude plugin list --json', () => {
  test('decodes the recorded list: install path, enabled flag and version', () => {
    const read = readPluginList(pluginList.stdout)
    expect(read.warnings).toEqual([])
    expect(read.value).toEqual([
      {
        id: 'mattpocock-skills@claude-plugins-official',
        version: '1.2.3',
        enabled: true,
        installPath:
          '/home/vscode/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.2.3',
        scope: 'user',
      },
    ])
  })

  test('keeps a disabled plugin, flagged, and ignores fields it does not know', () => {
    const read = readPluginList(
      JSON.stringify([
        { id: 'a@m', version: '0.1.0', enabled: false, installPath: '/p', mcpServers: { x: {} } },
      ]),
    )
    expect(read.warnings).toEqual([])
    expect(read.value).toEqual([
      { id: 'a@m', version: '0.1.0', enabled: false, installPath: '/p', scope: null },
    ])
  })

  test('an empty list is no plugins, without a warning', () => {
    expect(readPluginList('[]')).toEqual({ value: [], warnings: [] })
  })

  test('output that is not a list of plugins is plugin-manifest-unreadable, and only that', () => {
    for (const stdout of ['{"plugins":[]}', 'not json']) {
      const read = readPluginList(stdout)
      expect(read.value).toEqual([])
      expect(read.warnings.map((warning) => warning.code)).toEqual(['plugin-manifest-unreadable'])
    }
  })

  test('an entry that lacks its install path is dropped with a warning; the others stay', () => {
    const read = readPluginList(
      JSON.stringify([
        { id: 'a@m', version: '1', enabled: true },
        { id: 'b@m', version: '1', enabled: true, installPath: '/b' },
      ]),
    )
    expect(read.value.map((plugin) => plugin.id)).toEqual(['b@m'])
    expect(read.warnings.map((warning) => warning.code)).toEqual(['plugin-manifest-unreadable'])
  })

  test('names a plugin from its install id', () => {
    expect(pluginNameOf('mattpocock-skills@claude-plugins-official')).toBe('mattpocock-skills')
    expect(pluginNameOf('bare')).toBe('bare')
  })
})

describe('a plugin manifest', () => {
  test('reads the name, version and skills array of the installed mattpocock-skills', () => {
    const read = readPluginManifest(fixtureText('plugins/mattpocock-skills-1.2.3.plugin.json'))
    expect(read.warnings).toEqual([])
    expect(read.value?.name).toBe('mattpocock-skills')
    expect(read.value?.version).toBe('1.2.3')
    expect(read.value?.skills).toHaveLength(25)
    expect(read.value?.skills).toContain('./skills/engineering/wayfinder')
  })

  test('a manifest with no skills array lists no skills', () => {
    expect(readPluginManifest('{"name":"p"}')).toEqual({
      value: { name: 'p', version: null, skills: [] },
      warnings: [],
    })
  })

  test('a skills array that is not an array is plugin-manifest-unreadable, and only that', () => {
    const read = readPluginManifest(fixtureText('health/plugin-manifest-unreadable.json'))
    expect(read.value).toBeNull()
    expect(read.warnings.map((warning) => warning.code)).toEqual(['plugin-manifest-unreadable'])
  })

  test('a manifest that is not JSON, or has no name, is plugin-manifest-unreadable', () => {
    for (const text of ['{', '{"skills":[]}', '[]']) {
      const read = readPluginManifest(text)
      expect(read.value).toBeNull()
      expect(read.warnings.map((warning) => warning.code)).toEqual(['plugin-manifest-unreadable'])
    }
  })
})
