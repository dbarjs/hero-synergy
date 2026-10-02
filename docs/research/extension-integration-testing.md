# How can a VS Code extension be integration-tested under Vite+?

Research for [#13](https://github.com/dbarjs/hero-synergy/issues/13). Checked on 2026-10-02 against primary sources only; numbers in brackets point to [Sources](#sources). Nothing was installed or run in this repo, so every configuration shown here is a sketch read off the tools' docs and source, not a tested setup.

Versions seen on npm today: `@vscode/test-cli` 0.0.15, `@vscode/test-electron` 3.1.0, Mocha 12.0.3, Vitest 5.0.3 (Vite+ 1.0.0 bundles 5.0.1), Playwright 1.63.0, `wdio-vscode-service` 8.0.0, `vscode-extension-tester` 8.28.0, VS Code stable 1.140.0 [20].

## Answer

There is no first-party way to run Vitest inside the VS Code extension host. The official integration-test path is Mocha, started by a separate CLI. It fits a Vite+ workspace as a second runner next to `vp test`, not as part of it. The workable options, cheapest first:

| # | Option | What it covers | Cost |
| --- | --- | --- | --- |
| 1 | **Vitest unit tests through `vp test`**, with `vscode` kept out of the code under test or aliased to a stub | `@hero-synergy/core`, pure host logic. Not the real VS Code API. | Nothing new. Already in the seed. |
| 2 | **`@vscode/test-cli` + `@vscode/test-electron` (Mocha) in the extension host**, as its own script (`vp run test:integration`), its own config (`.vscode-test.mjs`) and test files bundled to CommonJS by a second `pack` entry | Activation, contributed commands and views, terminals, anything that needs the real `vscode` API. Not the Cockpit's DOM. | Two devDependencies plus `@types/mocha`; a second test runner and assertion style; `xvfb-run -a` in CI; about 0.5 to 2 minutes of CI per run (measured below). Official and maintained by the VS Code team, but still versioned 0.0.x. |
| 3 | **Cockpit component tests in Vitest, outside VS Code**: happy-dom or jsdom with `@vue/test-utils`, or Vitest Browser Mode with `vitest-browser-vue` and the Playwright provider | The Vue app's rendering and its handling of webview messages, with `acquireVsCodeApi()` stubbed. Not the real webview host, CSP or theme variables. | Stays inside `vp test`. Browser Mode adds `@vitest/browser-playwright` pinned to exactly 5.0.1, `playwright`, and a browser install step in CI (9 to 18 s in the run measured below). |
| 4 | **End-to-end with Playwright driving the VS Code Electron binary** (`_electron.launch`), downloaded with `@vscode/test-electron` | The whole path: activity bar, the Cockpit inside its webview iframes, terminals. | Playwright calls its Electron support experimental. Fixtures are hand-written in every repo that does this. Jobs take 4 to 12 minutes and both example repos configure retries. |
| 5 | **End-to-end with a page-object framework**: `wdio-vscode-service` (WebdriverIO) or ExTester (Selenium + Mocha) | Same as 4, with ready-made page objects including a `WebView` object. | A third runner stack plus a matching ChromeDriver. `wdio-vscode-service` is community-maintained with long release gaps; ExTester is active but Mocha-only and supports the latest three VS Code minors. |
| 6 | **Vitest inside the extension host** through the community pool `vitest-environment-vscode` | Same as 2, written as Vitest tests. | Immature: 0.1.3, 2 stars, about 67 downloads a week, built on Vitest's experimental custom-pool API, last released before Vitest 5 shipped. Not verified under Vitest 5 or `vp test`. |

What the surveyed extensions do: every one runs option 2 for extension-host tests and keeps Vitest for everything else. Those with a webview add option 3, and only the largest add option 4. None uses option 5 or 6.

## `@vscode/test-cli` and `@vscode/test-electron`

**What they are.** `@vscode/test-electron` downloads and unzips a VS Code build, launches it with `--extensionDevelopmentPath` and `--extensionTestsPath`, and reports the exit code [1][3]. `@vscode/test-cli` is the configuration-driven wrapper the VS Code docs now recommend: it provides the `vscode-test` binary, reads `.vscode-test.js`/`.mjs`/`.cjs`/`.json` from the working directory or a parent, and supplies its own runner script [1][2][5].

**Requirements today.**

- `@vscode/test-cli` 0.0.15 (2026-06-22): Node `>=22`; depends on Mocha `^11.7.6`, `@types/mocha`, c8 and others [20]. The `main` branch moved to Mocha 12 on 2026-08-31 but that is not released [6].
- `@vscode/test-electron` 3.1.0 (2026-07-24): Node `>=22` [20]. 3.1.0 fixes executable lookup on macOS for recent VS Code builds [7].
- The CLI does not declare `@vscode/test-electron` as a dependency. It resolves it from the directory of the config file at run time, so both packages must be devDependencies of the extension package. Under pnpm's strict layout that means `packages/vscode` itself [4].
- Node 26 satisfies both. These Node ranges apply to the CLI process only; the tests themselves run on the Node bundled in the downloaded VS Code (see below).

**The runner is Mocha, and only Mocha.** The docs say "The CLI exclusively uses Mocha under the hood" [1]. The runner script imports `mocha`, defaults to the `tdd` interface (`suite`/`test`), adds each matched file with `mocha.addFile` and loads preload files with `require` [5]. A request to support `node:test` is open with no commitment [8]. No issue in either Microsoft repo asks for Vitest (searched both for "vitest": zero relevant results).

**Test files have to be JavaScript the extension host can `require`.** `files` is a glob over files on disk; nothing transpiles them [2][5]. The repos surveyed handle this in three ways:

- bundle the tests to CommonJS with the same bundler as the extension (oxc-vscode, with rolldown) [16];
- compile them with a separate script (cline, vscode-copilot-chat) [14][15];
- load TypeScript directly through a Mocha preload, `mocha: { preload: 'tsx/cjs' }` (vitest-dev/vscode) [13]. This adds `tsx`, which is outside the seed's stack.

ESM test files were reported working from VS Code 1.119 in the CLI's ESM issue [9]; I did not test this, and CommonJS is the path every surveyed repo uses.

**Which Node the tests run on.** Not the workspace's Node 26. VS Code 1.100 (the seed's `engines.vscode` floor) ships Electron 34.5.1, which bundles Node 20.19.0; VS Code 1.140 targets Electron 43.7.3, which bundles Node 24.21.0 [21]. Test bundles should target the floor.

