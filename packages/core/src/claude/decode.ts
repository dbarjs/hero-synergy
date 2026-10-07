import { Schema } from 'effect'

import type { HealthWarning } from '../snapshot/warnings.ts'

/**
 * What every decoder here returns: the value it could read and the health
 * warnings for what it could not. A decoder never throws; unreadable input
 * gives an empty or null value and one coded warning.
 */
export interface Decoded<A> {
  readonly value: A
  readonly warnings: ReadonlyArray<HealthWarning>
}

export type Attempt<A> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly message: string }

/** Decodes with a schema and reports a failure as a message instead of throwing. */
export function attempt<A>(decode: (input: unknown) => A, input: unknown): Attempt<A> {
  try {
    return { ok: true, value: decode(input) }
  } catch (error) {
    return { ok: false, message: messageOf(error) }
  }
}

/** Parses JSON text, reporting a syntax error as a message instead of throwing. */
export function parseJson(text: string): Attempt<unknown> {
  return attempt((input) => JSON.parse(String(input)) as unknown, text)
}

export function messageOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  // A schema error spans lines; the first is the one that says what is wrong.
  return message.split('\n')[0] ?? message
}

export const decoder = <A, I>(schema: Schema.Codec<A, I>): ((input: unknown) => A) =>
  Schema.decodeUnknownSync(schema)

export const warn = (code: HealthWarning['code'], detail: string): HealthWarning => ({
  code,
  detail,
})
