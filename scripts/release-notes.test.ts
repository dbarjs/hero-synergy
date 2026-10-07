import { describe, expect, it } from 'vite-plus/test'

import { changelogEntry, previousTag, releaseNotes, releaseTitle } from './release-notes.ts'

const manifest = { name: 'hero-synergy', publisher: 'dbarjs', version: '0.2.0' }

// What `changeset version` writes for the extension when core moved with it.
const changelog = `# hero-synergy

## 0.2.0

### Minor Changes

- 1a2b3c4: Add the Focus pane to the Tree.

### Patch Changes

- 5d6e7f8: Fix the refresh button.
- Updated dependencies [5d6e7f8]
  - @hero-synergy/core@0.2.0

## 0.1.0

### Minor Changes

- 9a8b7c6: The first release.
`

const everyRegistryOn = { marketplace: true, openVsx: true }
const everyRegistryOff = { marketplace: false, openVsx: false }

describe('releaseTitle', () => {
  it('names the extension and the version', () => {
    expect(releaseTitle('0.2.0')).toBe('hero-synergy v0.2.0')
  })
})

describe('changelogEntry', () => {
  it('takes the entry of the version and no other', () => {
    const entry = changelogEntry(changelog, '0.2.0')
    expect(entry).toContain('Add the Focus pane to the Tree.')
    expect(entry).toContain('Fix the refresh button.')
    expect(entry).not.toContain('The first release.')
  })

  it('strips an Updated dependencies line and the items under it', () => {
    const entry = changelogEntry(changelog, '0.2.0')
    expect(entry).not.toContain('Updated dependencies')
    expect(entry).not.toContain('@hero-synergy/core')
  })

  it('drops a heading left with nothing but dependency updates', () => {
    const onlyDependencies = `## 0.2.0

### Patch Changes

- Updated dependencies [5d6e7f8]
  - @hero-synergy/core@0.2.0
`
    expect(changelogEntry(onlyDependencies, '0.2.0')).toBe('')
  })

  it('is empty for a version with no entry', () => {
    expect(changelogEntry(changelog, '9.9.9')).toBe('')
  })
})

describe('previousTag', () => {
  it('is the newest tag other than the release itself, in any order', () => {
    expect(previousTag(['v0.1.0', 'v0.10.0', 'v0.9.0', 'v0.11.0'], 'v0.11.0')).toBe('v0.10.0')
  })

  it('ignores tags that are not releases', () => {
    expect(previousTag(['', 'canary', 'v0.1.0'], 'v0.2.0')).toBe('v0.1.0')
  })

  it('is nothing for the first release', () => {
    expect(previousTag(['v0.1.0'], 'v0.1.0')).toBeUndefined()
  })
})

describe('releaseNotes', () => {
  const notes = (registries = everyRegistryOn, tags = ['v0.1.0']) =>
    releaseNotes({ manifest, changelog, registries, tags })

  it('carries the changelog entry without its Updated dependencies line', () => {
    expect(notes()).toContain('Add the Focus pane to the Tree.')
    expect(notes()).not.toContain('Updated dependencies')
  })

  it('links each registry when its variable is on', () => {
    expect(notes()).toContain(
      '[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=dbarjs.hero-synergy)',
    )
    expect(notes()).toContain('[Open VSX](https://open-vsx.org/extension/dbarjs/hero-synergy)')
  })

  it('links only the Marketplace when only its variable is on', () => {
    const body = notes({ marketplace: true, openVsx: false })
    expect(body).toContain('VS Code Marketplace')
    expect(body).not.toContain('Open VSX')
  })

  it('links only Open VSX when only its variable is on', () => {
    const body = notes({ marketplace: false, openVsx: true })
    expect(body).toContain('Open VSX')
    expect(body).not.toContain('Marketplace')
  })

  it('points at the attached VSIX alone when every registry is off', () => {
    const body = notes(everyRegistryOff)
    expect(body).toContain('**Install:** the `.vsix` attached below')
    expect(body).not.toContain('Marketplace')
    expect(body).not.toContain('Open VSX')
  })

  it('always mentions the attached VSIX', () => {
    expect(notes()).toContain('the `.vsix` attached below')
  })

  it('spans the compare link from the previous tag to this one', () => {
    expect(notes(everyRegistryOn, ['v0.1.0', 'v0.0.9', 'v0.2.0'])).toContain(
      'https://github.com/dbarjs/hero-synergy/compare/v0.1.0...v0.2.0',
    )
  })

  it('has no compare link for the first release', () => {
    expect(notes(everyRegistryOn, [])).not.toContain('compare')
  })

  it('never links core or its changelog', () => {
    expect(notes()).not.toMatch(/core/i)
  })
})