**Which VS Code is downloaded.** `version` defaults to stable. When no version is given, `@vscode/test-electron` picks the newest stable release that satisfies the extension's `engines.vscode` [3]. `version: '1.100.0'` or `vscode-test --code-version` pins another; an array of configurations can cover both floor and stable [2].

**Can it live beside Vitest 5 and `vp test` in one package? Yes, as a separate script with a separate config.** Evidence:

- `vp test` always runs the built-in Vitest and ignores a `test` script; `vp run <script>` runs package scripts [10]. So the integration run is a script such as `test:integration`, started with `vp run --filter hero-synergy test:integration`, the same shape the seed already uses for `typecheck`.
- The two runners read different configs: Vitest reads the `test` block of `vite.config.ts` [10]; `vscode-test` reads `.vscode-test.mjs` [2].
- `pack` in a Vite+ config accepts an array (`pack?: PackUserConfig | PackUserConfig[]`) [11], so a second entry can bundle `test/integration/**/*.test.ts` to CommonJS with `vscode` external, the way oxc-vscode does with a `TEST=true` rolldown config [16].
- Three surveyed packages run both runners side by side: vitest-dev/vscode (`test: vscode-test`, `test-e2e: vitest`), vscode-copilot-chat (`test:unit: vitest`, `test:extension: vscode-test`), cline (`test:vitest`, `test:integration: vscode-test`) [13][14][15].

