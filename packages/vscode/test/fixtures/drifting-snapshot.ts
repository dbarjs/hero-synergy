import { FileSystem, readLocalTracker, type Snapshot } from '@hero-synergy/core'
import { Effect } from 'effect'

import { workspaceFiles } from './workspace-files.ts'

const ROOT = '/home/ana/billing'

/** The fixture workspace as the scout reads it: clean, no drift anywhere. */
export const cleanSnapshot = (): Promise<Snapshot> =>
  Effect.runPromise(
    readLocalTracker(ROOT).pipe(Effect.provide(FileSystem.inMemory(workspaceFiles(ROOT)))),
  )

/**
 * The fixture with drift planted: on map #3 a loud and a quiet warning on ticket #1, a quiet one
 * on ticket #2 and a quiet one on the map; a loud one on the first closed ticket of the finished
 * map #1; and one stray ticket of no map. Map #2 stays clean.
 */
export const driftingSnapshot = async (): Promise<Snapshot> => {
  const snapshot = await cleanSnapshot()
  const stray = snapshot.maps.find((map) => map.number === 3)?.tickets.find((t) => t.number === 3)
  if (stray === undefined) throw new Error('the fixture lost its ticket')
  return {
    ...snapshot,
    maps: snapshot.maps.map((map) => {
      if (map.number === 3) {
        return {
          ...map,
          warnings: [{ code: 'map-body-legacy' as const, detail: 'Fog' }],
          tickets: map.tickets.map((ticket) => {
            if (ticket.number === 1) {
              return {
                ...ticket,
                warnings: [
                  { code: 'type-missing' as const },
                  { code: 'type-as-line' as const, detail: 'Type: prototype' },
                ],
              }
            }
            return ticket.number === 2
              ? { ...ticket, warnings: [{ code: 'ticket-title-from-slug' as const }] }
              : ticket
          }),
        }
      }
      if (map.number === 1) {
        return {
          ...map,
          tickets: map.tickets.map((ticket, index) =>
            index === 0
              ? { ...ticket, warnings: [{ code: 'closed-no-resolution' as const }] }
              : ticket,
          ),
        }
      }
      return map
    }),
    unmapped: [{ ...stray, warnings: [{ code: 'no-map' as const }] }],
  }
}

/** The fixture with map #2 read as a free-form body: the sections are empty and the prose stays. */
export const freeFormSnapshot = async (): Promise<Snapshot> => {
  const snapshot = await cleanSnapshot()
  return {
    ...snapshot,
    maps: snapshot.maps.map((map) =>
      map.number === 2
        ? {
            ...map,
            body: 'Just some prose about billing.',
            destination: null,
            decisions: [],
            notYetSpecified: [],
            outOfScope: [],
            warnings: [{ code: 'map-body-free-form' as const }],
          }
        : map,
    ),
  }
}
