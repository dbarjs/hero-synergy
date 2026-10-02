# Extension-host tests run on Mocha beside Vitest

The repo has two test runners. Vitest, through `vp test`, runs everything that does not need a live VS Code: `@hero-synergy/core`, the extension's pure logic, the session status plugin, the Cockpit's Vue app under happy-dom, and an `e2e` project that launches VS Code through Playwright's Electron support and drives it from the outside. Mocha, through `@vscode/test-cli` and `@vscode/test-electron` and started as `vp run --filter hero-synergy test:integration`, runs the tests that must execute inside the extension host: activation, the view resolving, terminals, the real `vscode` API. There is no first-party way to run Vitest inside the extension host, and the one community pool for it is immature, so the host tier is written against Mocha's API even though the rest of the repo is Vitest. The `vscode` module is imported only in adapter modules under `packages/vscode/src/vscode/`, so that host tier stays small and slow while the bulk of the extension is unit-tested.

The stack additions are `@vscode/test-cli`, `@vscode/test-electron` and `@types/mocha` for the host, `playwright` as a library for the `e2e` project, and `happy-dom` with `@vue/test-utils` for the Cockpit.

## Considered options

- **Vitest inside the extension host** through `vitest-environment-vscode`. Rejected: 0.1.3, built on Vitest's experimental custom-pool API, last released before Vitest 5, and never verified under `vp test`.
- **Playwright Test as the end-to-end runner.** Rejected: a third runner with its own config and reporter, when a Vitest project with a Playwright fixture does the same job inside `vp test`. It is what the Vitest extension itself does.
- **Vitest Browser Mode for the Cockpit.** Rejected for v0.1.0: the end-to-end tier already covers real rendering inside the real webview, and Browser Mode's Playwright provider must be pinned to the exact Vitest that Vite+ bundles, which couples every Vite+ upgrade to a second package.
- **`wdio-vscode-service` or ExTester.** Rejected: a third runner stack with a matching ChromeDriver; thinly maintained or Mocha-only; no surveyed extension uses either.

## Consequences

- "Use `vp` for everything" survives as: every test runs through a `vp` command; never call `vitest`, `mocha` or `vscode-test` directly.
- Host test files are bundled to CommonJS by a second `pack` entry into their own output directory, outside `dist`, which `vp pack` cleans and the VSIX ships. They need their own tsconfig so `@types/mocha`'s globals do not leak into Vitest files.
- CI needs a display server on Linux (`xvfb-run -a`) and a second job, `vscode`, that runs the host and end-to-end tiers on Linux and macOS with the VS Code download cached by version. The host tier runs on both the `engines.vscode` floor and the newest stable.
- Host tests run on the Node bundled in VS Code, not the workspace's Node; test bundles target the floor.
- Anyone adding a host test learns a second assertion style. Keeping the host tier to the adapters limits how often that happens.