Things to keep apart (my reading, not tested here):

- Keep Mocha files out of Vitest's `include`, or `vp test` will try to run them.
- Write the test bundle to its own directory, not `dist`: `vp pack` cleans `dist`, and the seed's `files` field ships all of `dist` in the VSIX.
- `@vscode/test-electron` caches downloads in `.vscode-test/` under the working directory [3]; ignore it in git, lint and format.
- `@types/mocha` declares global `describe`/`it`/`test`. Vitest files import theirs from `vite-plus/test`, so there is no runtime clash, but a tsconfig shared by both kinds of test would see both sets of globals. vitest-dev/vscode keeps one tsconfig per test folder [13].

A sketch of the config, following the documented options [1][2]:

```js
// packages/vscode/.vscode-test.mjs (not run)
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out-test/**/*.test.cjs',
  workspaceFolder: './test/fixtures/workspace',
  launchArgs: ['--disable-extensions'],
  mocha: { ui: 'tdd', timeout: 20000 },
});
```

The same config also feeds the Extension Test Runner extension and the `extensionHost` debug configuration's `testConfiguration` field, which is how these tests are debugged inside VS Code [1][2].

## Can Vitest drive tests inside the extension host?

**First party: no.** The VS Code docs allow replacing Mocha in a hand-written runner with "any other test framework that can be run programmatically" [1], but Vitest's built-in pools run test files in child processes or worker threads (`forks`, `threads`, `vmForks`, `vmThreads`) [12], and the `vscode` module exists only inside the extension host process. Neither the Vitest docs nor the Vite+ docs mention VS Code extension testing (searched both repos). The Vitest team's own extension tests its host code with Mocha through `vscode-test` [13].

**Community: one package, `vitest-environment-vscode`** [19]. Despite the name it is a custom Vitest pool: it launches VS Code with `@vscode/test-electron`, connects to the extension host over a WebSocket, and runs test files there with the real `vscode` API. Maturity:

- 0.1.3, released 2026-06-16; first published 2025-12-03; 2 GitHub stars; 67 npm downloads in the week of 2026-09-24 (against 1,052,431 for `@vscode/test-cli`) [19][20].
- Peer range `vitest >=3.2.4`, developed against Vitest `^4.1.8`. Its last release predates Vitest 5.0.0 (2026-09-03) [19][20].
- It broke on VS Code 1.124 and needed a handshake rework (issue 13, fixed in 0.1.3). An open issue reports that projects with two or more test files race on the VS Code download and kill the run, and that `reuseWorker` does nothing without `isolate: false` (issue 18) [19].
- It sits on Vitest's custom pool API, which the Vitest 5 docs call "an advanced, experimental and very low-level API" [12].

**A different meaning of "Vitest drives VS Code".** vitest-dev/vscode uses Vitest on Node as the outer runner for end-to-end tests: a Vitest fixture launches VS Code through Playwright's `_electron` and asserts on the UI [13]. The tests do not run in the extension host and cannot import `vscode`. That is option 4 with Vitest instead of Playwright Test as the runner, and it would run under `vp test`.

Older Jest equivalents (`jest-runner-vscode`, last published 2022) are not relevant to this stack [20].

## Running VS Code in GitHub Actions

**Display server.** The VS Code CI guide: "In headless Linux CI machines `xvfb` is required to run VS Code", and its GitHub Actions example runs `xvfb-run -a npm test` on Linux and plain `npm test` on macOS and Windows [22]. The `vscode-test` sample workflow does the same [3]. `xvfb` is preinstalled on the `ubuntu-24.04` image that `ubuntu-latest` points to (image 20260927.320.1) [23], and oxc-vscode and vscode-copilot-chat call `xvfb-run -a` with no install step [14][16]. `@vscode/test-electron` already passes `--no-sandbox`, `--disable-gpu-sandbox`, `--disable-updates`, `--skip-welcome`, `--skip-release-notes` and `--disable-workspace-trust` [3].

