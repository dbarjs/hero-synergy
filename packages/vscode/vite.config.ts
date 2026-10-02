import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  // Extension host: one CommonJS bundle, `vscode` stays external.
  pack: {
    entry: ['src/extension.ts'],
    format: ['cjs'],
    deps: { neverBundle: ['vscode'] },
  },
  // Cockpit webview: a Vue app built into dist/webview.
  root: 'webview',
  plugins: [vue()],
  build: {
    outDir: '../dist/webview',
    emptyOutDir: true,
  },
})
