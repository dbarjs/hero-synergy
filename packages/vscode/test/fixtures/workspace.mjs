import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = path.join(HERE, 'workspace')
const CORE_FIXTURES = path.join(HERE, '../../../core/fixtures')

/**
 * Copies the fixture workspace into `parent/workspace` and makes the copy a git repo of its own,
 * returning its path. The scout resolves a folder to its repo root, and the fixture sits inside
 * this repo, whose tracker is GitHub: opened in place, the window would show this repo's maps.
 * Plain `.mjs` so `.vscode-test.mjs` and the TypeScript end-to-end tier both import it.
 *
 * @param {string} parent an existing or creatable directory the copy goes into
 * @returns {string} the workspace folder to open
 */
export function createWorkspace(parent) {
  const workspace = path.join(parent, 'workspace')
  mkdirSync(workspace, { recursive: true })
  cpSync(SOURCE, workspace, { recursive: true })
  execFileSync('git', ['init', '--quiet', workspace])
  return workspace
}

/**
 * A stub `claude` for the windows that launch a session. Asked for the plugin list it answers `[]`;
 * started as a session it records what it was given, plays the script it finds, then stays open
 * like a live session:
 *
 * - `argv.txt`: one argument per line, after the program name;
 * - `env.txt`: `HERO_SYNERGY_TICKET`, then `HERO_SYNERGY_EVENTS`, one per line;
 * - `cwd.txt`: the directory it started in;
 * - `registry.json`, written by the test and served as the output of `agents --json` (`[]` while
 *   absent), the way Claude Code's registry lists live sessions;
 * - `script.txt`, written by the test before the session starts: one status event per line,
 *   `<delay in ms> <hook> [detail]`. The stub waits the delay, appends the line the status plugin
 *   would (`ticket`, `hook`, `session`, `detail`, `at`, `payload`) to `HERO_SYNERGY_EVENTS`, and
 *   notes `<hook> <epoch ms>` in `written.txt` so a test can time the Tree against the write.
 *
 * A node script, so the same stub runs wherever the tests do.
 *
 * @param {string} parent an existing or creatable directory the stub and its records go into
 * @returns {{ claude: string, argvFile: string, envFile: string, cwdFile: string, scriptFile: string, writtenFile: string, registryFile: string }}
 */
export function createClaudeStub(parent) {
  const bin = path.join(parent, 'bin')
  mkdirSync(bin, { recursive: true })
  const claude = path.join(bin, 'claude')
  const argvFile = path.join(bin, 'argv.txt')
  const envFile = path.join(bin, 'env.txt')
  const cwdFile = path.join(bin, 'cwd.txt')
  const scriptFile = path.join(bin, 'script.txt')
  const writtenFile = path.join(bin, 'written.txt')
  const registryFile = path.join(bin, 'registry.json')
  writeFileSync(
    claude,
    [
      `#!${process.execPath}`,
      `const fs = require('node:fs')`,
      `const args = process.argv.slice(2)`,
      `if (args[0] === 'plugin') {`,
      `  console.log('[]')`,
      `  process.exit(0)`,
      `}`,
      `if (args[0] === 'agents') {`,
      `  console.log(fs.existsSync(${JSON.stringify(registryFile)}) ? fs.readFileSync(${JSON.stringify(registryFile)}, 'utf8') : '[]')`,
      `  process.exit(0)`,
      `}`,
      `const ticket = process.env.HERO_SYNERGY_TICKET ?? ''`,
      `const events = process.env.HERO_SYNERGY_EVENTS ?? ''`,
      `fs.writeFileSync(${JSON.stringify(argvFile)}, args.join('\\n') + '\\n')`,
      `fs.writeFileSync(${JSON.stringify(envFile)}, ticket + '\\n' + events + '\\n')`,
      `fs.writeFileSync(${JSON.stringify(cwdFile)}, process.cwd() + '\\n')`,
      `const script = fs.existsSync(${JSON.stringify(scriptFile)})`,
      `  ? fs.readFileSync(${JSON.stringify(scriptFile)}, 'utf8').split('\\n').filter((line) => line.trim() !== '')`,
      `  : []`,
      `;(async () => {`,
      `  for (const line of script) {`,
      `    const [delay, hook, ...detail] = line.trim().split(/\\s+/)`,
      `    await new Promise((resolve) => setTimeout(resolve, Number(delay)))`,
      `    const now = new Date()`,
      `    const text = detail.join(' ') || null`,
      `    fs.appendFileSync(`,
      `      events,`,
      `      JSON.stringify({ ticket, hook, session: 'stub-session', detail: text, at: now.toISOString(), payload: {} }) + '\\n',`,
      `    )`,
      `    fs.appendFileSync(${JSON.stringify(writtenFile)}, hook + ' ' + now.getTime() + '\\n')`,
      `  }`,
      `})()`,
      `setInterval(() => {}, 3_600_000)`,
      '',
    ].join('\n'),
    { mode: 0o755 },
  )
  return { claude, argvFile, envFile, cwdFile, scriptFile, writtenFile, registryFile }
}

