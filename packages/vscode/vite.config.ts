import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: [
    // Extension host: one CommonJS bundle, `vscode` stays external.
    {
      entry: ['src/extension.ts'],
      format: ['cjs'],
      deps: { neverBundle: ['vscode'] },
    },
    // Extension-host tests: Mocha files bundled to CommonJS into their own
    // directory, outside `dist`, for `vscode-test` to load.
    {
      entry: ['test/integration/**/*.test.ts'],
      outDir: 'out-test',
      format: ['cjs'],
      deps: { neverBundle: ['vscode', 'mocha'] },
    },
    // Spike only: the same tests as ESM, to see whether the host loads `.mjs`.
    {
      entry: ['test/integration/**/*.test.ts'],
      outDir: 'out-test-esm',
      format: ['esm'],
      deps: { neverBundle: ['vscode', 'mocha'] },
    },
  ],
  // Cockpit webview: a Vue app built into dist/webview.
  root: 'webview',
  plugins: [vue()],
  build: {
    outDir: '../dist/webview',
    emptyOutDir: true,
  },
})
