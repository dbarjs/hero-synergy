import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: [
    // Extension host: one CommonJS bundle on the floor's Node (22 in VS Code 1.105), `vscode`
    // stays external.
    {
      entry: ['src/extension.ts'],
      format: ['cjs'],
      target: 'node22',
      deps: { neverBundle: ['vscode'] },
    },
    // Extension-host tests: Mocha files bundled to CommonJS into their own directory, outside
    // `dist`, for `vscode-test` to load. ESM test files hang the 1.105 host (ADR 0004).
    {
      entry: ['test/integration/**/*.test.ts'],
      outDir: 'out-test',
      format: ['cjs'],
      target: 'node22',
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
