import { defineConfig } from 'vite-plus'

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
})
