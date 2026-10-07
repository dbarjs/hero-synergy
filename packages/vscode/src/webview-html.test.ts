import { describe, expect, it } from 'vite-plus/test'

import { makeNonce, webviewHtml } from './webview-html.ts'

const page = webviewHtml({
  cspSource: 'https://file+.vscode-resource.vscode-cdn.net',
  scriptUri: 'https://file+.vscode-resource.vscode-cdn.net/dist/webview/main.js',
  styleUri: 'https://file+.vscode-resource.vscode-cdn.net/dist/webview/main.css',
  nonce: 'abc123',
})

describe('the webview page', () => {
  it('loads the bundle and its style and nothing else', () => {
    expect(page).toContain(
      '<script type="module" nonce="abc123" src="https://file+.vscode-resource.vscode-cdn.net/dist/webview/main.js">',
    )
    expect(page).toContain(
      'href="https://file+.vscode-resource.vscode-cdn.net/dist/webview/main.css"',
    )
    expect(page).toContain('<div id="app"></div>')
  })

  it('allows only the nonce for scripts and the webview origin for styles and fonts', () => {
    const policy = /Content-Security-Policy"\s+content="([^"]+)"/.exec(page)?.[1]
    expect(policy).toBe(
      "default-src 'none'; style-src https://file+.vscode-resource.vscode-cdn.net; font-src https://file+.vscode-resource.vscode-cdn.net; script-src 'nonce-abc123';",
    )
  })

  it('has no inline script', () => {
    const scripts = [...page.matchAll(/<script\b[^>]*>([^<]*)<\/script>/g)]
    expect(scripts).toHaveLength(1)
    expect(scripts[0]?.[1]).toBe('')
  })

  it('makes a different 32-character hex nonce each time', () => {
    const [a, b] = [makeNonce(), makeNonce()]
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(a).not.toBe(b)
  })
})
