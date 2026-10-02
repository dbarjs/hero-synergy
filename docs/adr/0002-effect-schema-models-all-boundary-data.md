# Effect Schema models all boundary data; zod is dropped

Every piece of data that crosses a boundary (the snapshot, config, webview messages, status events and `SKILL.md` frontmatter) is modeled with Effect Schema. zod, which the seed listed as a required part of the stack, is not used. Effect is already required for workflows, and measurement showed its Schema module does every job the seed gave zod at the same cost, so a second schema library would only add a second dialect to learn and maintain.

What was measured on 2026-10-02, with Effect 4.0.0 and zod 4.6.5:

- **JSON Schema for the scout.** `claude -p --json-schema` on Haiku accepts the `schema` of `Schema.toJsonSchemaDocument()`, with its `definitions` moved under `$defs`. Shared definitions, descriptions, optional and nullable fields and records all work. zod's `z.toJSONSchema()` also works, but only after its `$schema` key is removed.
- **Webview bundle.** Validating a sample webview message costs 24.9 KB gzipped with Effect Schema and 25.9 KB with zod.
- **Use outside Effect code.** `Schema.decodeUnknownSync` is a plain function, and `Schema.toStandardSchemaV1` serves any library that asks for a Standard Schema.

Three rules come with the decision:

- **Boundary data is plain JSON.** A schema's decoded type and its encoded form are the same shape: timestamps stay ISO strings and schemas don't transform. The JSON Schema the model fills, the webview message and the scout's cache then all share one shape.
- **The webview doesn't validate.** It imports types only. The host and the webview ship in one `.vsix`, so they can't be on different versions, and the host already validated the snapshot. The host validates messages arriving from the webview.
- **`@hero-synergy/core` doesn't export schema objects.** It exports types and functions that parse, which keeps its interface small. Core is a private workspace package in v0.1.0, so this rule is cheap to change; it becomes hard to change if core is ever published.

## Considered options

- **zod for boundary data, Effect for workflows** (the seed's default). It doesn't force modeling anything twice, because Effect code carries a zod-inferred type like any other type. Rejected: with JSON Schema support and bundle cost equal, it keeps two schema libraries where one is enough.
- **Effect Schema for the snapshot, zod for config and messages.** Rejected: two dialects in one codebase, with no job that only zod can do.
- **zod/mini in the webview** (7.6 KB gzipped). Rejected: the webview doesn't validate at all, which costs nothing.

## Consequences

- `@anthropic-ai/claude-agent-sdk` declares zod as a peer dependency. If the Agent SDK fallback is built, zod is installed beside it, and no hero-synergy code imports it.
- Don't reach for schema transforms (a `Date` from a string, for example) on boundary data. If one is ever needed, the JSON Schema sent to the model describes the encoded side only.
