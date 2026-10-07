import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Test helpers: read a file from the fixtures directory as text. */
const fixtures = fileURLToPath(new URL('../../fixtures/', import.meta.url))

export const fixtureText = (path: string): string => readFileSync(`${fixtures}${path}`, 'utf8')

export const fixtureNames = (directory: string): string[] =>
  readdirSync(`${fixtures}${directory}`).sort()
