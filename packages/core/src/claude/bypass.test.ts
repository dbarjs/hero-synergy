import { describe, expect, it } from 'vite-plus/test'

import { DEFAULT_TRIAGE_LABELS, type TriageLabels } from '../scout/triage-labels.ts'
import type { TicketType, TriageRole } from '../snapshot/model.ts'
import {
  type BypassHealthInput,
  type BypassMode,
  bypassModeOf,
  bypassModes,
  type BypassPolicy,
  type BypassTarget,
  bypasses,
  bypassHealth,
  isAfkTicket,
  NO_BYPASS,
} from './bypass.ts'
import { healthEntryOf } from './health.ts'
import type { Isolation } from './isolation.ts'

const RENAMED: TriageLabels = { readyForAgent: 'agent: go', readyForHuman: 'human only' }

const TYPES: ReadonlyArray<TicketType | null> = ['research', 'task', 'prototype', 'grilling', null]

describe('isAfkTicket', () => {
  describe.each([
    ['the default labels', DEFAULT_TRIAGE_LABELS],
    ['renamed labels', RENAMED],
  ] as const)('with %s', (_, triage) => {
    const cases = TYPES.flatMap((type) =>
      [false, true].flatMap((agent) =>
        [false, true].map((human) => {
          const afk = !human && (agent || type === 'research' || type === 'task')
          return [type ?? 'untyped', agent, human, afk, type] as const
        }),
      ),
    )
    it.each(cases)(
      '%s, ready-for-agent %s, ready-for-human %s: AFK %s',
      (_name, agent, human, afk, type) => {
        const labels = [
          ...(type === null ? [] : [`wayfinder:${type}`]),
          ...(agent ? [triage.readyForAgent] : []),
          ...(human ? [triage.readyForHuman] : []),
        ]
        expect(isAfkTicket({ type, labels, role: null }, triage)).toBe(afk)
      },
    )
  })

  it('bypasses a ready-for-agent ticket whatever its type, an untyped one included', () => {
    for (const type of TYPES)
      expect(
        isAfkTicket({ type, labels: ['ready-for-agent'], role: null }, DEFAULT_TRIAGE_LABELS),
      ).toBe(true)
  })

  it('never bypasses a ready-for-human ticket, even one also labelled ready-for-agent', () => {
    for (const type of TYPES)
      expect(
        isAfkTicket(
          { type, labels: ['ready-for-agent', 'ready-for-human'], role: null },
          DEFAULT_TRIAGE_LABELS,
        ),
      ).toBe(false)
  })

  it('reads only the repo’s label strings, not the default names', () => {
    expect(
      isAfkTicket({ type: 'grilling', labels: ['ready-for-agent'], role: null }, RENAMED),
    ).toBe(false)
    expect(isAfkTicket({ type: 'task', labels: ['ready-for-human'], role: null }, RENAMED)).toBe(
      true,
    )
  })

  describe("a local ticket's triage role, read in the default names whatever the repo renames", () => {
    const ROLES: ReadonlyArray<TriageRole | null> = [
      'ready-for-agent',
      'ready-for-human',
      'needs-triage',
      'needs-info',
      'wontfix',
      null,
    ]
    const cases = [DEFAULT_TRIAGE_LABELS, RENAMED].flatMap((triage) =>
      TYPES.flatMap((type) =>
        ROLES.map((role) => {
          const afk =
            role === 'ready-for-human'
              ? false
              : role === 'ready-for-agent' || type === 'research' || type === 'task'
          return [type ?? 'untyped', role, triage === RENAMED, afk, type, triage] as const
        }),
      ),
    )
    it.each(cases)(
      '%s, role %s, renamed labels %s: AFK %s',
      (_name, role, _renamed, afk, type, triage) => {
        expect(isAfkTicket({ type, labels: [], role }, triage)).toBe(afk)
      },
    )

    it('keeps a ready-for-human ticket HITL whatever its labels say', () => {
      for (const triage of [DEFAULT_TRIAGE_LABELS, RENAMED])
        for (const type of TYPES)
          expect(
            isAfkTicket(
              { type, labels: [triage.readyForAgent, 'ready-for-agent'], role: 'ready-for-human' },
              triage,
            ),
          ).toBe(false)
    })

    it('keeps a ready-for-agent ticket HITL when it is also labelled for a human', () => {
      for (const triage of [DEFAULT_TRIAGE_LABELS, RENAMED])
        expect(
          isAfkTicket(
            { type: 'grilling', labels: [triage.readyForHuman], role: 'ready-for-agent' },
            triage,
          ),
        ).toBe(false)
    })
  })
})

