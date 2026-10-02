# hero-synergy: project context

> **Frozen on 2026-10-02.** This file was the loose idea handed to `/wayfinder` and is kept as reference material. It is no longer updated: the wayfinder map on the issue tracker (the issue labelled `wayfinder:map`) is the live index of decisions and fog, and the glossary lives in the root `CONTEXT.md`. Where "this file" or `CONTEXT.md` below means the seed, read `docs/seed.md`.

Seed document for [`dbarjs/hero-synergy`](https://github.com/dbarjs/hero-synergy). Read it before planning or writing code. Facts about third-party tools were verified on **2026-10-02**; re-check anything that matters if this file is months old.

**Tags:** `[E]` decided by Eduardo · `[P]` proposed in conversation, a default to challenge in a grilling session · `[?]` open

## How to use this file

- **Agents:** treat `[E]` as requirements, `[P]` as defaults you may question, and `[?]` as questions to resolve before building on them. Record resolved decisions as ADRs in `docs/adr/` and update this file.
- **Planning:** run `/wayfinder` with this file as the loose idea. Destination, Decisions so far, Not yet specified and Out of scope map onto the wayfinder map body.
- **Language:** the Language section follows the GLOSSARY format from `mattpocock/skills`. When `/domain-modeling` creates `GLOSSARY.md`, move the section there and leave a link.

## Pitch

hero-synergy is an unofficial VS Code cockpit for Matt Pocock's agent skills ([mattpocock/skills](https://github.com/mattpocock/skills)). It reads the wayfinder maps on a repo's issue tracker, shows which tickets can be taken right now, and opens one named Claude Code CLI session per ticket in a VS Code terminal, with live status for each.

The pain it removes: driving a big `/wayfinder` map by hand means finding the frontier, opening terminals, pasting `/wayfinder <map> <ticket>` lines, and remembering which session is waiting for you.

The name: AI Hero is Matt's brand, and a hero with many skills needs synergy. Tagline: *A hero with this many skills needs synergy.*

## Destination

hero-synergy **v0.1.0**, published from CI with combined release notes, where a developer can:

1. install the VS Code extension and open a repo that uses Matt's skills;
2. see every wayfinder map in it: frontier, blocked tickets (with blocker names), claims, decisions and fog;
3. launch any frontier ticket as a named `claude` session in a VS Code terminal and follow its live status (working, waiting for you, needs approval, failed, ended);
4. run Matt's user-invoked skills from context-aware actions;
5. refresh automatically, or on demand.

hero-synergy itself is planned with `/wayfinder` in public, and the first demo is the Cockpit showing its own map.

## Principles

1. **Lens, not layer.** `[P]` The tracker is the source of truth for work, and Claude Code is the source of truth for sessions. hero-synergy keeps only caches; uninstalling it leaves every map and session intact.
2. **The Cockpit never writes to the tracker.** `[P]` Claims and resolutions happen inside sessions, through the skills.
3. **Only a human fires a user-invoked skill.** `[P]` One click is one invocation. No automatic chains (Matt's invocation rule).
4. **Show the command.** `[P]` Every action displays the exact command it will run.
5. **Refer by name.** `[P]` Ticket titles everywhere; ids ride inside names (wayfinder's rule).
6. **Facts beat inference.** `[P]` Tracker API facts override anything a model infers.
7. **Only the allowed building blocks.** `[E]` The issue tracker, Matt's skills, the Claude CLI, the Claude Agent SDK (only if needed), background processes, and the VS Code extension API with its terminals. No Claude Code agent view, no official Claude Code VS Code extension, no sandcastle.

## Language

**Cockpit**:
The hero-synergy VS Code view that shows a repo's maps, live sessions and available actions.
_Avoid_: dashboard, control panel

**Map**:
A wayfinder map: the issue labelled `wayfinder:map` (or `.scratch/<effort>/map.md` on a local tracker) that indexes one effort's decisions.
_Avoid_: board, plan, epic

**Ticket**:
A child issue of a map holding one question, typed by a `wayfinder:<type>` label: research, prototype, grilling or task.
_Avoid_: card, story

**Frontier**:
The open, unblocked, unclaimed tickets of a map. The first one in map order is next.
_Avoid_: backlog, ready list

**Claim**:
The assignment of a ticket to the developer driving the map, made by the session before any work.
_Avoid_: lock, reservation

**Fog**:
In-scope work too vague to ticket yet, written in the map's "Not yet specified" section.
_Avoid_: backlog, unknowns

**Destination**:
What reaching the end of a map looks like. It fixes the map's scope.

**Tracker**:
Where a repo's issues live, as recorded by `/setup-matt-pocock-skills` in `docs/agents/issue-tracker.md`: GitHub, GitLab, local markdown or another tool.
_Avoid_: backend, issue host

**Scout**:
The background pipeline that turns a tracker's contents into a snapshot: collect with code, interpret with a fast model, reconcile with code.
_Avoid_: crawler, analyzer, sync

**Snapshot**:
The typed, normalized state of every map in a repo at one moment.
_Avoid_: state dump

**Drift**:
Any way a map or ticket differs from the current wayfinder conventions: legacy labels, text fallbacks, free-form markdown.
_Avoid_: corruption, invalid map

**Session**:
One Claude Code CLI process in a VS Code terminal, launched by the Cockpit for one ticket or action and named after it.
_Avoid_: agent, run, job

**Status event**:
One line the session plugin's hooks append when a session starts, works, waits, needs approval, fails or ends.
_Avoid_: log line, heartbeat

**Action**:
A user-invoked skill the Cockpit offers in a given context, shown with the exact command it will run.
_Avoid_: command, button

### Relationships

- A tracker holds many maps; a map holds many tickets.
- The scout reads one tracker and produces one snapshot.
- An action launches a session; a ticket has at most one live session.
- A session emits status events.

### Flagged ambiguities

- "task" is both a ticket type and everyday English: say "task ticket" for the type.
- "Background session" in this project means the scout's child process, never `claude --bg`.

## Decisions so far

### Product and UX

- `[E]` Name `hero-synergy`; npm organization `hero-synergy`; repository `dbarjs/hero-synergy`; MIT license.
- `[E]` The UI is an independent VS Code view, the Cockpit, with a maps view and context-aware actions. It refreshes automatically and on demand.
- `[E]` Sessions are plain `claude` CLI processes started with arguments in VS Code terminals.
- `[E]` Wayfinder labels are the backbone of discovery. An AI check with a fast model is preferred over brittle parsing, because map and ticket markdown varies between projects and skill versions.
- `[P]` The webview is a Vue 3 app built with Vite+.
- `[P]` hero-synergy calls itself an unofficial companion: no Matt or AI Hero logos, no `@ai-hero` scope.

### Architecture

- `[P]` The scout is a hybrid pipeline: collect (code), interpret (Haiku through `claude -p`), reconcile (code). See [The scout](#the-scout).
- `[P]` Live status comes from a small Claude Code plugin the extension loads into each session with `--plugin-dir`. See [Live status](#live-status).
- `[P]` Actions are discovered from the installed skills' `SKILL.md` frontmatter, not hardcoded. See [Actions](#actions).
- `[P]` The extension declares `"extensionKind": ["workspace"]`, so the scout, `gh` and `claude` run next to the repo (dev containers, SSH, WSL).
- `[P]` The scout spawns the user's own `claude` binary. The Agent SDK sits behind the same `ScoutRunner` interface as a fallback, because Anthropic asks third-party products built on the SDK to use API keys rather than claude.ai login.

### Stack

- `[E]` TypeScript 7, Vite+ (with Oxlint and Oxfmt), UnJS libraries, pnpm, zod, Nitro, Effect v4, Node.js 26. See [Stack](#stack).
- `[P]` zod owns data that crosses a boundary: the snapshot schema (converted to JSON Schema for `--json-schema`), config, and webview messages. Effect owns workflows: the scout pipeline, child processes, file watching, scheduling, retries and cancellation.

### Packages and releases

- `[P]` Three packages: `@hero-synergy/core` (npm), `@hero-synergy/cli` (npm, bin `hero-synergy`), and `hero-synergy` (the VS Code extension, private on npm).
- `[E]` Publish the npm packages and the VS Code extension from GitHub Actions, with simple `package.json` scripts and great release notes.
- `[P]` Changesets v3 with fixed versioning (one version for everything) and one combined GitHub release per version. npm uses trusted publishing (no tokens). The VS Code Marketplace uses Microsoft Entra ID; Open VSX uses trusted publishing. Each registry is switched on with a repository variable.

## Architecture

### Packages

- **`@hero-synergy/core`**: Language terms as types, tracker adapters (GitHub through `gh`, local `.scratch`), the scout, the frontier function, action discovery, and the launch-command builder. No `vscode` imports. Pure functions where possible; Effect at the edges.
- **`@hero-synergy/cli`**: a thin wrapper over core for scripts and for agents inside sessions, for example `hero-synergy snapshot --json`, `hero-synergy frontier`, `hero-synergy launch <ticket>`. `[?]` whether it ships in v0.1.0.
- **`hero-synergy`** (VS Code extension): the Cockpit webview, terminal management, the status watcher, and the bundled session plugin in `claude-plugin/`.

```
tracker (GitHub, .scratch) ──collect──> scout ──interpret (claude -p, haiku)──> reconcile ──> snapshot ──> Cockpit
Cockpit action ──> VS Code terminal: claude -n <ticket> -w <slug> --plugin-dir <extension>/claude-plugin "/wayfinder …"
session hooks ──append──> status events file ──watch──> Cockpit
```

### The scout

Wayfinder state drifts in ways better parsing won't fix:

- An earlier wayfinder version claimed tickets with a `wayfinder:claimed` label; today the assignee is the claim, and ticket types gained `task`.
- Matt's GitHub tracker template still describes the older "Notes / Decisions-so-far / Fog" map body, while `SKILL.md` uses Destination, Notes, Decisions so far, Not yet specified and Out of scope.
- Trackers fall back to text when native features are off: a task list plus `Part of #<map>` instead of sub-issues, a `Blocked by: #n` line instead of native dependencies.
- Agents and humans write markdown however they like.

So the scout runs in three steps:

1. **Collect, with code.** Read `docs/agents/issue-tracker.md`. On GitHub, fetch every issue with a `wayfinder:` label in one `gh api graphql` query: number, title, state, labels, assignees, sub-issues, blockers, body, latest comments, `updatedAt`. On a local tracker, read `.scratch/*/map.md` and its `issues/*.md`. Labels decide what the scout sees at all.
2. **Interpret, with Haiku.** Pipe the bundle into `claude -p` with a JSON Schema generated from the zod snapshot type. Send only maps and tickets whose `updatedAt` (or file hash) changed; unchanged items come from the cache.
3. **Reconcile, with code.** API facts win: closed is closed, a native dependency is a real blocker, the assignee is the claim. The model fills gaps (destination, decisions, fog, question summaries, blockers written as text, legacy claim labels) and reports drift as `warnings`. Then the frontier is computed as a pure function.

For an "Other" tracker, step 1 becomes an agentic run that follows the prose in `issue-tracker.md`, with read access to whatever CLI it names, and returns the same schema.

```bash
gh api graphql -f query="$WAYFINDER_QUERY" \
  | claude -p "Normalize this wayfinder snapshot" \
      --model haiku --safe-mode --permission-mode dontAsk \
      --no-session-persistence \
      --output-format json --json-schema "$SNAPSHOT_SCHEMA"
# The schema-shaped result is in `.structured_output`.
```

Flag notes (verified 2026-10-02):

- **Not `--bare`.** It is the documented mode for scripts, but it skips OAuth and keychain reads and needs `ANTHROPIC_API_KEY`, so it breaks subscription logins.
- **`--safe-mode`** turns off CLAUDE.md, skills, plugins, hooks and MCP servers while authentication and permissions keep working. It is documented as a troubleshooting switch, so watch the Claude Code changelog for changes.
- **`--permission-mode dontAsk`** denies everything outside the allow rules and the read-only command set.
- **`--no-session-persistence`** keeps scout runs out of `claude --resume`.
- **No `claude --bg`.** Background sessions can't be combined with `-p`, so the scout is always a child process of the extension.

Triggers: extension activation, window focus, `.scratch` file changes, a Cockpit session stopping, a timer while the Cockpit is visible, and the refresh button. Always render the last snapshot immediately and swap in the new one when it lands.

### Sessions

```bash
claude -n "<ticket title>" -w <ticket-slug> \
  --plugin-dir "<extension>/claude-plugin" \
  "/wayfinder <map-url> <ticket-url>"
```

- Each session gets a VS Code terminal named after the ticket, in the panel or as an editor tab, with an icon per ticket type and `HERO_SYNERGY_TICKET` and `HERO_SYNERGY_EVENTS` in its environment.
- `-n` names the session, so `claude --resume "<ticket title>"` brings it back after the terminal closes.
- `-w` gives each ticket its own worktree, because grilling tickets run domain-modeling, which edits `GLOSSARY.md` and ADRs inline. Exception: on a local `.scratch` tracker, run without `-w`, or the claims land in a private copy of the map.
- The command name depends on how the skills were installed: plugin installs namespace commands (`/mattpocock-skills:wayfinder`), skills.sh installs don't. Never install both; Matt's README warns it duplicates every skill.
- Later, AFK tickets can run as `claude --bg` and be pulled into a Cockpit terminal with `claude attach <id>`, without ever opening agent view.

### Live status

The extension ships a tiny Claude Code plugin (`packages/vscode/claude-plugin/`, see Appendix A.7). Its hooks run one exec-form handler, `node ${CLAUDE_PLUGIN_ROOT}/report.mjs` with `async: true`, that appends a status event to the file in `HERO_SYNERGY_EVENTS`. The extension watches that file.

| Hook event | Status |
| --- | --- |
| `SessionStart` | started |
| `UserPromptSubmit` | working |
| `Stop` | waiting for you |
| `Notification` with `permission_prompt` | needs approval |
| `StopFailure` | failed (rate limit or API error) |
| `SessionEnd` | ended |

Plugin hooks merge with user and project hooks, so a repo's own hooks (for example a `vue-tsc --noEmit` gate) keep running. Hooks inherit the session's environment, which is how they know the ticket and the events file.

### Actions

- Discover installed skills in the project's `.claude/skills`, the user's `~/.claude/skills`, and the `mattpocock-skills` plugin. Parse each `SKILL.md` frontmatter: `disable-model-invocation: true` marks a user-invoked skill, which becomes an action. Model-invoked skills are for the agent, so they don't.
- Placement:
  - no `docs/agents/issue-tracker.md`: lead with `/setup-matt-pocock-skills`;
  - skills missing: offer one install route, the plugin (`claude plugins install mattpocock-skills`) or skills.sh (`npx skills@latest add mattpocock/skills`), never both;
  - no map: "Chart a map" (`/wayfinder` with a loose idea);
  - frontier tickets: "Work ticket" (`/wayfinder <map-url> <ticket-url>`);
  - finished map: `/to-spec`, then `/to-tickets`;
  - `ready-for-agent` tickets: `/implement`;
  - always available: `/grill-me`, `/grill-with-docs`, `/ask-matt`.
- A user-invoked skill Matt ships later appears in a generic list with its description, with no hero-synergy release needed.

## Stack

Versions as of 2026-10-02.

| Area | Choice | Version | Notes |
| --- | --- | --- | --- |
| Runtime | Node.js | 26 (`.node-version`) | Current; LTS scheduled for 2026-10-28. Published packages declare `"engines": { "node": ">=22.18" }` `[P]`. VS Code runs extensions on its own bundled Node, so extension code can't assume Node 26 APIs. |
| Package manager | pnpm | 12.8.1 | `"packageManager": "pnpm@12.8.1"`; settings live in `pnpm-workspace.yaml`. |
| Language | TypeScript | 7.0.2 | Go-native. The npm package no longer exposes the classic compiler API (its main export is the version; experimental APIs live under `typescript/unstable/*`), so libraries that import `typescript` (vue-tsc, ts-morph, typescript-eslint) need TypeScript 6. Set `isolatedDeclarations: true`: `vp pack` then emits `.d.mts` through oxc, which works with TypeScript 7 (tested). |
| Toolchain | Vite+ (`vp`) | 1.0.0, stable since 2026-09-28 | One dependency for dev, build (Vite 8), check, test (Vitest 5), pack (tsdown) and run (task runner with caching, `-r`, `--filter`). The root `vite.config.ts` owns `lint`, `fmt` and tasks; packages keep their own `vite.config.ts` for `pack`, build and test. Import from `vite-plus` and `vite-plus/test`. The CLI needs Node `^22.18 \|\| ^24.11 \|\| >=26`. |
| Lint and format | Oxlint, Oxfmt | 1.86, 0.71 | Run through `vp lint`, `vp fmt` and `vp check`, never directly. Enable `lint.options.typeAware` and `typeCheck` so `vp check` type-checks through tsgolint on TypeScript 7. It doesn't type-check `.vue` files. |
| Effects | Effect | 4.0.0 | Plus `@effect/platform-node` and `@effect/vitest` 4.0.0. |
| Validation | zod | 4.6.5 | `z.toJSONSchema()` produces the scout's `--json-schema`. |
| Server | Nitro | 3.0 beta | Still beta. No role in v0.1.0 yet `[?]`. |
| Utilities | UnJS | | citty (CLI args), consola (logs), c12 (config; v4 is still an RC), pathe, defu, std-env. Reach for UnJS before other dependencies. |
| Webview | Vue | 3.5 | `[P]` Type-check SFCs with vue-tsc 3.3 against TypeScript 6, pinned inside `packages/vscode`. |
| Releases | Changesets | CLI 3.0.3, action v2 | ESM-only, Node `^22.11 \|\| ^24 \|\| >=26`. The action is split into sub-actions; private packages are versioned and tagged only when `privatePackages` says so. |
| Extension publishing | @vscode/vsce, ovsx | 4.0.0, 1.2.0 | vsce: `--azure-credential`, `--skip-duplicate`, `--packagePath`. Its `--oidc` flow was merged on 2026-09-29 but isn't released yet. ovsx: `--trusted-publishing`. |
| CI | voidzero-dev/setup-vp | v1.21.1 | Pin an exact version; the `v1` tag no longer updates. It installs Vite+, Node and pnpm, then runs `vp install`. |

## Repository layout

```
.
├── .changeset/config.json
├── .github/workflows/
│   ├── ci.yml
│   └── release.yml
├── .node-version                 # 26
├── CONTEXT.md                    # this file
├── LICENSE
├── package.json                  # private workspace root
├── pnpm-workspace.yaml
├── scripts/release-notes.ts
├── vite.config.ts                # Vite+ root: lint, fmt, tasks
└── packages/
    ├── core/                     # @hero-synergy/core
    ├── cli/                      # @hero-synergy/cli, bin: hero-synergy
    └── vscode/                   # hero-synergy, the VS Code extension
        ├── src/                  # extension host: vp pack → dist/extension.cjs
        ├── webview/              # Vue Cockpit: vp build → dist/webview
        ├── claude-plugin/        # session status hooks, loaded with --plugin-dir
        ├── vite.config.ts        # `pack` block for the host, Vite app config for the webview
        ├── LICENSE               # copy of the root LICENSE; vsce needs one in the package
        └── README.md             # the Marketplace page
```

`vp pack` emits ESM as `.mjs` with `.d.mts` types and CommonJS as `.cjs` (tsdown 0.23). The extension host is one CommonJS bundle with `vscode` external, so `main` is `./dist/extension.cjs`. Run `vp pack` before `vp build`, because pack cleans `dist`.

## Getting started

```bash
curl -fsSL https://vite.plus | bash    # installs the global `vp`
vp env pin node@26 pnpm@12             # pins Node and pnpm for this repo
vp migrate                             # adopt Vite+ in this repo (vp create scaffolds a new one)
```

Keep what Vite+ generates (`vite.config.ts`, the pnpm overrides for `vite` and `vitest`, and its agent instructions block). Then add the packages, `pnpm add -Dw @changesets/cli @changesets/changelog-github`, and the files in the Appendix.

Dogfood Matt's workflow from day one: install the skills (plugin or skills.sh, not both), run `/setup-matt-pocock-skills` with the GitHub tracker, then run `/wayfinder` with this file.

## Working agreements

- Use `vp` for everything: `vp check`, `vp test`, `vp run -r build`. Never call oxlint, oxfmt or vitest directly.
- Every user-facing change ships a changeset written for users (see [Writing great changesets](#writing-great-changesets)).
- Keep `@hero-synergy/core` free of `vscode` imports.
- New dependencies outside the stack need an ADR.
- Code never fires a user-invoked skill on its own; a human click does.
- `[P]` Exclude generated `CHANGELOG.md` files from `vp fmt`, so the Release PR never fails formatting.

## Releases

### How a release happens

1. While working, every user-facing change gets a changeset: `pnpm changeset`.
2. Merging to `main` makes the Release workflow open or update the **Release hero-synergy** PR, with versions bumped and changelogs written. That PR is the release-notes editor: polish the `CHANGELOG.md` wording in it before merging.
3. Merging the Release PR makes the workflow build and pack, publish to npm with trusted publishing (provenance included), publish the extension to each enabled registry, and create one GitHub release `vX.Y.Z` with a section per package, install links, a compare link and the `.vsix` attached.

Simple scripts: day to day you run `pnpm changeset`. `pnpm release:status` shows what the next release contains, and `pnpm release:notes` (on the Release PR branch) prints the exact release body.

### Versioning

- One version for all packages (a Changesets `fixed` group).
- Before 1.0, breaking changes are **minor** bumps whose summary starts with "**Breaking:**". A major bump would jump to 1.0.0.
- The VS Code Marketplace accepts only `major.minor.patch`, so don't use Changesets pre mode for the extension. Use vsce's `--pre-release` channel if it's ever needed.

### Writing great changesets

- One changeset per user-visible change. Write for the person updating, not the reviewer.
- Start with a verb, say what changed and why it matters, and include the command or setting if one changed.
- Patch for fixes, minor for features (and, before 1.0, for breaking changes).
- No changeset for refactors, tests or CI. If a PR needs one anyway, run `pnpm changeset --empty`.

```md
---
"hero-synergy": minor
---

Show which session is waiting for you: tickets turn amber when Claude stops and needs your reply.
```

`@changesets/changelog-github` adds the PR link, the commit link and a thanks to the author on every entry.

### One-time setup

**GitHub**

1. Settings → Actions → General: enable "Allow GitHub Actions to create and approve pull requests", or the Release PR can't be opened.
2. Optional: install the [Changesets bot](https://github.com/apps/changeset-bot) to comment on PRs that lack a changeset.
3. PRs opened with the default `GITHUB_TOKEN` don't trigger other workflows, so CI won't run on the Release PR. If required checks block it, pass a GitHub App token to the version job.

**npm** (for `@hero-synergy/core` and `@hero-synergy/cli`)

1. Trusted publishing needs the package to exist, so publish `0.0.0` once from your machine with 2FA: `vp run -r build && pnpm -r publish --access public`.
2. Trust the workflow (npm ≥ 11.15 and 2FA required):
   ```bash
   npm trust github @hero-synergy/core --repo dbarjs/hero-synergy --file release.yml --allow-publish --yes
   npm trust github @hero-synergy/cli --repo dbarjs/hero-synergy --file release.yml --allow-publish --yes
   ```
   `--allow-publish` is essential: trusted publishers created after 2026-09-03 only allow staged publishing by default, and Changesets doesn't support staged publishing yet.
3. In each package's settings, choose "Require two-factor authentication and disallow tokens".
4. `repository.url` must match `git+https://github.com/dbarjs/hero-synergy.git` exactly, or the publish fails.

**VS Code Marketplace** (global Azure DevOps PATs retire on 2026-12-01, so use Entra ID)

1. Create the publisher at <https://marketplace.visualstudio.com/manage>. Its ID is the extension's `publisher` field.
2. In Azure, create a **user-assigned managed identity**, not an App Registration: an App Registration signs in but fails at publish time. Add a federated credential: GitHub Actions, organization `dbarjs`, repository `hero-synergy`, entity type Environment, name `marketplace`.
3. Add repository secrets `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` from the identity's properties.
4. Run `marketplace-identity.yml` (Appendix A.5) once, add the `id` it prints as a **Contributor** member of the publisher, then delete the workflow.
5. Set the repository variable `PUBLISH_MARKETPLACE=true`.
6. When vsce releases `--oidc`, replace the `azure/login` step and `--azure-credential` with Marketplace trusted publishing.

**Open VSX** (optional; reaches Cursor, Windsurf and VSCodium)

1. Create an Eclipse account, sign the Open VSX Publisher Agreement, create a token, run `npx ovsx create-namespace hero-synergy -p <token>` and claim ownership of the namespace.
2. Publish the first `.vsix` by hand with that token: registering a trusted publisher requires the extension to exist with an active version.
3. In open-vsx.org Settings → Trusted Publishers, register repository `dbarjs/hero-synergy`, workflow `release.yml`, environment `marketplace`.
4. Delete the token and set the repository variable `PUBLISH_OPEN_VSX=true`.

Until a registry is switched on, every GitHub release still carries the `.vsix`.

## Not yet specified

- `[?]` Does `@hero-synergy/cli` ship in v0.1.0, and with which commands?
- `[?]` Marketplace publisher ID: `hero-synergy` (the brand) or `dbarjs`. It decides the extension ID, `<publisher>.hero-synergy`.
- `[?]` Claim the unscoped `hero-synergy` npm name so `npx hero-synergy` works? It would need a workspace name other than the extension's.
- `[?]` Nitro's role. Candidates: a browser Cockpit served locally (the same Vue UI) for people outside VS Code, or the docs site. Nitro 3 is still beta.
- `[?]` zod or Effect Schema for the snapshot: avoid modeling the same data twice.
- `[?]` How maps render: list, graph, or both, and which layout library.
- `[?]` Scout budget: refresh cadence, bundle size limits, cache keys, behavior on rate limits, and a fallback if `--safe-mode` changes.
- `[?]` When the scout and the status hooks disagree (a session claimed a ticket the tracker doesn't show yet), which wins, and for how long?
- `[?]` Multi-root workspaces, repos with several maps, and a GitLab tracker adapter.
- `[?]` Extension testing: `vp test` for units, and whether integration tests run VS Code in CI.
- `[?]` Windows support for terminals and hook commands.
- `[?]` `engines.vscode` floor (forks such as Cursor lag behind VS Code) and the matching `@types/vscode` pin.
- `[?]` Does `@effect/vitest` 4.0.0 work with Vitest 5 under Vite+?

## Out of scope

For v0.1.0: a TUI; Claude Code's agent view; the official Claude Code VS Code extension; sandcastle and container sandboxes; agents other than Claude Code; writing to the tracker from the Cockpit; chaining user-invoked skills automatically; telemetry; a hosted service.

## References

- Matt Pocock's skills: <https://github.com/mattpocock/skills> (`skills/engineering/wayfinder/SKILL.md`, `skills/engineering/setup-matt-pocock-skills/issue-tracker-*.md`)
- Claude Code CLI reference: <https://code.claude.com/docs/en/cli-reference>
- Claude Code hooks: <https://code.claude.com/docs/en/hooks>
- Claude Code headless mode: <https://code.claude.com/docs/en/headless>
- Claude Agent SDK overview: <https://code.claude.com/docs/en/agent-sdk/overview>
- Changesets automation guide: <https://changesets.dev/guide/automating>
- changesets/action v2: <https://github.com/changesets/action>
- npm trusted publishing: <https://docs.npmjs.com/trusted-publishers>
- `npm trust`: <https://docs.npmjs.com/cli/v12/commands/npm-trust>
- Publishing VS Code extensions: <https://code.visualstudio.com/api/working-with-extensions/publishing-extension>
- Marketplace publishing with Entra ID from GitHub Actions: <https://dev.to/emrecodes/publishing-to-the-vs-code-marketplace-with-ci-4p2h>
- Open VSX trusted publishing: <https://github.com/eclipse-openvsx/openvsx/wiki/Trusted-Publishing>
- Vite+: <https://github.com/voidzero-dev/vite-plus>
- setup-vp: <https://github.com/voidzero-dev/setup-vp>

## Appendix: reference files

These are starting points, not generated output. The three workflows pass actionlint 1.7.12, and `release-notes.ts` was run against sample Changesets changelogs.

### A.1 `.changeset/config.json`

```json
{
  "$schema": "https://unpkg.com/@changesets/config@4.0.1/schema.json",
  "changelog": ["@changesets/changelog-github", { "repo": "dbarjs/hero-synergy" }],
  "commit": false,
  "fixed": [["@hero-synergy/*", "hero-synergy"]],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "privatePackages": { "version": true, "tag": true },
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

`privatePackages` matters: the extension is private on npm, and Changesets v3 neither versions nor tags private packages unless told to.

### A.2 Package manifests (release-relevant fields)

Root `package.json` (merge with what `vp migrate` writes):

```json
{
  "name": "hero-synergy-workspace",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.8.1",
  "scripts": {
    "build": "vp run -r build",
    "changeset": "changeset",
    "release:status": "changeset status --verbose",
    "release:notes": "node scripts/release-notes.ts"
  },
  "devDependencies": {
    "@changesets/changelog-github": "^1.0.1",
    "@changesets/cli": "^3.0.3",
    "typescript": "^7.0.2",
    "vite-plus": "^1.0.0"
  }
}
```

`packages/core/package.json`:

```json
{
  "name": "@hero-synergy/core",
  "version": "0.0.0",
  "description": "Wayfinder map model, tracker adapters and scout for hero-synergy.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/dbarjs/hero-synergy.git",
    "directory": "packages/core"
  },
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "default": "./dist/index.mjs"
    }
  },
  "files": ["dist"],
  "engines": { "node": ">=22.18" },
  "publishConfig": { "access": "public" },
  "scripts": { "build": "vp pack" }
}
```

`packages/cli/package.json`:

```json
{
  "name": "@hero-synergy/cli",
  "version": "0.0.0",
  "description": "Query wayfinder maps and launch Claude Code sessions from the terminal.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/dbarjs/hero-synergy.git",
    "directory": "packages/cli"
  },
  "type": "module",
  "bin": { "hero-synergy": "./dist/cli.mjs" },
  "files": ["dist"],
  "engines": { "node": ">=22.18" },
  "publishConfig": { "access": "public" },
  "scripts": { "build": "vp pack" },
  "dependencies": { "@hero-synergy/core": "workspace:*" }
}
```

`packages/vscode/package.json` (everything the extension imports goes in `devDependencies`, so `vp pack` bundles it and vsce can run with `--no-dependencies`):

```json
{
  "name": "hero-synergy",
  "displayName": "Hero Synergy",
  "description": "Unofficial cockpit for mattpocock/skills: wayfinder maps, frontier tickets and named Claude Code sessions in VS Code terminals.",
  "version": "0.0.0",
  "private": true,
  "publisher": "hero-synergy",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/dbarjs/hero-synergy.git",
    "directory": "packages/vscode"
  },
  "engines": { "vscode": "^1.100.0" },
  "extensionKind": ["workspace"],
  "main": "./dist/extension.cjs",
  "files": ["dist", "claude-plugin", "CHANGELOG.md", "LICENSE"],
  "scripts": {
    "build": "vp pack && vp build",
    "typecheck": "vue-tsc --noEmit -p webview",
    "package": "vsce package --no-dependencies --allow-unused-files-pattern",
    "publish:marketplace": "vsce publish --packagePath *.vsix --azure-credential --skip-duplicate",
    "publish:open-vsx": "ovsx publish --packagePath *.vsix --trusted-publishing --skip-duplicate"
  },
  "devDependencies": {
    "@hero-synergy/core": "workspace:*",
    "@types/vscode": "~1.100.0",
    "@vscode/vsce": "^4.0.0",
    "ovsx": "^1.2.0",
    "typescript": "^6.0.3",
    "vue": "^3.5.0",
    "vue-tsc": "^3.3.0"
  }
}
```

With a `files` field, vsce adds only `package.json` and `README.md` on its own, so `CHANGELOG.md` (the Marketplace changelog tab) and `LICENSE` are listed explicitly. `--allow-unused-files-pattern` lets local packaging work before the first changelog exists.

### A.3 `.github/workflows/release.yml`

Follows the Changesets trusted-publishing layout: `id-token: write` only on jobs that publish.

```yaml
name: Release

on:
  push:
    branches: [main]

# Reset permissions; every job asks for exactly what it needs.
permissions: {}

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}

jobs:
  select-mode:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    outputs:
      mode: ${{ steps.mode.outputs.mode }}
      publish-plan-artifact-id: ${{ steps.mode.outputs.publish-plan-artifact-id }}
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: voidzero-dev/setup-vp@v1.21.1
        with:
          node-version-file: .node-version
      - id: mode
        uses: changesets/action/select-mode@v2

  version:
    needs: select-mode
    if: needs.select-mode.outputs.mode == 'version'
    runs-on: ubuntu-latest
    permissions:
      contents: write # commit the version bump
      pull-requests: write # open or update the Release PR
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: voidzero-dev/setup-vp@v1.21.1
        with:
          node-version-file: .node-version
      - uses: changesets/action/version@v2
        with:
          pr-title: Release hero-synergy
          commit-message: 'chore: release'

  pack:
    needs: select-mode
    if: needs.select-mode.outputs.mode == 'publish'
    runs-on: ubuntu-latest
    permissions:
      contents: read
    outputs:
      pack-dir-artifact-id: ${{ steps.pack.outputs.pack-dir-artifact-id }}
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: voidzero-dev/setup-vp@v1.21.1
        with:
          node-version-file: .node-version
      - run: vp run -r build
      - id: pack
        uses: changesets/action/pack@v2
        with:
          publish-plan-artifact-id: ${{ needs.select-mode.outputs.publish-plan-artifact-id }}
      - run: vp run --filter hero-synergy package
      - uses: actions/upload-artifact@v7
        with:
          name: vsix
          path: packages/vscode/*.vsix
          if-no-files-found: error

  publish:
    needs: pack
    runs-on: ubuntu-latest
    permissions:
      contents: write # push release tags through the GitHub API
      id-token: write # npm trusted publishing
    outputs:
      published: ${{ steps.publish.outputs.published }}
      published-packages: ${{ steps.publish.outputs.published-packages }}
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: voidzero-dev/setup-vp@v1.21.1
        with:
          node-version-file: .node-version
      - id: publish
        uses: changesets/action/publish@v2
        with:
          pack-dir-artifact-id: ${{ needs.pack.outputs.pack-dir-artifact-id }}
          create-github-releases: false # one combined release is created below

  extension:
    needs: publish
    if: contains(needs.publish.outputs.published-packages, '"name":"hero-synergy"') && (vars.PUBLISH_MARKETPLACE == 'true' || vars.PUBLISH_OPEN_VSX == 'true')
    runs-on: ubuntu-latest
    environment: marketplace
    permissions:
      contents: read
      id-token: write # Entra ID for the Marketplace, trusted publishing for Open VSX
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: voidzero-dev/setup-vp@v1.21.1
        with:
          node-version-file: .node-version
      - uses: actions/download-artifact@v8
        with:
          name: vsix
          path: packages/vscode
      - if: vars.PUBLISH_MARKETPLACE == 'true'
        uses: azure/login@v3
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          allow-no-subscriptions: true
      - if: vars.PUBLISH_MARKETPLACE == 'true'
        run: vp run --filter hero-synergy publish:marketplace
      - if: vars.PUBLISH_OPEN_VSX == 'true'
        run: vp run --filter hero-synergy publish:open-vsx

  github-release:
    needs: [publish, extension]
    if: ${{ !cancelled() && needs.publish.outputs.published == 'true' && needs.extension.result != 'failure' }}
    runs-on: ubuntu-latest
    permissions:
      contents: write # create the release
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0 # all tags, for the compare link
          persist-credentials: false
      - uses: voidzero-dev/setup-vp@v1.21.1
        with:
          node-version-file: .node-version
          run-install: false
      - uses: actions/download-artifact@v8
        with:
          name: vsix
          path: vsix
      - name: Create the GitHub release
        env:
          GH_TOKEN: ${{ github.token }}
          PUBLISH_MARKETPLACE: ${{ vars.PUBLISH_MARKETPLACE }}
          PUBLISH_OPEN_VSX: ${{ vars.PUBLISH_OPEN_VSX }}
        run: |
          tag="v$(jq -r .version packages/core/package.json)"
          if gh release view "$tag" > /dev/null 2>&1; then exit 0; fi
          node scripts/release-notes.ts > notes.md
          gh release create "$tag" vsix/*.vsix --title "hero-synergy $tag" --notes-file notes.md --target "$GITHUB_SHA"
```

### A.4 `.github/workflows/ci.yml`

Build first: packages type-check against each other's built `.d.mts`.

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: voidzero-dev/setup-vp@v1.21.1
        with:
          node-version-file: .node-version
          cache: true
      - run: vp run -r build
      - run: vp check
      - run: vp test
      - run: vp run --filter hero-synergy typecheck
```

### A.5 `.github/workflows/marketplace-identity.yml` (run once, then delete)

Prints the Azure DevOps identity `id` that the Marketplace's member search accepts.

```yaml
name: Marketplace identity (run once, then delete)

on: workflow_dispatch

permissions:
  contents: read
  id-token: write

jobs:
  whoami:
    runs-on: ubuntu-latest
    environment: marketplace
    steps:
      - uses: azure/login@v3
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          allow-no-subscriptions: true
      - run: az rest -u https://app.vssps.visualstudio.com/_apis/profile/profiles/me --resource 499b84ac-1321-427f-aa17-267ca6975798
```

### A.6 `scripts/release-notes.ts`

Runs on Node 26 with built-in type stripping, so it uses only erasable TypeScript. It drops the "Updated dependencies" entries that fixed versioning creates.

```ts
/**
 * Prints the body of the GitHub release for the current version: one section per
 * package, taken from the CHANGELOG.md files that `changeset version` wrote, plus
 * install links and a compare link. Usage: node scripts/release-notes.ts > notes.md
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const REPO = 'dbarjs/hero-synergy'

const SECTIONS = [
  { dir: 'packages/vscode', title: 'VS Code extension' },
  { dir: 'packages/cli', title: 'CLI' },
  { dir: 'packages/core', title: 'Core' },
]

interface Manifest {
  name: string
  version: string
  publisher?: string
}

const readManifest = (dir: string): Manifest =>
  JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'))

const version = readManifest('packages/core').version
const tag = `v${version}`

/** The `## <version>` entry of a Changesets CHANGELOG, without "Updated dependencies" noise. */
function entryFor(changelog: string): string {
  const lines = changelog.split('\n')
  const start = lines.findIndex((line) => line.trim() === `## ${version}`)
  if (start === -1) return ''
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '))
  const groups: { heading: string; lines: string[] }[] = []
  let skipping = false
  for (const line of lines.slice(start + 1, end === -1 ? undefined : end)) {
    if (line.startsWith('### ')) {
      groups.push({ heading: line, lines: [] })
      skipping = false
      continue
    }
    if (line.startsWith('- ')) skipping = line.startsWith('- Updated dependencies')
    if (!skipping) groups.at(-1)?.lines.push(line)
  }
  return groups
    .filter((group) => group.lines.some((line) => line.trim() !== ''))
    .map((group) => [group.heading, ...group.lines].join('\n').trim())
    .join('\n\n')
}

function previousTag(): string | undefined {
  const tags = execFileSync('git', ['tag', '--list', 'v*', '--sort=-v:refname'], { encoding: 'utf8' })
  return tags.split('\n').find((name) => name !== '' && name !== tag)
}

const sections = SECTIONS.flatMap(({ dir, title }) => {
  const file = `${dir}/CHANGELOG.md`
  const entry = existsSync(file) ? entryFor(readFileSync(file, 'utf8')) : ''
  return entry ? [`## ${title}\n\n${entry}`] : []
})

const extension = readManifest('packages/vscode')
const install = [
  `\`npx @hero-synergy/cli@${version}\``,
  process.env.PUBLISH_MARKETPLACE === 'true' &&
    `[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=${extension.publisher}.${extension.name})`,
  process.env.PUBLISH_OPEN_VSX === 'true' &&
    `[Open VSX](https://open-vsx.org/extension/${extension.publisher}/${extension.name})`,
  'or install the `.vsix` attached below',
].filter(Boolean)

const previous = previousTag()
const footer = [
  '---',
  `**Install:** ${install.join(' · ')}`,
  previous && `**Full changelog:** https://github.com/${REPO}/compare/${previous}...${tag}`,
].filter(Boolean)

console.log([...sections, footer.join('\n\n')].join('\n\n'))
```

### A.7 Session status plugin (`packages/vscode/claude-plugin/`)

`.claude-plugin/plugin.json`:

```json
{
  "name": "hero-synergy-status",
  "description": "Reports Claude Code session status to the hero-synergy Cockpit."
}
```

`hooks/hooks.json`:

```json
{
  "description": "hero-synergy session status",
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/report.mjs"], "async": true }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/report.mjs"], "async": true }] }],
    "Notification": [{ "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/report.mjs"], "async": true }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/report.mjs"], "async": true }] }],
    "StopFailure": [{ "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/report.mjs"], "async": true }] }],
    "SessionEnd": [{ "hooks": [{ "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/report.mjs"], "async": true }] }]
  }
}
```

`report.mjs`:

```js
import { appendFileSync, readFileSync } from 'node:fs'

const file = process.env.HERO_SYNERGY_EVENTS
if (!file) process.exit(0) // not a Cockpit session

const input = JSON.parse(readFileSync(0, 'utf8'))
const event = {
  ticket: process.env.HERO_SYNERGY_TICKET,
  hook: input.hook_event_name,
  detail: input.notification_type ?? input.source ?? input.reason ?? null,
  session: input.session_id,
  at: Date.now(),
}
appendFileSync(file, `${JSON.stringify(event)}\n`)
```
