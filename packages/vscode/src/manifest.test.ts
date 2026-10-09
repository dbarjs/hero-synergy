import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vite-plus/test'
import { bypassModes } from '@hero-synergy/core'

const packageDir = fileURLToPath(new URL('..', import.meta.url))
const read = (file: string) => readFileSync(`${packageDir}${file}`, 'utf8')
const manifest = JSON.parse(read('package.json'))

describe('the manifest the registries show', () => {
  it('names the extension dbarjs.hero-synergy (ADR 0001)', () => {
    expect(manifest.publisher).toBe('dbarjs')
    expect(manifest.name).toBe('hero-synergy')
    expect(manifest.displayName).toBe('Hero Synergy')
  })

  it('sits on the 1.105 floor with the tilde types range, in the workspace extension host', () => {
    expect(manifest.engines.vscode).toBe('^1.105.0')
    expect(manifest.devDependencies['@types/vscode']).toBe('~1.105.0')
    expect(manifest.extensionKind).toEqual(['workspace'])
  })

  it('is one universal VSIX: no runtime dependencies to bundle, no native modules', () => {
    expect(manifest.dependencies).toBeUndefined()
    expect(manifest.scripts.package).toContain('vsce package')
    expect(manifest.scripts.package).toContain('--no-dependencies')
  })

  it('says the one line, listed under AI with the agreed keywords (#117)', () => {
    expect(manifest.description).toBe(
      'See your wayfinder frontier and start each ticket as a named Claude Code session, with live status.',
    )
    expect(manifest.categories).toEqual(['AI'])
    expect(manifest.keywords.toSorted()).toEqual([
      'agent',
      'agent skills',
      'ai',
      'claude',
      'claude code',
      'github issues',
      'issue tracker',
      'matt pocock',
      'mattpocock',
      'sessions',
      'skills',
      'terminal',
      'wayfinder',
      'worktree',
    ])
  })

  it('is marked preview while the version is 0.x', () => {
    expect(manifest.preview).toBe(manifest.version.startsWith('0.'))
  })

  it('has no Q & A tab, so strangers go to Issues (#146)', () => {
    expect(manifest.qna).toBe(false)
  })

  it('leaves #<number> in the README as text, not an issue link', () => {
    expect(manifest.scripts.package).toContain('--no-gitHubIssueLinking')
  })

  it('points bugs and the homepage at the repository', () => {
    expect(manifest.bugs.url).toBe('https://github.com/dbarjs/hero-synergy/issues')
    expect(manifest.homepage).toBe('https://github.com/dbarjs/hero-synergy#readme')
    expect(manifest.repository.url).toBe('git+https://github.com/dbarjs/hero-synergy.git')
  })

  it('has a PNG icon, since the registries do not take SVG', () => {
    expect(manifest.icon).toBe('media/icon.png')
    const png = readFileSync(`${packageDir}${manifest.icon}`)
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
    const width = png.readUInt32BE(16)
    const height = png.readUInt32BE(20)
    expect(width).toBe(height)
    expect(width).toBeGreaterThanOrEqual(128)
  })

  it('shows the Marketplace banner in Midnight, the darkest color of the logo', () => {
    expect(manifest.galleryBanner).toEqual({ color: '#0F0B30', theme: 'dark' })
  })

  it('packages only the built extension, the webview, the plugin, the media and the legal files', () => {
    expect(manifest.files).toEqual([
      'dist',
      'claude-plugin',
      'media',
      'README.md',
      'CHANGELOG.md',
      'LICENSE',
    ])
    expect(existsSync(`${packageDir}README.md`)).toBe(true)
    expect(existsSync(`${packageDir}LICENSE`)).toBe(true)
  })

  it('declares the four settings and no others', () => {
    const properties = manifest.contributes.configuration.properties
    expect(Object.keys(properties).toSorted()).toEqual([
      'heroSynergy.claude.path',
      'heroSynergy.sessions.bypassPermissions',
      'heroSynergy.sessions.bypassPermissionsOnlyWhenIsolated',
      'heroSynergy.sessions.terminalLocation',
    ])
    expect(properties['heroSynergy.sessions.terminalLocation']).toMatchObject({
      type: 'string',
      enum: ['panel', 'editor'],
      default: 'panel',
    })
    // Machine scope: a repository's `.vscode/settings.json` must never choose the program the
    // Cockpit spawns.
    expect(properties['heroSynergy.claude.path']).toMatchObject({
      type: 'string',
      default: '',
      scope: 'machine',
    })
    // Both bypass settings are machine-scoped too: a cloned repository can neither turn bypass on
    // nor loosen the isolation gate.
    expect(properties['heroSynergy.sessions.bypassPermissions']).toMatchObject({
      type: 'string',
      enum: [...bypassModes],
      default: 'off',
      scope: 'machine',
    })
    expect(properties['heroSynergy.sessions.bypassPermissions'].enumDescriptions).toHaveLength(3)
    expect(properties['heroSynergy.sessions.bypassPermissions'].markdownDescription).toContain(
      'Claude Code asks you once, in the first bypassed session, to accept bypass mode.',
    )
    expect(properties['heroSynergy.sessions.bypassPermissionsOnlyWhenIsolated']).toMatchObject({
      type: 'boolean',
      default: true,
      scope: 'machine',
    })
    for (const setting of Object.values<{ markdownDescription?: string }>(properties)) {
      expect(setting.markdownDescription).toBeTruthy()
    }
  })

  it('puts Chart a map, Run skill… and Refresh in the Tree title bar, in that order', () => {
    const items = manifest.contributes.menus['view/title'].toSorted(
      (a: { group: string }, b: { group: string }) => a.group.localeCompare(b.group),
    )
    expect(items.map((item: { command: string }) => item.command)).toEqual([
      'heroSynergy.chartMap',
      'heroSynergy.runSkill',
      'heroSynergy.refresh',
    ])
    for (const item of items) expect(item.when).toBe('view == heroSynergy.tree')
  })

  it('declares the four commands under the Hero Synergy category', () => {
    const commands = manifest.contributes.commands.map(
      (command: { command: string; title: string; category: string }) => [
        command.command,
        command.category,
        command.title,
      ],
    )
    expect(commands).toEqual([
      ['heroSynergy.openDetail', 'Hero Synergy', 'Open Cockpit Detail'],
      ['heroSynergy.chartMap', 'Hero Synergy', 'Chart a map'],
      ['heroSynergy.runSkill', 'Hero Synergy', 'Run skill…'],
      ['heroSynergy.refresh', 'Hero Synergy', 'Refresh'],
    ])
  })

  it('activates on the tracker doc, the view and the Detail panel to restore, and on nothing else', () => {
    expect(manifest.activationEvents.toSorted()).toEqual([
      'onView:heroSynergy.tree',
      'onWebviewPanel:heroSynergy.detail',
      'workspaceContains:docs/agents/issue-tracker.md',
    ])
  })

  it('keeps the Tree view and the activity-bar icon the extension already ships', () => {
    const [container] = manifest.contributes.viewsContainers.activitybar
    expect(existsSync(`${packageDir}${container.icon}`)).toBe(true)
    expect(manifest.contributes.views[container.id].map((view: { id: string }) => view.id)).toEqual(
      ['heroSynergy.tree'],
    )
  })
})