const ISOLATED: Isolation = {
  isolated: true,
  signal: { kind: 'remote', remoteName: 'dev-container' },
}
const LOCAL: Isolation = { isolated: false, vetoedBy: null, remoteName: null }

describe('bypasses', () => {
  const TARGETS: ReadonlyArray<readonly [string, BypassTarget]> = [
    ['an AFK ticket Action', { kind: 'ticket', afk: true }],
    ['a HITL ticket Action', { kind: 'ticket', afk: false }],
    ['a plain Action', { kind: 'plain' }],
    ['an install', { kind: 'install' }],
  ]
  /** What each mode adds, before the gate: the table of the spec. */
  const BY_MODE: Readonly<Record<BypassMode, ReadonlyArray<boolean>>> = {
    off: [false, false, false, false],
    afkTickets: [true, false, false, false],
    allSessions: [true, true, true, false],
  }

  const cases = bypassModes.flatMap((mode) =>
    [true, false].flatMap((onlyWhenIsolated) =>
      [true, false].flatMap((isolated) =>
        TARGETS.map(([name, target], index) => {
          const gate = !onlyWhenIsolated || isolated
          return [
            mode,
            onlyWhenIsolated,
            isolated,
            name,
            target,
            gate && (BY_MODE[mode][index] ?? false),
          ] as const
        }),
      ),
    ),
  )

  it.each(cases)(
    '%s, only when isolated %s, isolated %s, %s: %s',
    (mode, onlyWhenIsolated, isolated, _name, target, expected) => {
      const policy: BypassPolicy = {
        mode,
        onlyWhenIsolated,
        isolation: isolated ? ISOLATED : LOCAL,
      }
      expect(bypasses(policy, target)).toBe(expected)
    },
  )

  it('never bypasses with the defaults', () => {
    for (const [, target] of TARGETS) expect(bypasses(NO_BYPASS, target)).toBe(false)
  })
})

describe('bypassModeOf', () => {
  it.each([
    ['off', 'off'],
    ['afkTickets', 'afkTickets'],
    ['allSessions', 'allSessions'],
    ['afkSessions', 'off'],
    [undefined, 'off'],
    [true, 'off'],
  ] as const)('reads %s as %s', (value, mode) => {
    expect(bypassModeOf(value)).toBe(mode)
  })
})

