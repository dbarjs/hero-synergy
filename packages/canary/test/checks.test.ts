import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vite-plus/test'

import { missingFlags, pluginListFailures, registryFailures } from '../src/check-claude.ts'
import { checkSkillsCopy, latestTag } from '../src/check-skills.ts'

const help = `
Options:
  -n, --name <name>        Set a display name
  --plugin-dir <path>      Load a plugin from a directory or .zip
  -r, --resume [value]     Resume a conversation
  -w, --worktree [name]    Create a new git worktree
  --brand-new-flag         A flag added later
`

describe('claude --help', () => {
  it('passes with every launch flag present, new flags included', () => {
    expect(missingFlags(help)).toEqual([])
  })

  it('names each launch flag that went missing, with its register row', () => {
    const failures = missingFlags(
      help.replace('--worktree', '--tree').replace('--plugin-dir', '--plugin-dirs'),
    )

    expect(failures.map((failure) => failure.contract)).toEqual([
      'help --worktree',
      'help --plugin-dir',
    ])
    expect(failures[0]?.row).toContain('Launch flags')
  })
})

describe('claude agents --json', () => {
  it('decodes an empty registry and an entry with fields added later', () => {
    expect(registryFailures('[]')).toEqual([])
    expect(
      registryFailures(
        JSON.stringify([{ sessionId: 's', name: 'n', status: 'busy', brandNew: { nested: true } }]),
      ),
    ).toEqual([])
  })

  it('fails when the output stops being the registry shape', () => {
    expect(registryFailures('not json')[0]?.contract).toBe('agents --json')
    expect(registryFailures(JSON.stringify([{ sessionId: 's' }]))).not.toEqual([])
  })
})

describe('claude plugin list --json', () => {
  const entry = {
    id: 'mattpocock-skills@claude-plugins-official',
    version: '1.3.1',
    enabled: true,
    installPath: '/x',
    scope: 'user',
    installedAt: 'new field',
  }

  it('decodes the install, ignoring fields added later', () => {
    expect(pluginListFailures(JSON.stringify([entry]))).toEqual([])
  })

  it('fails when the installed plugin is not listed or the shape changed', () => {
    expect(pluginListFailures('[]')[0]?.error).toContain('is not in the list')
    expect(pluginListFailures(JSON.stringify([{ ...entry, enabled: 'yes' }]))).not.toEqual([])
  })
})

describe('the skills copies', () => {
  const skill = (name: string, extra = ''): string =>
    `---\nname: ${name}\ndescription: "A skill, with: a colon"\n${extra}---\n\nBody\n`

  const wayfinder = `---
name: wayfinder
description: x
---
## Destination
## Notes
## Decisions so far
## Not yet specified
## Out of scope
## Question
Labels: \`wayfinder:map\`, \`wayfinder:<type>\`: \`research\`, \`prototype\`, \`grilling\`, \`task\`
`
  const tracker = `# Issue tracker: GitHub

## Wayfinding operations

- sub-issue endpoint, Part of #1, Blocked by: #2
- gh issue edit --add-assignee @me
- dependencies/blocked_by
`

  async function copy(
    options: { wayfinder?: string; tracker?: string; manifest?: string } = {},
  ): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), 'canary-skills-'))
    const write = async (file: string, text: string): Promise<void> => {
      await mkdir(path.dirname(path.join(dir, file)), { recursive: true })
      await writeFile(path.join(dir, file), text)
    }
    await write('skills/engineering/wayfinder/SKILL.md', options.wayfinder ?? wayfinder)
    await write(
      'skills/engineering/to-spec/SKILL.md',
      skill('to-spec', 'metadata:\n  nested: map\n'),
    )
    await write(
      'skills/engineering/setup-matt-pocock-skills/issue-tracker-github.md',
      options.tracker ?? tracker,
    )
    await write(
      '.claude-plugin/plugin.json',
      options.manifest ??
        JSON.stringify({
          name: 'mattpocock-skills',
          version: '9.9.9',
          skills: [
            'wayfinder',
            'to-spec',
            'to-tickets',
            'implement',
            'setup-matt-pocock-skills',
            'brand-new',
          ].map((s) => `./skills/engineering/${s}`),
        }),
    )
    return dir
  }

  it('passes a copy that carries everything the scout reads, and new skills with it', async () => {
    expect(await checkSkillsCopy('tag', await copy())).toEqual([])
  })

  it('fails a renamed map heading, a lost label and a lost tracker operation', async () => {
    const failures = await checkSkillsCopy(
      'main',
      await copy({
        wayfinder: wayfinder.replace('## Decisions so far', '## Decisions').replace(', `task`', ''),
        tracker: tracker.replace('--add-assignee @me', '--assign me'),
      }),
    )

    expect(failures.map((failure) => failure.contract)).toEqual([
      'main: map heading ## Decisions so far',
      'main: label ticket type task',
      'main: tracker --add-assignee @me',
    ])
  })

  it('fails a frontmatter that no longer decodes and a skill the manifest dropped', async () => {
    const dir = await copy({
      manifest: JSON.stringify({
        name: 'mattpocock-skills',
        skills: ['./skills/engineering/wayfinder'],
      }),
    })
    await writeFile(path.join(dir, 'skills/engineering/to-spec/SKILL.md'), 'no frontmatter at all')

    const failures = await checkSkillsCopy('marketplace', dir)

    expect(failures.map((failure) => failure.contract)).toContain(
      'marketplace: SKILL.md frontmatter',
    )
    expect(failures.map((failure) => failure.contract)).toContain('marketplace: skill to-tickets')
  })
})

describe('the latest tag', () => {
  it('compares by number, not text', () => {
    const listing = ['v1.2.3', 'v1.10.0', 'v1.9.9', 'v0.1.0']
      .map((tag, index) => `${String(index).padStart(40, '0')}\trefs/tags/${tag}`)
      .join('\n')

    expect(latestTag(listing)).toBe('v1.10.0')
    expect(latestTag('')).toBeNull()
  })
})
