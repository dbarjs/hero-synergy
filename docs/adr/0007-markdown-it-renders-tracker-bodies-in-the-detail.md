# markdown-it renders tracker bodies in the Detail

The Detail shows a ticket's body, its resolution and a map's destination, decisions and fog as rendered Markdown. They are written by people and by agents, on GitHub or in a file, so they hold headings, lists, code fences, tables and links, and sometimes a stray `<script>` or `<img onerror=…>`. The Cockpit renders them with [markdown-it](https://github.com/markdown-it/markdown-it), a devDependency of the extension package that the webview build bundles into `dist/webview/main.js`.

The renderer runs in the webview, on the Markdown the host sends, so the host's view models stay plain data (ADR 0002) and the same component serves any width. It is configured with `html: false`: raw HTML in a body is escaped and shown as text, never inserted. markdown-it's link validation refuses `javascript:`, `vbscript:`, `file:` and `data:` targets, leaving them as text. The page's policy (`default-src 'none'`, one nonce'd script) blocks inline script and every image fetch regardless. A click on a rendered link never navigates the webview: it is sent to the host as `open-link`, and the host opens only `http` and `https` URLs.

markdown-it is the CommonMark renderer VS Code's own Markdown preview is built on, so a body renders as the person reading it in VS Code already expects. It parses to a token stream and renders to a string in one synchronous call, which suits a Vue component that sets the result with `v-html`.

Measured on 2026-10-07, with markdown-it 15.0.2: the webview bundle grows from 69 kB to 178 kB (about 108 kB, mostly the HTML entity table), and the VSIX carries no extra files since the webview is bundled. Nothing runs in the extension host.

## Considered options

- **`marked`.** Smaller and fast, but it renders raw HTML through unless a sanitizer is added, so safety would be a second dependency to get right. Rejected: `html: false` is one flag.
- **`micromark` or `remark` with `rehype`.** Safe by construction and extensible, at the price of a plugin pipeline (parser, mdast, hast, serializer) the Detail does not need. Rejected: more moving parts for the same output.
- **Rendering in the extension host and sending HTML.** Keeps the bundle small, but the host would send markup, and the webview would trust it. Rejected: markup crossing the boundary is exactly what the policy is there to avoid.
- **A hand-written subset renderer** (the tracker readers in core already split sections by hand). Rejected: bodies hold tables, fences, nested lists and escapes, and a renderer that is almost right is the kind that breaks on the one body that matters.

## Consequences

- Core keeps its small Markdown helpers for reading sections; it never renders.
- Images in a body do not load (the policy has no `img-src`). A future ticket that wants them must widen the policy for GitHub's image hosts deliberately.
- Links to other issues (`#41`, a relative path) are not web links, so a click on them does nothing. Resolving them is a later, separate decision.
- If markdown-it stops being maintained, `Markdown.vue` is the one component to change.
