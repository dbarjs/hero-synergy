import { name } from '@hero-synergy/core'
import type { ExtensionContext } from 'vscode'

export function activate(_context: ExtensionContext): void {
  console.log(`hero-synergy: activated (${name})`)
}

export function deactivate(): void {}