describe('the extension README', () => {
  const readme = read('README.md')

  it('has one Requirements section stating each requirement', () => {
    expect(readme.match(/^## Requirements$/gm)).toHaveLength(1)
    for (const requirement of [
      'VS Code 1.105',
      'macOS and Linux',
      'WSL',
      '2.1.212',
      'mattpocock-skills',
      'any release from 1.1.0; built and tested against 1.2.3 and 1.3.1',
      'never both',
      'Node 22.18',
      '`gh`',
      'built for VS Code; forks are expected to work',
    ]) {
      expect(readme.toLowerCase()).toContain(requirement.toLowerCase())
    }
  })

  it('states the session-naming and push-back conventions', () => {
    expect(readme).toContain('#<number>')
    expect(readme).toContain('git push origin HEAD:main')
  })

  it('links only to absolute URLs, so both registries render it without broken links', () => {
    const targets = [...readme.matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1] ?? '')
    expect(targets.length).toBeGreaterThan(0)
    for (const target of targets) expect(target).toMatch(/^https:\/\//)
    expect(readme).not.toMatch(/<img[^>]+src="(?!https:\/\/)/)
  })

  it('pins every image to a release tag, never a branch', () => {
    const sources = [...readme.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1] ?? '')
    expect(sources.length).toBeGreaterThan(0)
    for (const source of sources) {
      expect(source).toMatch(
        /^https:\/\/raw\.githubusercontent\.com\/dbarjs\/hero-synergy\/v\d+\.\d+\.\d+\/docs\/media\//,
      )
    }
  })
})

describe('the root README', () => {
  it('points at the extension README', () => {
    const root = readFileSync(fileURLToPath(new URL('../../../README.md', import.meta.url)), 'utf8')
    expect(root).toContain('packages/vscode/README.md')
  })
})
