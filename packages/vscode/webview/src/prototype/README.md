# PROTOTYPE: how do maps render in the Cockpit?

Throwaway code for the ticket [#7 How do maps render in the Cockpit?](https://github.com/dbarjs/hero-synergy/issues/7). It lives on the `prototype/map-rendering` branch only and never merges to `main`.

Seven variants on the webview's only page, in two scenes:

- **Many maps** (M1, M2, M3): a repo with 45 maps, 38 of them finished. This is Eduardo's usual case.
- **One map** (A, B, C, D): this repo's own map on its own.

Every ticket and map shows its issue number before its name.

## Run it

```bash
cd packages/vscode
pnpm run prototype        # vp dev --host, then open http://localhost:5173
```

Flip variants with the yellow bar or the `←` `→` keys. Everything is in the URL, so a view can be shared:

| Param     | Values                           | Meaning                                                   |
| --------- | -------------------------------- | --------------------------------------------------------- |
| `variant` | `M1`…`M4` `A` `B` `C` `D`       | which variant                                             |
| `map`     | a map's issue number             | M1 and M3 only: the map that was clicked open             |
| `inside`  | `A` `B` `C` `D`                  | which single-map variant draws the opened map (default D) |
| `width`   | `sidebar` `panel`                | frame it at 340px or at full editor width                 |
| `theme`   | `dark` `light`                   | stand-in for the VS Code theme                            |
| `layout`  | `waves` `longest-path` `dagre`   | variant B only: which layout places the graph             |
| `dir`     | `LR` `TB`                        | variant B only: graph direction                           |

## Many maps

- **M1, Maps, then drill in.** Sessions that need you, then one card per active map (progress, counts, its next ticket, or why nothing is takeable). Finished maps fold into one line with a filter. Click a map to open it.
- **M2, One tree.** Every map is a node that unfolds in place, like the file explorer. No drilling in; finished maps are one folder.
- **M4, Tree + focus (the default).** Eduardo's merge of M2 and C: the tree on the left, and clicking any map, ticket or fog row shows C's focus pane on the right. At sidebar width the pane sits inline under the row, and a second click or ✕ closes it. A "cards" density toggle (M1's cards inside the tree) was tried and removed; `screenshots/m4-cards.png` keeps what it looked like.
- **M3, Frontier across maps.** Tickets first, maps second: everything takeable right now across all active maps, grouped by map. Maps with nothing takeable are called out; a select narrows the view to one map.

## One map

- **A, Frontier list.** Sections ordered by what you can do: needs you, frontier, claimed, blocked, fog, decisions. No graph; a blocked ticket names its blockers in text.
- **B, Graph.** The whole map as one dependency graph, with fog and the destination as nodes. Three layouts: hand-rolled "waves" (column = how many resolutions away), hand-rolled longest path, and dagre.
- **C, List + focus.** A flat list in map order with filter chips, plus a focus pane that draws only the selected ticket's neighbourhood: waits on → ticket → clears the way for.
- **D, Route.** The graph flattened into a trail: walked decisions, what's takeable now, what each resolution opens, the destination. Hover a stop to light up what it waits on and what it clears.

## What is real and what is faked

- Real: this repo's map (#1), its tickets, types, claims, blockers, decisions, fog and out of scope, pulled by `refresh-fixture.mjs` (`node webview/src/prototype/refresh-fixture.mjs` re-pulls it).
- Invented: the other 44 maps, in `maps.ts`. Six active ones each show a state the Cockpit must handle (one ticket left, nothing takeable, mostly fog, large and busy, ordinary, freshly charted); 38 are finished. Their issue numbers start at 1000.
- Faked: live sessions. Five are seeded in `data.ts`; "▶" adds a fake one without opening a terminal, and clicking a status pill cycles through the six statuses.
