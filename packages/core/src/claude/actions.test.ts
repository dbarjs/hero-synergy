import { describe, expect, test } from 'vite-plus/test'

import {
  chartMap,
  installPlugin,
  installWithNpx,
  launchFresh,
  setup,
  renderCommand,
  resumeById,
  resumeByName,
  resumeEnded,
  runSkill,
  shellQuote,
  toSpec,
  workTicket,
  type LaunchContext,
} from './actions.ts'

const commands = { wayfinder: '/mattpocock-skills:wayfinder', toSpec: '/mattpocock-skills:to-spec' }

const context = (tracker: LaunchContext['tracker']): LaunchContext => ({
  repoRoot: '/work/billing',
  tracker,
  pluginPath: '/home/ana/.vscode/extensions/dbarjs.hero-synergy-0.1.0/claude-plugin',
  eventsFile: '/home/ana/.hero synergy/events.jsonl',
})

const github = {
  map: { ref: { tracker: 'github', url: 'https://github.com/acme/billing/issues/10' } },
  ticket: {
    number: 12,
    title: 'Discover skills',
    ref: { tracker: 'github', url: 'https://github.com/acme/billing/issues/12' },
  },
} as const

const local = {
  map: { ref: { tracker: 'local', path: '.scratch/billing/map.md' } },
  ticket: {
    number: 3,
    title: 'Pick a queue',
    ref: { tracker: 'local', path: '.scratch/billing/tickets/03-pick-a-queue.md' },
  },
} as const

describe('shellQuote', () => {
  test.each([
    ['plain', 'plain'],
    ['/a/b-c_d.e:f', '/a/b-c_d.e:f'],
    ['two words', "'two words'"],
    ['#12 title', "'#12 title'"],
    ["it's", `'it'\\''s'`],
    ['say "hi"', `'say "hi"'`],
    ['', "''"],
    ['$HOME `x`', "'$HOME `x`'"],
  ])('%s becomes %s', (word, quoted) => {
    expect(shellQuote(word)).toBe(quoted)
  })
})

describe('Work ticket', () => {
  test('on GitHub names the session, takes a worktree and carries the issue URLs', () => {
    const launch = workTicket(context('github'), commands, github)
    expect(launch.argv).toEqual([
      'claude',
      '-n',
      '#12 Discover skills',
      '-w',
      '12',
      '--plugin-dir',
      '/home/ana/.vscode/extensions/dbarjs.hero-synergy-0.1.0/claude-plugin',
      '/mattpocock-skills:wayfinder https://github.com/acme/billing/issues/10 https://github.com/acme/billing/issues/12',
    ])
    expect(launch.cwd).toBe('/work/billing')
    expect(launch.env).toEqual({
      HERO_SYNERGY_TICKET: '12',
      HERO_SYNERGY_EVENTS: '/home/ana/.hero synergy/events.jsonl',
    })
    expect(launch.command).toBe(
      "claude -n '#12 Discover skills' -w 12 --plugin-dir /home/ana/.vscode/extensions/dbarjs.hero-synergy-0.1.0/claude-plugin '/mattpocock-skills:wayfinder https://github.com/acme/billing/issues/10 https://github.com/acme/billing/issues/12'",
    )
    expect(launch.envLine).toBe(
      "env: HERO_SYNERGY_TICKET=12 HERO_SYNERGY_EVENTS='/home/ana/.hero synergy/events.jsonl'",
    )
  })

  test('on a local tracker has no -w and carries repo-relative paths', () => {
    const launch = workTicket(context('local'), commands, local)
    expect(launch.argv).not.toContain('-w')
    expect(launch.command).toBe(
      "claude -n '#3 Pick a queue' --plugin-dir /home/ana/.vscode/extensions/dbarjs.hero-synergy-0.1.0/claude-plugin '/mattpocock-skills:wayfinder .scratch/billing/map.md .scratch/billing/tickets/03-pick-a-queue.md'",
    )
    expect(launch.env.HERO_SYNERGY_TICKET).toBe('3')
  })

  test('keeps a title with quotes, spaces and a # as one argument', () => {
    const ticket = { ...github.ticket, title: `Don't "quote" me #3` }
    const launch = workTicket(context('github'), commands, { ...github, ticket })
    expect(launch.argv[2]).toBe(`#12 Don't "quote" me #3`)
    expect(launch.command).toContain(`-n '#12 Don'\\''t "quote" me #3' -w 12`)
  })

  test('never uses --bg or --session-id', () => {
    const { argv } = workTicket(context('github'), commands, github)
    expect(argv).not.toContain('--bg')
    expect(argv).not.toContain('--session-id')
  })

  test('Launch fresh is the Work ticket line', () => {
    expect(launchFresh(context('github'), commands, github)).toEqual(
      workTicket(context('github'), commands, github),
    )
  })
})

describe('Resume', () => {
  test('by id keeps the name and the plugin, sets the env again and never passes --session-id', () => {
    const launch = resumeById(context('github'), github.ticket, 'a1b2-c3')
    expect(launch.argv).toEqual([
      'claude',
      '--resume',
      'a1b2-c3',
      '-n',
      '#12 Discover skills',
      '--plugin-dir',
      '/home/ana/.vscode/extensions/dbarjs.hero-synergy-0.1.0/claude-plugin',
    ])
    expect(launch.command).toBe(
      "claude --resume a1b2-c3 -n '#12 Discover skills' --plugin-dir /home/ana/.vscode/extensions/dbarjs.hero-synergy-0.1.0/claude-plugin",
    )
    expect(launch.cwd).toBe('/work/billing')
    expect(launch.env.HERO_SYNERGY_TICKET).toBe('12')
    expect(launch.argv).not.toContain('--session-id')
  })

  test('by name is the name alone, with no plugin and no env', () => {
    const launch = resumeByName(context('github'), github.ticket)
    expect(launch.argv).toEqual(['claude', '--resume', '#12 Discover skills'])
    expect(launch.command).toBe("claude --resume '#12 Discover skills'")
    expect(launch.env).toEqual({})
    expect(launch.envLine).toBeNull()
  })

  test('an ended session is resumed by id when one is known, else by name', () => {
    const known = resumeEnded(context('github'), github.ticket, 'a1b2-c3')
    expect(known.by).toBe('id')
    expect(known.launch).toEqual(resumeById(context('github'), github.ticket, 'a1b2-c3'))

    const unknown = resumeEnded(context('github'), github.ticket, null)
    expect(unknown.by).toBe('name')
    expect(unknown.launch).toEqual(resumeByName(context('github'), github.ticket))
  })
})

