import { Option, Schema } from 'effect'

import type { WebviewMessage } from './protocol.ts'

/**
 * The messages the webview may send, validated by the host. Anything else is
 * dropped: the webview is our own code, but a bundle bug or a foreign frame must
 * never reach the Cockpit's state.
 */
const WebviewMessageSchema = Schema.Union([
  Schema.Struct({ type: Schema.Literal('ready') }),
  Schema.Struct({ type: Schema.Literal('expand'), key: Schema.String }),
  Schema.Struct({ type: Schema.Literal('collapse'), key: Schema.String }),
  Schema.Struct({ type: Schema.Literal('select'), key: Schema.NullOr(Schema.String) }),
  Schema.Struct({ type: Schema.Literal('open'), key: Schema.String }),
  Schema.Struct({ type: Schema.Literal('refresh') }),
  Schema.Struct({
    type: Schema.Literal('open-detail'),
    key: Schema.String,
    section: Schema.NullOr(
      Schema.Literals(['destination', 'decisions', 'fog', 'out-of-scope', 'drift']),
    ),
  }),
  Schema.Struct({ type: Schema.Literal('reveal'), key: Schema.String }),
  Schema.Struct({ type: Schema.Literal('open-link'), url: Schema.String }),
  Schema.Struct({ type: Schema.Literal('launch'), key: Schema.String }),
  Schema.Struct({ type: Schema.Literal('focus-terminal'), key: Schema.String }),
  Schema.Struct({ type: Schema.Literal('copy'), key: Schema.String }),
  Schema.Struct({ type: Schema.Literal('dismiss-drift'), dismissKey: Schema.String }),
])

const decode = Schema.decodeUnknownOption(WebviewMessageSchema)

/** The message, or null when the input is not one the webview may send. */
export const decodeWebviewMessage = (input: unknown): WebviewMessage | null =>
  Option.getOrNull(decode(input))
