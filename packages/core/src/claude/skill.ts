import { parseYAML } from 'confbox'

import { messageOf, warn, type Decoded } from './decode.ts'

/**
 * A `SKILL.md` frontmatter, read through a real YAML parser: upstream has
 * nested maps (`metadata:`) and quoted values with escapes, which a line
 * reader gets wrong. Keys the Cockpit does not read are ignored.
 */
export interface SkillFrontmatter {
  /** The skill's name; null when the frontmatter has none, and the folder name stands in. */
  readonly name: string | null
  readonly description: string
  /** `disable-model-invocation: true` marks a user-invoked skill, the ones the Cockpit lists. */
  readonly userInvoked: boolean
}

const FENCE = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

export function readSkillFrontmatter(text: string): Decoded<SkillFrontmatter | null> {
  const unreadable = (detail: string): Decoded<null> => ({
    value: null,
    warnings: [warn('skill-unreadable', detail)],
  })

  const fenced = FENCE.exec(text)
  if (fenced?.[1] === undefined) return unreadable('no frontmatter between --- lines')

  let yaml: unknown
  try {
    yaml = parseYAML(fenced[1])
  } catch (error) {
    return unreadable(messageOf(error))
  }
  if (yaml === null || typeof yaml !== 'object' || Array.isArray(yaml)) {
    return unreadable('frontmatter is not a map')
  }

  const fields = yaml as Record<string, unknown>
  const { name, description } = fields
  if (typeof description !== 'string') return unreadable('no description')
  if (name !== undefined && typeof name !== 'string') return unreadable('name is not text')

  return {
    value: {
      name: name ?? null,
      description,
      userInvoked: fields['disable-model-invocation'] === true,
    },
    warnings: [],
  }
}
