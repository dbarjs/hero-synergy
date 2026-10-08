import type { RegistryEntry } from '../claude/registry.ts'

import { type Listed, listedOf } from './session.ts'

/**
 * Which ticket a registry entry belongs to: the leading `#<number>` of its name, whoever started
 * the session. Claude Code renames a second session of the same name `<name>-<two words>`, which
 * keeps the prefix. The entry's folder is never the key.
 */
export function ticketOfName(name: string): number | null {
  const found = /^#(\d+)(?!\d)/.exec(name.trim())
  return found === null ? null : Number(found[1])
}

/**
 * The entries grouped by the ticket number their names start with, oldest first so the first of a
 * group is the session that was there before any duplicate. Entries with no `#<number>` are
 * other people's sessions and are left out.
 */
export function groupByTicket(
  entries: ReadonlyArray<RegistryEntry>,
): ReadonlyMap<number, ReadonlyArray<Listed>> {
  const grouped = new Map<number, RegistryEntry[]>()
  for (const entry of entries) {
    const number = ticketOfName(entry.name)
    if (number === null) continue
    grouped.set(number, [...(grouped.get(number) ?? []), entry])
  }
  return new Map(
    [...grouped].map(([number, group]) => [
      number,
      [...group]
        .sort((a, b) => (a.startedAt ?? Infinity) - (b.startedAt ?? Infinity))
        .map(listedOf),
    ]),
  )
}
