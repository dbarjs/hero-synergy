import { describe, expect, test } from 'vite-plus/test'

import { fixtureNames, fixtureText } from './fixtures.ts'
import { readPluginManifest } from './plugins.ts'
import { readSkillFrontmatter } from './skill.ts'

const installed = 'skills/mattpocock-skills-1.2.3/'
const upstream = 'skills/mattpocock-skills-1.3.1/'

describe('the frontmatter of every skill in the installed mattpocock-skills release', () => {
  const manifest = readPluginManifest(
    fixtureText('plugins/mattpocock-skills-1.2.3.plugin.json'),
  ).value!
  const names = manifest.skills.map((folder) => folder.split('/').pop()!)

  test('has a frontmatter fixture for every skill the manifest lists', () => {
    expect(fixtureNames(installed)).toEqual(names.map((name) => `${name}.md`).sort())
  })

  test.each(names)('%s decodes with its name and description', (name) => {
    const read = readSkillFrontmatter(fixtureText(`${installed}${name}.md`))
    expect(read.warnings).toEqual([])
    expect(read.value?.name).toBe(name)
    expect(read.value?.description.length).toBeGreaterThan(0)
  })

  test('reads disable-model-invocation as user-invoked', () => {
    const userInvoked = (name: string) =>
      readSkillFrontmatter(fixtureText(`${installed}${name}.md`)).value?.userInvoked
    expect(userInvoked('wayfinder')).toBe(true)
    expect(userInvoked('to-spec')).toBe(true)
    expect(userInvoked('setup-matt-pocock-skills')).toBe(true)
    expect(userInvoked('implement')).toBe(true) // its description is quoted
    expect(userInvoked('tdd')).toBe(false)
    expect(userInvoked('grilling')).toBe(false)
  })

  test('keeps the description whole, quoted or not', () => {
    const description = (name: string) =>
      readSkillFrontmatter(fixtureText(`${installed}${name}.md`)).value?.description
    expect(description('implement')).toBe(
      'Implement a piece of work based on a spec or set of tickets.',
    )
    expect(description('grilling')).toBe(
      "Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.",
    )
  })
})

describe('what upstream added after the installed release', () => {
  test('a nested metadata map is read past, unknown keys ignored', () => {
    const read = readSkillFrontmatter(fixtureText(`${upstream}pr.md`))
    expect(read.warnings).toEqual([])
    expect(read.value).toEqual({
      name: 'pr',
      description: 'Use when writing a PR body.',
      userInvoked: false,
    })
  })

  test('a quoted description with escaped quotes and a colon decodes unescaped', () => {
    const read = readSkillFrontmatter(fixtureText(`${upstream}code-review.md`))
    expect(read.warnings).toEqual([])
    expect(read.value?.description).toContain('along two axes: Standards')
    expect(read.value?.description).toContain('asks to "review since X".')
  })

  test.each(['to-spec', 'wayfinder'])('%s still decodes as user-invoked', (name) => {
    const read = readSkillFrontmatter(fixtureText(`${upstream}${name}.md`))
    expect(read.warnings).toEqual([])
    expect(read.value).toMatchObject({ name, userInvoked: true })
  })
})

describe('what a frontmatter can get wrong', () => {
  test('YAML that does not parse is skill-unreadable, and only that', () => {
    const read = readSkillFrontmatter(fixtureText('health/skill-unreadable.md'))
    expect(read.value).toBeNull()
    expect(read.warnings.map((warning) => warning.code)).toEqual(['skill-unreadable'])
  })

  test('a file with no frontmatter, a non-map or no description is skill-unreadable', () => {
    for (const text of [
      '# Just a heading\n',
      '---\n- a\n- b\n---\n',
      '---\nname: x\n---\n',
      '---\nname: x\ndescription: 12\n---\n',
      '---\nname: [a]\ndescription: d\n---\n',
    ]) {
      const read = readSkillFrontmatter(text)
      expect(read.value).toBeNull()
      expect(read.warnings.map((warning) => warning.code)).toEqual(['skill-unreadable'])
    }
  })

  test('a skill without a name still decodes; the folder name stands in', () => {
    expect(readSkillFrontmatter('---\ndescription: d\n---\n').value).toEqual({
      name: null,
      description: 'd',
      userInvoked: false,
    })
  })

  test('reads Windows line endings and a byte order mark', () => {
    const read = readSkillFrontmatter(
      '﻿---\r\nname: x\r\ndescription: d\r\ndisable-model-invocation: true\r\n---\r\nBody\r\n',
    )
    expect(read.value).toEqual({ name: 'x', description: 'd', userInvoked: true })
  })

  test('a disable-model-invocation that is not the boolean true is not user-invoked', () => {
    const read = readSkillFrontmatter(
      '---\nname: x\ndescription: d\ndisable-model-invocation: "yes"\n---\n',
    )
    expect(read.value?.userInvoked).toBe(false)
  })
})
