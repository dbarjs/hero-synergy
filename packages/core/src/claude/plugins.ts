import { Schema } from 'effect'

import type { HealthWarning } from '../snapshot/warnings.ts'
import { attempt, type Decoded, decoder, parseJson, warn } from './decode.ts'

/**
 * What the Cockpit reads of Claude Code's plugins: the install list from
 * `claude plugin list --json` and each plugin's own manifest. Both are
 * lenient about fields added later. A list or a manifest that cannot be read
 * is `plugin-manifest-unreadable`, the one plugin code the catalogue has.
 */

const Install = Schema.Struct({
  id: Schema.String,
  version: Schema.String,
  enabled: Schema.Boolean,
  installPath: Schema.String,
  scope: Schema.optionalKey(Schema.String),
})

const decodeInstall = decoder(Install)

export interface PluginInstall {
  /** `<plugin>@<marketplace>`, as Claude Code names the install. */
  readonly id: string
  readonly version: string
  readonly enabled: boolean
  readonly installPath: string
  readonly scope: string | null
}

export function readPluginList(stdout: string): Decoded<ReadonlyArray<PluginInstall>> {
  const parsed = parseJson(stdout)
  if (!parsed.ok) {
    return {
      value: [],
      warnings: [warn('plugin-manifest-unreadable', `plugin list: ${parsed.message}`)],
    }
  }
  if (!Array.isArray(parsed.value)) {
    return {
      value: [],
      warnings: [warn('plugin-manifest-unreadable', 'plugin list: not an array of plugins')],
    }
  }
  const plugins: PluginInstall[] = []
  const warnings: HealthWarning[] = []
  for (const [index, raw] of parsed.value.entries()) {
    const decoded = attempt(decodeInstall, raw)
    if (!decoded.ok) {
      warnings.push(
        warn('plugin-manifest-unreadable', `plugin list entry ${index}: ${decoded.message}`),
      )
      continue
    }
    const { id, version, enabled, installPath, scope } = decoded.value
    plugins.push({ id, version, enabled, installPath, scope: scope ?? null })
  }
  return { value: plugins, warnings }
}

/** The plugin name of an install id: `mattpocock-skills@claude-plugins-official` is `mattpocock-skills`. */
export function pluginNameOf(id: string): string {
  const at = id.lastIndexOf('@')
  return at > 0 ? id.slice(0, at) : id
}

const Manifest = Schema.Struct({
  name: Schema.String,
  version: Schema.optionalKey(Schema.String),
  skills: Schema.optionalKey(Schema.Array(Schema.String)),
})

const decodeManifest = decoder(Manifest)

export interface PluginManifest {
  readonly name: string
  readonly version: string | null
  /** The skill folders the manifest lists, as written (`./skills/engineering/wayfinder`). Empty when it lists none. */
  readonly skills: ReadonlyArray<string>
}

/** The text of a plugin's `plugin.json`. */
export function readPluginManifest(text: string): Decoded<PluginManifest | null> {
  const parsed = parseJson(text)
  if (!parsed.ok) {
    return { value: null, warnings: [warn('plugin-manifest-unreadable', parsed.message)] }
  }
  const decoded = attempt(decodeManifest, parsed.value)
  if (!decoded.ok) {
    return { value: null, warnings: [warn('plugin-manifest-unreadable', decoded.message)] }
  }
  const { name, version, skills } = decoded.value
  return { value: { name, version: version ?? null, skills: skills ?? [] }, warnings: [] }
}
