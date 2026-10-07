import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { readClaudeVersion, readPluginList, readRegistry } from '@hero-synergy/core'

import { run, transcript } from './exec.ts'
import type { Failure, Report } from './report.ts'

/** Every launch flag in the register's table, and the row each one lives in. */
export const launchFlags: ReadonlyArray<{ flag: string; row: string }> = [
  { flag: '--name', row: "Launch flags › `-n`, `--name <name>` sets the session's display name" },
  { flag: '--resume', row: 'Launch flags › `--resume <session-id>` works from the workspace root' },
  {
    flag: '--worktree',
    row: 'Launch flags › `-w`, `--worktree <name>` creates `.claude/worktrees/<name>`',
  },
  {
    flag: '--plugin-dir',
    row: 'Launch flags › `--plugin-dir <path>` loads a plugin from a directory',
  },
]

const installTarget = 'mattpocock-skills@claude-plugins-official'
const marketplaceName = 'claude-plugins-official'
const marketplaceSource = 'anthropics/claude-plugins-official'

const rows = {
  version: 'Claude Code › the floor reads `claude --version` as x.y.z',
  registry:
    'The registry › `claude agents --json` lists interactive sessions as JSON, without a TTY',
  install: 'Plugins and skills › `claude plugin install <plugin>`, the install Action',
  list: 'Plugins and skills › `claude plugin list --json` returns `id`, `version`, `scope`, `enabled` and `installPath`',
}

/** The launch flags missing from `claude --help`. A flag only counts as present as a whole word. */
export function missingFlags(help: string): Failure[] {
  return launchFlags
    .filter(({ flag }) => !new RegExp(`(^|[^-\\w])${flag}(?![-\\w])`, 'm').test(help))
    .map(({ flag, row }) => ({
      contract: `help ${flag}`,
      row,
      error: `\`claude --help\` no longer lists ${flag}`,
    }))
}

/** `claude agents --json` against the registry schema. Warnings are what the Cockpit would choke on. */
export function registryFailures(stdout: string): Failure[] {
  const decoded = readRegistry(stdout)
  return decoded.warnings.map((warning) => ({
    contract: 'agents --json',
    row: rows.registry,
    error: `${warning.code}: ${warning.detail ?? ''}`,
  }))
}

/** `claude plugin list --json` against the install schema, with the plugin the install put there. */
export function pluginListFailures(stdout: string): Failure[] {
  const decoded = readPluginList(stdout)
  const failures: Failure[] = decoded.warnings.map((warning) => ({
    contract: 'plugin list --json',
    row: rows.list,
    error: `${warning.code}: ${warning.detail ?? ''}`,
  }))
  if (failures.length === 0 && !decoded.value.some((plugin) => plugin.id === installTarget)) {
    failures.push({
      contract: 'plugin list --json',
      row: rows.list,
      error: `${installTarget} is not in the list after the install`,
    })
  }
  return failures
}

/**
 * The `claude` job's contracts, run on the native install with no login: `--version`, `--help`,
 * `agents --json`, then the marketplace install and `plugin list --json`. New fields and new
 * flags never fail anything; only a missing one, or a schema that stops decoding, does.
 */
export async function checkClaude(): Promise<Report> {
  const failures: Failure[] = []
  let output = ''
  const call = async (args: string[], cwd?: string) => {
    const ran = await run('claude', args, { cwd, timeoutMs: 180_000 })
    output += transcript('claude', args, ran)
    return ran
  }

  const version = await call(['--version'])
  const parsed = version.code === 0 ? readClaudeVersion(version.stdout) : null
  const versionText =
    parsed?.value == null
      ? 'unknown'
      : `${parsed.value.major}.${parsed.value.minor}.${parsed.value.patch}`
  if (parsed === null || parsed.value === null) {
    failures.push({
      contract: '--version',
      row: rows.version,
      error:
        version.code === 0
          ? `unreadable: ${version.stdout.slice(0, 200)}`
          : `exit ${version.code}: ${version.stderr.slice(0, 300)}`,
    })
  }

  const help = await call(['--help'])
  // The flag listing is long and says nothing when every flag is there: keep the capture short.
  output =
    output.slice(0, output.lastIndexOf('$ claude --help')) +
    `$ claude --help\n[${help.stdout.split('\n').length} lines, exit ${help.code}]\n`
  if (help.code !== 0) {
    failures.push({
      contract: '--help',
      row: launchFlags[0]!.row,
      error: `exit ${help.code}: ${help.stderr.slice(0, 300)}`,
    })
  } else {
    failures.push(...missingFlags(help.stdout))
  }

  // An empty folder outside any trust: the registry prints `[]` there and exits 0 (the register's row).
  const scratch = await mkdtemp(path.join(tmpdir(), 'canary-claude-'))
  const agents = await call(['agents', '--json'], scratch)
  if (agents.code !== 0) {
    failures.push({
      contract: 'agents --json',
      row: rows.registry,
      error: `exit ${agents.code}: ${agents.stderr.slice(0, 300)}`,
    })
  } else {
    failures.push(...registryFailures(agents.stdout))
  }

  // A fresh runner knows no marketplace: refresh it, or add it when it is not there yet.
  const marketplace = marketplaceName
  const refreshed = await call(['plugin', 'marketplace', 'update', marketplace], scratch)
  if (refreshed.code !== 0) {
    const added = await call(['plugin', 'marketplace', 'add', marketplaceSource], scratch)
    if (added.code !== 0) {
      failures.push({
        contract: 'plugin marketplace add',
        row: rows.install,
        error: `exit ${added.code}: ${(added.stderr || added.stdout).slice(0, 300)}`,
      })
    }
  }

  const install = await call(['plugin', 'install', installTarget], scratch)
  if (install.code !== 0) {
    failures.push({
      contract: 'plugin install',
      row: rows.install,
      error: `exit ${install.code}: ${(install.stderr || install.stdout).slice(0, 300)}`,
    })
  }

  const list = await call(['plugin', 'list', '--json'], scratch)
  if (list.code !== 0) {
    failures.push({
      contract: 'plugin list --json',
      row: rows.list,
      error: `exit ${list.code}: ${list.stderr.slice(0, 300)}`,
    })
  } else if (install.code === 0) {
    failures.push(...pluginListFailures(list.stdout))
  } else {
    failures.push(
      ...pluginListFailures(list.stdout).filter(
        (failure) => !failure.error.includes('is not in the list'),
      ),
    )
  }

  return {
    upstream: 'claude',
    version: versionText,
    seen: { installer: 'native, latest' },
    failures,
    output,
  }
}