/**
 * The fixture workspace with the wayfinder skill in its project skills and a stub `claude` beside
 * it. The skill is added here rather than to the fixture folder, which the unit tests read as a
 * repo with no skills. The window must name the stub in the user setting `heroSynergy.claude.path`
 * (see {@link writeUserSettings}); the setting is machine-scoped, so a repo cannot set it.
 *
 * @param {string} parent an existing or creatable directory the workspace and the stub go into
 */
export function createLaunchableWorkspace(parent) {
  const workspace = createWorkspace(parent)
  const skill = path.join(workspace, '.claude', 'skills', 'wayfinder')
  mkdirSync(skill, { recursive: true })
  writeFileSync(
    path.join(skill, 'SKILL.md'),
    '---\nname: wayfinder\ndescription: Plan a map.\ndisable-model-invocation: true\n---\n# Wayfinder\n',
  )
  return { workspace, ...createClaudeStub(parent) }
}

/**
 * Writes the user settings of a VS Code user data directory before the window opens.
 *
 * @param {string} userDataDir the `--user-data-dir` the window will use
 * @param {Record<string, unknown>} settings
 */
export function writeUserSettings(userDataDir, settings) {
  mkdirSync(path.join(userDataDir, 'User'), { recursive: true })
  writeFileSync(path.join(userDataDir, 'User', 'settings.json'), JSON.stringify(settings, null, 2))
}

/**
 * A git repo whose tracker doc says GitHub and whose `origin` is this repo, for the windows that
 * exercise the GitHub collect. `gh` is a stub on the front of `PATH` that answers like the
 * recording in `packages/core/fixtures/github/<recording>.json`: its stdout, stderr and exit code.
 *
 * @param {string} parent an existing or creatable directory the repo and the stub go into
 * @param {string} recording the name of a core GitHub recording, without `.json`
 * @returns {{ workspace: string, bin: string }} the folder to open and the directory holding the stub `gh`
 */
export function createGitHubWorkspace(parent, recording) {
  const workspace = path.join(parent, 'workspace')
  mkdirSync(path.join(workspace, 'docs', 'agents'), { recursive: true })
  writeFileSync(
    path.join(workspace, 'docs', 'agents', 'issue-tracker.md'),
    '# Issue tracker: GitHub\n',
  )
  execFileSync('git', ['init', '--quiet', workspace])
  execFileSync('git', [
    '-C',
    workspace,
    'remote',
    'add',
    'origin',
    'https://github.com/dbarjs/hero-synergy.git',
  ])

  const recorded = JSON.parse(
    readFileSync(path.join(CORE_FIXTURES, 'github', `${recording}.json`), 'utf8'),
  )
  const bin = path.join(parent, 'bin')
  mkdirSync(bin, { recursive: true })
  const stdout = path.join(bin, 'gh.stdout')
  const stderr = path.join(bin, 'gh.stderr')
  writeFileSync(stdout, recorded.stdout)
  writeFileSync(stderr, recorded.stderr)
  writeFileSync(
    path.join(bin, 'gh'),
    `#!/bin/sh\ncat '${stdout}'\ncat '${stderr}' >&2\nexit ${recorded.exitCode}\n`,
    { mode: 0o755 },
  )
  return { workspace, bin }
}

/**
 * A git repo for the empty-state windows: it may carry a local tracker doc (with no map under it)
 * and project skills, each a user-invoked skill named after its folder.
 *
 * @param {string} parent an existing or creatable directory the repo goes into
 * @param {{ trackerDoc: boolean, skills: string[] }} options
 * @returns {string} the workspace folder to open
 */
export function createEmptyWorkspace(parent, { trackerDoc, skills }) {
  const workspace = path.join(parent, 'workspace')
  mkdirSync(workspace, { recursive: true })
  writeFileSync(path.join(workspace, 'README.md'), '# A repo with nothing charted\n')
  if (trackerDoc) {
    mkdirSync(path.join(workspace, 'docs', 'agents'), { recursive: true })
    writeFileSync(
      path.join(workspace, 'docs', 'agents', 'issue-tracker.md'),
      '# Issue tracker: Local Markdown\n',
    )
  }
  for (const name of skills) {
    const folder = path.join(workspace, '.claude', 'skills', name)
    mkdirSync(folder, { recursive: true })
    writeFileSync(
      path.join(folder, 'SKILL.md'),
      `---\nname: ${name}\ndescription: What ${name} does.\ndisable-model-invocation: true\n---\n# ${name}\n`,
    )
  }
  execFileSync('git', ['init', '--quiet', workspace])
  return workspace
}

/**
 * A git repo with no tracker doc, so the Tree shows the setup message.
 *
 * @param {string} parent an existing or creatable directory the repo goes into
 * @returns {string} the workspace folder to open
 */
export function createBareWorkspace(parent) {
  const workspace = path.join(parent, 'workspace')
  mkdirSync(workspace, { recursive: true })
  writeFileSync(path.join(workspace, 'README.md'), '# A repo with no tracker doc\n')
  execFileSync('git', ['init', '--quiet', workspace])
  return workspace
}