In a container without the Electron libraries (the GitLab example in the same guide), install `libasound2 libgbm1 libgtk-3-0 libnss3 xvfb` first [22]. In a dev container, the reporter of the CLI's dev container issue got passing tests under `xvfb-run -a`; the "Exiting GPU process" lines in the log come from Electron, according to the maintainer [9].

**Download and caching.** The Linux x64 archive of stable 1.140.0 is 348,920,118 bytes (HEAD request on the update URL today) [21]. `@vscode/test-electron` unpacks it to `.vscode-test/vscode-<platform>-<version>` and reuses it when an `is-complete` marker exists. For `stable` it still asks the update service for the current version on every run, and falls back to a local copy only if that request fails [3]. So a cache keyed without the VS Code version goes stale each monthly release.

- oxc-vscode, vscode-copilot-chat and the `vscode-test` sample do not cache the download [3][14][16].
- cline caches `.vscode-test` with `actions/cache`, keyed on OS and VS Code version; the restore step takes 4 to 8 s [15].
- `wdio-vscode-service` has its own `cachePath` option [17].

**Time, measured from public runs** (step durations from the Actions API):

| Repo and job | Runner | What ran | Time |
| --- | --- | --- | --- |
| oxc-vscode `Test` [16] | ubuntu-latest | Whole job: install, compile, six `xvfb-run -a vscode-test` launches, no cache | 124 to 132 s |
| same | ubuntu-latest | First test step only: rolldown compile, VS Code download, unit suite | 29 to 31 s |
| same, `Test (windows)` | windows-latest | Whole job | 182 to 194 s |
| vitest-dev/vscode `test` [13] | macOS, Windows | `vscode-test` step (Mocha, uncached download) | 22 to 31 s |
| same | macOS, Windows | `test-e2e` step (Vitest + Playwright Electron) | 228 to 293 s |
| same | macOS, Windows | `playwright install chromium` | 9 to 18 s |
| cline `e2e` [15] | ubuntu | Playwright Electron step under `xvfb-run -a` | 259 to 311 s (job 325 to 374 s) |
| same | macOS / Windows | Whole job | 447 to 484 s / 711 to 724 s |

So one uncached extension-host suite adds roughly half a minute on Linux, and caching the download can save only part of that. Full UI end-to-end suites cost minutes and are where the retries are (`retry: 2` in vitest-dev/vscode's CI config, `retries: 1` in cline's) [13][15].

A sketch of the extra CI step for the seed's workflow (not run):

```yaml
- run: xvfb-run -a vp run --filter hero-synergy test:integration
```

## Testing the webview's contents

Extension-host tests cannot see inside a webview. The VS Code webview guide describes a webview as "an `iframe` within VS Code" that talks to the extension by message passing, and it has no section on automated testing [24]. From a Mocha test in the extension host, the reachable surface is the extension's side: that the view resolves, and what messages the host sends and receives. The DOM needs one of the following.

**Component tests of the Vue app outside VS Code (mature).** The Cockpit is an ordinary Vite app whose only VS Code-specific input is `acquireVsCodeApi()` and the messages it exchanges [24], and the seed already puts webview messages behind zod schemas. Stubbing that one function lets the app run anywhere.

- DOM simulation: `@vue/test-utils` 2.5.1 with happy-dom or jsdom. The Vue guide recommends Vitest with `@vue/test-utils` for component tests [25]. cline and Roo-Code test their Vite-built webviews this way (React, Testing Library, jsdom) [15][18].
- Vitest Browser Mode: the Vitest 5 docs call it "the recommended approach for component testing" and name `vitest-browser-vue` as the Vue package (3.1.0, peer `vitest ^4 || ^5`) [12][20]. Vite+ bundles `@vitest/browser` and the preview provider, re-exports the Playwright provider as `vite-plus/test/browser-playwright`, and requires the opt-in `@vitest/browser-playwright` at the bundled runner's exact version, 5.0.1, plus `playwright` [10][20]. The docs say CI needs Playwright or WebdriverIO, not the preview provider [12].
- Neither reproduces the webview's CSP, VS Code's theme CSS variables or resource URIs.

