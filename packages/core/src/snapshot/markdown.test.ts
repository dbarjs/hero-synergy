import { describe, expect, test } from 'vite-plus/test'

import {
  entries,
  firstH1,
  issueNumber,
  linkedNumbers,
  sections,
  taskListNumbers,
} from './markdown.ts'

describe('sections', () => {
  test('splits at H2 headings, keeps what precedes them, and ignores headings inside fences', () => {
    const body =
      'Part of #1\n\n## Question\n\nWhy?\n\n```md\n## not a heading\n```\n\n## Decisions-so-far ##\n\n- x\n<!-- ## nor this -->\n'
    expect(sections(body)).toEqual([
      { heading: '', key: '', text: 'Part of #1' },
      { heading: 'Question', key: 'question', text: 'Why?\n\n```md\n## not a heading\n```' },
      { heading: 'Decisions-so-far', key: 'decisions so far', text: '- x' },
    ])
  })

  test('finds the first H1 only', () => {
    expect(firstH1('intro\n\n# Title here\n\n# Second\n')).toBe('Title here')
    expect(firstH1('## Only an H2\n')).toBeNull()
  })
})

describe('entries', () => {
  test('joins continuation lines, skips task items and loose paragraphs', () => {
    const text =
      '- first line\n  continues here\n- second\n\nA paragraph that is not an entry.\n\n* third\n- [ ] #4\n- [x] #5\n'
    expect(entries(text)).toEqual(['first line continues here', 'second', 'third'])
  })

  test('lists task items by number, from `#n` and from issue URLs', () => {
    expect(
      taskListNumbers('- [ ] #4\n- [x] https://github.com/a/b/issues/5\n- [ ] not one\n'),
    ).toEqual([4, 5])
  })
})

describe('issue numbers', () => {
  test('reads `#n`, issue URLs with or without a fragment, and local ticket paths', () => {
    expect(issueNumber('#12')).toBe(12)
    expect(issueNumber('https://github.com/a/b/issues/12')).toBe(12)
    expect(issueNumber('https://github.com/a/b/issues/12#issuecomment-1')).toBe(12)
    expect(issueNumber('issues/03-foo-bar.md')).toBe(3)
    expect(issueNumber('./issues/03-foo-bar.md')).toBe(3)
    expect(issueNumber('https://github.com/a/b/pull/12')).toBeNull()
    expect(issueNumber('https://github.com/a/b/issues/12/linked_branches')).toBe(12)
    expect(issueNumber('https://github.com/a/b/issues/123abc')).toBeNull()
    expect(issueNumber('docs/seed.md#destination')).toBeNull()
  })

  test('collects the numbers a text links, once each, in order', () => {
    expect(
      linkedNumbers(
        'See [a](https://github.com/a/b/issues/3) and [b](https://github.com/a/b/issues/2), again [a](https://github.com/a/b/issues/3), not [c](https://x.dev/issues).',
      ),
    ).toEqual([3, 2])
  })
})