describe('ticketless Actions', () => {
  test('To spec takes the map URL on GitHub and its path locally, in a plain terminal', () => {
    const onGithub = toSpec(context('github'), commands, github.map)
    expect(onGithub.command).toBe(
      "claude '/mattpocock-skills:to-spec https://github.com/acme/billing/issues/10'",
    )
    expect(onGithub.envLine).toBeNull()
    expect(toSpec(context('local'), commands, local.map).command).toBe(
      "claude '/mattpocock-skills:to-spec .scratch/billing/map.md'",
    )
  })

  test('Chart a map names the session and passes the bare wayfinder command', () => {
    const launch = chartMap(context('github'), commands)
    expect(launch.argv).toEqual(['claude', '-n', 'Chart a map', '/mattpocock-skills:wayfinder'])
    expect(launch.command).toBe("claude -n 'Chart a map' /mattpocock-skills:wayfinder")
    expect(launch.env).toEqual({})
    expect(launch.cwd).toBe('/work/billing')
  })

  test('Run skill passes the command by itself', () => {
    const launch = runSkill(context('github'), '/mattpocock-skills:grill-me')
    expect(launch.command).toBe('claude /mattpocock-skills:grill-me')
    expect(launch.envLine).toBeNull()
  })

  test('Setup passes the setup command by itself, in a plain terminal', () => {
    const launch = setup(context('local'), { setup: '/setup-matt-pocock-skills' })
    expect(launch.command).toBe('claude /setup-matt-pocock-skills')
    expect(launch.env).toEqual({})
    expect(launch.cwd).toBe('/work/billing')
  })

  test('the installs are the plugin command and the npx command, in the repo', () => {
    expect(installPlugin(context('github')).command).toBe(
      'claude plugins install mattpocock-skills',
    )
    const npx = installWithNpx(context('github'))
    expect(npx.command).toBe('npx skills@latest add mattpocock/skills')
    expect(npx.cwd).toBe('/work/billing')
    expect(npx.envLine).toBeNull()
  })

  test('commands without the plugin namespace pass through as they are', () => {
    expect(chartMap(context('local'), { wayfinder: '/wayfinder' }).command).toBe(
      "claude -n 'Chart a map' /wayfinder",
    )
  })
})

describe('bypass', () => {
  const FLAG = ['--permission-mode', 'bypassPermissions']
  const withFlag = (argv: ReadonlyArray<string>) => ['claude', ...FLAG, ...argv.slice(1)]
  const builders = [
    ['Work ticket', (bypass?: boolean) => workTicket(context('github'), commands, github, bypass)],
    ['Launch fresh', (bypass?: boolean) => launchFresh(context('local'), commands, local, bypass)],
    [
      'Resume by id',
      (bypass?: boolean) => resumeById(context('github'), github.ticket, 'abc-123', bypass),
    ],
    [
      'Resume by name',
      (bypass?: boolean) => resumeByName(context('github'), github.ticket, bypass),
    ],
    [
      'an ended session by id',
      (bypass?: boolean) => resumeEnded(context('github'), github.ticket, 'abc', bypass).launch,
    ],
    [
      'an ended session by name',
      (bypass?: boolean) => resumeEnded(context('github'), github.ticket, null, bypass).launch,
    ],
    ['To spec', (bypass?: boolean) => toSpec(context('github'), commands, github.map, bypass)],
    ['Chart a map', (bypass?: boolean) => chartMap(context('github'), commands, bypass)],
    ['Run skill', (bypass?: boolean) => runSkill(context('github'), '/grilling', bypass)],
    [
      'Setup',
      (bypass?: boolean) =>
        setup(context('github'), { setup: '/setup-matt-pocock-skills' }, bypass),
    ],
  ] as const

  test.each(builders)('%s is off by default and adds the flag right after claude', (_, build) => {
    const plain = build()
    expect(build(false)).toEqual(plain)
    expect(plain.argv).not.toContain('--permission-mode')
    const bypassed = build(true)
    expect(bypassed.argv).toEqual(withFlag(plain.argv))
    expect(bypassed.command).toBe(renderCommand(bypassed.argv))
    expect(bypassed.command).toContain('claude --permission-mode bypassPermissions ')
    expect(bypassed.env).toEqual(plain.env)
    expect(bypassed.cwd).toBe(plain.cwd)
    expect(bypassed.argv).not.toContain('--dangerously-skip-permissions')
  })

  test('the installs take no bypass input and never carry the flag', () => {
    expect(installPlugin.length).toBe(1)
    expect(installWithNpx.length).toBe(1)
    expect(installPlugin(context('github')).argv).not.toContain('--permission-mode')
    expect(installWithNpx(context('github')).argv).not.toContain('--permission-mode')
  })
})

describe('renderCommand', () => {
  test('quotes each word once and joins with spaces', () => {
    expect(renderCommand(['claude', 'a b', 'c'])).toBe("claude 'a b' c")
  })
})