**Playwright against the VS Code Electron app (works, experimental, hand-rolled).** Playwright documents Electron automation as experimental [26]. The pattern is still what Microsoft uses: VS Code's own smoke tests launch through `playwright._electron` [27], and microsoft/playwright-vscode downloads VS Code with `@vscode/test-electron` and launches it with `_electron.launch({ executablePath, args: ['--extensionDevelopmentPath=...'] })` [28]. vitest-dev/vscode copied that fixture [13]. cline uses it to test its webview: it walks `page.frames()` to find the sidebar's frame and then uses normal locators inside it [15]. There is no published helper package; each repo owns its fixture, including the workarounds visible in cline's helper (macOS executable path, forced teardown) [15].

**`wdio-vscode-service` (works, thinly maintained).** A WebdriverIO service that downloads VS Code and a matching ChromeDriver, starts the extension, and ships page objects, including `WebView` with `open()`/`close()` that switch into and out of the webview's nested frames, and `browser.executeWorkbench` for calling the `vscode` API from a test [17]. Maturity: 8.0.0 on 2026-06-19 moved to WebdriverIO 9 after nine months without a release; 43 stars, 54 open issues, 8,139 downloads a week; it still depends on `@vscode/test-electron ^2.4.1`, with an open issue asking for 3.1.0 for the macOS binary change; open issues include sessions dying after about 60 seconds and Windows hangs [17][20]. Tests run in the WebdriverIO test runner (the documented setup uses `@wdio/mocha-framework`), so it is a third runner next to Vitest and `vscode-test`.

**ExTester, `vscode-extension-tester` (active, heavier).** Red Hat's Selenium WebDriver framework with page objects that include web views. Tests are Mocha suites run by its `extest` CLI. 8.28.0 was released today; 327 stars; 40,672 downloads a week; Node 22 or newer; it tests the latest three VS Code minors and treats older ones down to 1.90 as best effort [29][20].

`@vscode/test-web` targets web extensions in a browser and does not apply to a workspace extension that spawns `gh` and `claude` [20].

## What comparable extensions do