describe('bypassHealth', () => {
  const base: BypassHealthInput = {
    bypassPermissions: 'afkTickets',
    onlyWhenIsolated: true,
    isolation: ISOLATED,
    root: false,
    sandboxEnv: false,
  }
  const codes = (input: Partial<BypassHealthInput>) =>
    bypassHealth({ ...base, ...input }).map(({ code, detail }) => ({ code, detail }))

  it('raises nothing while the setting is off, whatever the window', () => {
    for (const isolation of [ISOLATED, LOCAL])
      for (const root of [false, true])
        expect(codes({ bypassPermissions: 'off', isolation, root })).toEqual([])
  })

  it('raises nothing in an isolated window as a normal user', () => {
    expect(codes({})).toEqual([])
    expect(codes({ bypassPermissions: 'allSessions' })).toEqual([])
  })

  it.each([
    ['ssh-remote', null, 'Remote-SSH, no container marker'],
    ['wsl', null, 'WSL, no container marker'],
    ['tunnel', null, 'Remote Tunnel, no container marker'],
    [null, null, 'local window, no container marker'],
    ['some-remote', null, 'some-remote, no container marker'],
    [null, '/run/.toolboxenv', 'local window, a toolbx or distrobox container'],
    ['ssh-remote', '/run/.toolboxenv', 'Remote-SSH, a toolbx or distrobox container'],
  ] as const)(
    'says where and why a %s window with veto %s is not isolated: %s',
    (remoteName, vetoedBy, detail) => {
      expect(codes({ isolation: { isolated: false, remoteName, vetoedBy } })).toEqual([
        { code: 'bypass-not-isolated', detail },
      ])
    },
  )

  it('raises no not-isolated warning once the gate is off, and checks root instead', () => {
    expect(codes({ onlyWhenIsolated: false, isolation: LOCAL })).toEqual([])
    expect(codes({ onlyWhenIsolated: false, isolation: LOCAL, root: true })).toEqual([
      { code: 'bypass-refused-as-root', detail: null },
    ])
  })

  it('raises the root warning only when the flag would be added', () => {
    expect(codes({ root: true })).toEqual([{ code: 'bypass-refused-as-root', detail: null }])
    // Not isolated with the gate on: no flag, so only the not-isolated warning.
    expect(codes({ root: true, isolation: LOCAL })).toEqual([
      { code: 'bypass-not-isolated', detail: 'local window, no container marker' },
    ])
  })

  it('raises no root warning when a sandbox variable is set', () => {
    expect(codes({ root: true, sandboxEnv: true })).toEqual([])
  })

  describe('across setting × gate × isolation × root × sandbox env', () => {
    // Each window, with the detail `bypass-not-isolated` names when it is not isolated.
    const windows: ReadonlyArray<readonly [string, Isolation, string | null]> = [
      ['a dev container', ISOLATED, null],
      [
        'a Docker container',
        { isolated: true, signal: { kind: 'marker', path: '/.dockerenv' } },
        null,
      ],
      [
        'a Podman container',
        { isolated: true, signal: { kind: 'marker', path: '/run/.containerenv' } },
        null,
      ],
      ...(
        [
          ['ssh-remote', 'Remote-SSH'],
          ['wsl', 'WSL'],
          ['tunnel', 'Remote Tunnel'],
          [null, 'local window'],
          ['some-remote', 'some-remote'],
        ] as const
      ).flatMap(([remoteName, where]) =>
        (
          [
            [null, 'no container marker'],
            ['/run/.toolboxenv', 'a toolbx or distrobox container'],
          ] as const
        ).map(
          ([vetoedBy, why]) =>
            [
              `${where}${vetoedBy === null ? '' : ' in toolbx'}`,
              { isolated: false, remoteName, vetoedBy },
              `${where}, ${why}`,
            ] as const,
        ),
      ),
    ]
    const cases = bypassModes.flatMap((mode) =>
      [true, false].flatMap((gate) =>
        windows.flatMap(([where, isolation, detail]) =>
          [false, true].flatMap((root) =>
            [false, true].map((sandboxEnv) => {
              const raised =
                mode === 'off'
                  ? []
                  : gate && detail !== null
                    ? [{ code: 'bypass-not-isolated', detail }]
                    : root && !sandboxEnv
                      ? [{ code: 'bypass-refused-as-root', detail: null }]
                      : []
              return [mode, gate, where, root, sandboxEnv, raised, isolation] as const
            }),
          ),
        ),
      ),
    )

    it.each(cases)(
      '%s, gate %s, %s, root %s, sandbox env %s: %j',
      (bypassPermissions, onlyWhenIsolated, _where, root, sandboxEnv, raised, isolation) => {
        expect(codes({ bypassPermissions, onlyWhenIsolated, isolation, root, sandboxEnv })).toEqual(
          raised,
        )
      },
    )
  })

  it('words both entries as the spec does, the root hint never naming IS_SANDBOX', () => {
    const [notIsolated] = bypassHealth({ ...base, isolation: LOCAL })
    const [asRoot] = bypassHealth({ ...base, root: true })
    if (notIsolated === undefined || asRoot === undefined) throw new Error('raised nothing')
    expect(healthEntryOf(notIsolated, { claude: null })).toEqual({
      code: 'bypass-not-isolated',
      level: 'quiet',
      message:
        'Bypass permissions is on, but this window is not an isolated environment (local window, no container marker), so sessions keep their permission prompts.',
      detail: 'local window, no container marker',
      hint: 'Reopen the folder in a Dev Container, or turn off heroSynergy.sessions.bypassPermissionsOnlyWhenIsolated.',
    })
    const root = healthEntryOf(asRoot, { claude: null })
    expect(root).toEqual({
      code: 'bypass-refused-as-root',
      level: 'loud',
      message:
        'Claude Code refuses bypass permissions as root, so bypassed sessions exit as soon as they start.',
      detail: null,
      hint: "Run the window as a non-root user (a devcontainer's `remoteUser`), or set heroSynergy.sessions.bypassPermissions to off.",
    })
    expect(root.hint).not.toMatch(/IS_SANDBOX|BUBBLEWRAP/)
  })
})
