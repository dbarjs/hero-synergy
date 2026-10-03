import { defineConfig } from 'vite-plus'

// The `e2e` project launches VS Code, so it only joins the run when a
// `--project` filter is given: `vp test` alone stays fast.
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
    projects: [
      {
        test: {
          name: 'unit',
          exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/out-test*/**',
            '**/.vscode-test/**',
            // Mocha files for the extension host and the Playwright-driven e2e tier.
            'packages/vscode/test/integration/**',
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
