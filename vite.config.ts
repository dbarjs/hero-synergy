import { defineConfig } from 'vite-plus'

// The `e2e` project launches VS Code, so it joins the run only when a `--project` filter is given:
// Vitest has no opt-in project, and `vp test` alone must stay fast (ADR 0004).
const projectFilterGiven = process.argv.some((arg) => /^(-p|--project)(=|$)/.test(arg))

export default defineConfig({
  fmt: {
    semi: false,
    singleQuote: true,
    // Changesets writes the changelogs, the seed is frozen, and `adc init` owns the devcontainer file.
    ignorePatterns: ['**/CHANGELOG.md', 'docs/seed.md', '.devcontainer/devcontainer.json'],
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    // Reported in CI with `vp test --coverage`; a threshold comes in its own ticket.
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'packages/vscode/webview/src/**'],
      exclude: ['**/*.test.ts'],
      reporter: ['text', 'lcov'],
    },
    projects: [
      {
        test: {
          name: 'unit',
          exclude: [
            '**/node_modules/**',
            '**/dist/**',
            // The Mocha tier, its CommonJS bundles and the VS Code downloads.
            'packages/vscode/test/integration/**',
            '**/out-test/**',
            '**/.vscode-test/**',
            // The Playwright-driven tier lives in the `e2e` project.
            'packages/vscode/test/e2e/**',
          ],
        },
      },
      ...(projectFilterGiven
        ? [
            {
              root: 'packages/vscode',
              test: {
                name: 'e2e',
                include: ['test/e2e/**/*.test.ts'],
                // The only retry in the repo: a window launch is the one thing allowed to flake.
                retry: 1,
                testTimeout: 120_000,
                hookTimeout: 180_000,
                // One VS Code per worker; keep the files sequential.
                fileParallelism: false,
              },
            },
          ]
        : []),
    ],
  },
})