| Extension | Build and unit tests | Extension-host tests | Webview or UI tests | CI |
| --- | --- | --- | --- | --- |
| **vitest-dev/vscode** (the Vitest extension) [13] | tsdown to a CommonJS bundle | `vscode-test` (Mocha `bdd`, chai), TypeScript loaded through `preload: 'tsx/cjs'`, `files: 'test/unit/**/*.test.ts'` | `vitest --root test/e2e`: Vitest fixtures that launch VS Code with Playwright `_electron`; download in a Vitest `globalSetup` | macOS and Windows runners only, so no xvfb; no download cache |
| **oxc-project/oxc-vscode** (VoidZero's extension) [16] | rolldown to CommonJS, `vscode` external | `vscode-test` 0.0.15 with `@vscode/test-electron` ^3.0.0; the same rolldown config bundles `tests/**/*.ts` to `out_test/` when `TEST=true`; suites selected by an env var | No webview | `xvfb-run -a pnpm run test:*` on ubuntu-latest; Windows on `main` only; no cache |
| **cline/cline** (`apps/vscode`) [15] | esbuild host; `webview-ui` is a Vite app with Vitest, jsdom and Testing Library | `vscode-test` (Mocha `bdd`) over separately compiled test files | Playwright Test with `_electron`, reaching the webview through `page.frames()` | `xvfb-run -a` on Ubuntu; `.vscode-test` cached with `actions/cache`; Ubuntu, Windows and macOS matrix |
| **microsoft/vscode-copilot-chat** (archived; last push 2026-05-20) [14] | esbuild; `vitest --run` for `*.spec.ts` with `vscode` aliased to a shim file | `vscode-test` (Mocha `tdd`) over a bundled `dist/test-extension.js`, on an Insiders build by default | None in the PR workflow | `xvfb-run -a npm run test:extension` on ubuntu-22.04; no VS Code cache |

RooCodeInc/Roo-Code (archived; last push 2026-05-15) follows the same split: a Vitest and jsdom webview package, and a separate `apps/vscode-e2e` package on `@vscode/test-cli`/`@vscode/test-electron` with Mocha [18].

The common shape: Vitest for everything that does not need VS Code, Mocha through `vscode-test` for the extension host, and Playwright Electron only where a team decided UI end-to-end coverage was worth minutes of CI. None of these uses `wdio-vscode-service`, ExTester or `vitest-environment-vscode`.

## Differences from the seed

Nothing in the seed is wrong about extension testing; it lists the topic as fog. These points do not match what the seed currently says:

1. **"Use `vp` for everything ... Never call ... vitest directly" cannot cover extension-host tests.** They need a second runner (Mocha) started by `vscode-test`. It can be launched as `vp run test:integration`, but it is not `vp test` [1][10].
2. **New dependencies outside the stack.** `@vscode/test-cli`, `@vscode/test-electron` and `@types/mocha` (and `playwright` plus `@vitest/browser-playwright` for Browser Mode or end-to-end) are not in the Stack table, so the working agreement calls for an ADR.
3. **CI workflow (A.4).** It has no display server. An integration step needs `xvfb-run -a` on `ubuntu-latest` [22].
4. **`dist` is both cleaned by `vp pack` and shipped by `files`.** Compiled test files need their own output directory or they are deleted by the next pack, or packaged into the VSIX.
5. **Outside this ticket, noticed while reading:** the npm manifest of `vite-plus@1.0.0` pins `oxlint` `=1.85.0`, `oxfmt` `=0.70.0` and `vitest` `5.0.1`; the Stack table says Oxlint 1.86 and Oxfmt 0.71 [20]. Vitest 5 no longer searches parent directories for a config, which matters for running `vp test` from a package subdirectory [10].

## Not verified

- No configuration here was run. In particular: `vp pack` with an array `pack` block producing loadable `*.test.cjs` files, and `vscode-test` loading them.
- Whether `vitest-environment-vscode` works with Vitest 5.0.1 or under `vp test`.
- Whether ESM test files load in `vscode-test`; the only evidence is user reports on the issue [9].
- Whether `wdio-vscode-service` 8.0.0 or ExTester work with VS Code 1.140; I read their docs and CI configs, not their results. `wdio-vscode-service`'s most recent CI runs (Dependabot pull requests, July to August 2026) are mostly red and I did not find out why.
- The Node version inside VS Code is derived from VS Code's Electron target and Electron's release data, not read from a running build.
- CI timings come from two or three recent runs per repo and include each repo's own test load.
- Windows behaviour (the seed lists Windows support as fog) beyond the job timings above.

## Sources

1. VS Code docs, Testing Extensions (approved 2026-09-30): <https://code.visualstudio.com/api/working-with-extensions/testing-extension>
2. `microsoft/vscode-test-cli` README and config types: <https://github.com/microsoft/vscode-test-cli/blob/main/README.md>, <https://github.com/microsoft/vscode-test-cli/blob/main/src/config.cts>
3. `microsoft/vscode-test` README, sample workflow and source: <https://github.com/microsoft/vscode-test>, <https://github.com/microsoft/vscode-test/blob/main/sample/.github/workflows/ci.yml>, <https://github.com/microsoft/vscode-test/blob/main/lib/download.ts>, <https://github.com/microsoft/vscode-test/blob/main/lib/runTest.ts>
4. `vscode-test-cli` desktop platform (resolves `@vscode/test-electron` from the config directory): <https://github.com/microsoft/vscode-test-cli/blob/main/src/cli/platform/desktop.mts>; related issues <https://github.com/microsoft/vscode-test-cli/issues/59>, <https://github.com/microsoft/vscode-test-cli/issues/95>
5. `vscode-test-cli` runner and config loader: <https://github.com/microsoft/vscode-test-cli/blob/main/src/runner.cts>, <https://github.com/microsoft/vscode-test-cli/blob/main/src/cli/config.mts>
6. `vscode-test-cli` `package.json` on `main` and the Mocha 12 pull request: <https://github.com/microsoft/vscode-test-cli/blob/main/package.json>, <https://github.com/microsoft/vscode-test-cli/pull/118>
7. `vscode-test` macOS executable fix: <https://github.com/microsoft/vscode-test/pull/350>
8. `vscode-test-cli` issue "Support node:test as an alternative to mocha": <https://github.com/microsoft/vscode-test-cli/issues/105>
9. `vscode-test-cli` issues on ESM and dev containers: <https://github.com/microsoft/vscode-test-cli/issues/77>, <https://github.com/microsoft/vscode-test-cli/issues/61>
10. Vite+ docs: Test <https://github.com/voidzero-dev/vite-plus/blob/main/docs/guide/test.md>, Run <https://github.com/voidzero-dev/vite-plus/blob/main/docs/guide/run.md>, Upgrade to Vitest 5 <https://github.com/voidzero-dev/vite-plus/blob/main/docs/guide/vitest-v5.md>, Migrate <https://github.com/voidzero-dev/vite-plus/blob/main/docs/guide/migrate.md>, Pack <https://github.com/voidzero-dev/vite-plus/blob/main/docs/guide/pack.md>
11. Vite+ config types (`pack` accepts an array): <https://github.com/voidzero-dev/vite-plus/blob/main/packages/cli/src/define-config.ts>
12. Vitest 5 docs: pool <https://vitest.dev/config/pool>, custom pool <https://vitest.dev/guide/advanced/pool.html>, Browser Mode <https://vitest.dev/guide/browser/>, component testing <https://vitest.dev/guide/browser/component-testing>
13. vitest-dev/vscode: <https://github.com/vitest-dev/vscode/blob/main/package.json>, <https://github.com/vitest-dev/vscode/blob/main/.vscode-test.mjs>, <https://github.com/vitest-dev/vscode/blob/main/test/e2e/vitest.config.ts>, <https://github.com/vitest-dev/vscode/blob/main/test/e2e/utils/helper.ts>, <https://github.com/vitest-dev/vscode/blob/main/.github/workflows/ci.yml>; timings from <https://github.com/vitest-dev/vscode/actions/runs/36715767176> and <https://github.com/vitest-dev/vscode/actions/runs/36172461642>
14. microsoft/vscode-copilot-chat (archived): <https://github.com/microsoft/vscode-copilot-chat/blob/main/package.json>, <https://github.com/microsoft/vscode-copilot-chat/blob/main/.vscode-test.mjs>, <https://github.com/microsoft/vscode-copilot-chat/blob/main/vite.config.ts>, <https://github.com/microsoft/vscode-copilot-chat/blob/main/.github/workflows/pr.yml>
15. cline/cline: <https://github.com/cline/cline/blob/main/apps/vscode/package.json>, <https://github.com/cline/cline/blob/main/apps/vscode/.vscode-test.mjs>, <https://github.com/cline/cline/blob/main/apps/vscode/playwright.config.ts>, <https://github.com/cline/cline/blob/main/apps/vscode/src/test/e2e/utils/helpers.ts>, <https://github.com/cline/cline/blob/main/apps/vscode/webview-ui/package.json>, <https://github.com/cline/cline/blob/main/.github/workflows/ext-vscode-test-e2e.yml>, <https://github.com/cline/cline/blob/main/.github/workflows/ext-vscode-test.yml>; timings from <https://github.com/cline/cline/actions/runs/37052294132> and <https://github.com/cline/cline/actions/runs/36992518574>
16. oxc-project/oxc-vscode: <https://github.com/oxc-project/oxc-vscode/blob/main/package.json>, <https://github.com/oxc-project/oxc-vscode/blob/main/rolldown.config.ts>, <https://github.com/oxc-project/oxc-vscode/blob/main/.vscode-test.mjs>, <https://github.com/oxc-project/oxc-vscode/blob/main/.github/workflows/ci.yml>; timings from <https://github.com/oxc-project/oxc-vscode/actions/runs/34868882600>, <https://github.com/oxc-project/oxc-vscode/actions/runs/34869229343> and <https://github.com/oxc-project/oxc-vscode/actions/runs/34786837587>
17. wdio-vscode-service: <https://github.com/webdriverio-community/wdio-vscode-service>, <https://github.com/webdriverio-community/wdio-vscode-service/blob/main/src/pageobjects/workbench/WebView.ts>, <https://github.com/webdriverio-community/wdio-vscode-service/blob/main/test/specs/webview.e2e.ts>, <https://github.com/webdriverio-community/wdio-vscode-service/issues/172>, <https://github.com/webdriverio-community/wdio-vscode-service/issues/153>, <https://github.com/webdriverio-community/wdio-vscode-service/issues/170>; WebdriverIO docs <https://webdriver.io/docs/extension-testing/vscode-extensions/>
18. RooCodeInc/Roo-Code (archived): <https://github.com/RooCodeInc/Roo-Code/blob/main/apps/vscode-e2e/package.json>, <https://github.com/RooCodeInc/Roo-Code/blob/main/webview-ui/package.json>
19. vitest-environment-vscode: <https://github.com/andrew-w-ross/vitest-enviroment-vscode>, <https://github.com/andrew-w-ross/vitest-enviroment-vscode/issues/13>, <https://github.com/andrew-w-ross/vitest-enviroment-vscode/issues/18>
20. npm registry metadata and download counts, read 2026-10-02: `https://registry.npmjs.org/<package>` and `https://api.npmjs.org/downloads/point/last-week/<package>` for `@vscode/test-cli`, `@vscode/test-electron`, `@vscode/test-web`, `mocha`, `vitest`, `vite-plus`, `@vitest/browser-playwright`, `vitest-browser-vue`, `@vue/test-utils`, `playwright`, `wdio-vscode-service`, `vscode-extension-tester`, `vitest-environment-vscode`, `jest-runner-vscode`
21. VS Code releases and Electron targets: <https://update.code.visualstudio.com/api/releases/stable>, <https://update.code.visualstudio.com/latest/linux-x64/stable>, <https://github.com/microsoft/vscode/blob/1.140.0/.npmrc>, <https://github.com/microsoft/vscode/blob/1.100.0/package.json>, <https://releases.electronjs.org/releases.json>
22. VS Code docs, Continuous Integration (approved 2026-09-30): <https://code.visualstudio.com/api/working-with-extensions/continuous-integration>
23. GitHub runner images: <https://github.com/actions/runner-images/blob/main/README.md>, <https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md>
24. VS Code docs, Webview API: <https://code.visualstudio.com/api/extension-guides/webview>
25. Vue guide, Testing: <https://vuejs.org/guide/scaling-up/testing>
26. Playwright docs, Electron: <https://playwright.dev/docs/api/class-electron>
27. VS Code smoke-test driver: <https://github.com/microsoft/vscode/blob/main/test/automation/src/playwrightElectron.ts>
28. microsoft/playwright-vscode integration test fixture: <https://github.com/microsoft/playwright-vscode/blob/main/tests-integration/tests/baseTest.ts>
29. ExTester: <https://github.com/redhat-developer/vscode-extension-tester>, <https://github.com/redhat-developer/vscode-extension-tester/blob/main/KNOWN_ISSUES.md>
