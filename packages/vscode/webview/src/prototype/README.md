# PROTOTYPE: how do maps render in the Cockpit?

Throwaway code for the ticket [How do maps render in the Cockpit?](https://github.com/dbarjs/hero-synergy/issues/7). It lives on the `prototype/map-rendering` branch only and never merges to `main`.

Four variants of the Cockpit's map view on the webview's only page, fed by this repo's own map.

## Run it

```bash
cd packages/vscode
pnpm run prototype        # vp dev --host, then open http://localhost:5173
```

Flip variants with the yellow bar or the `←` `→` keys. Everything is in the URL, so a view can be shared:

| Param     | Values                           | Meaning                                     |
| --------- | -------------------------------- | ------------------------------------------- |
| `variant` | `A` `B` `C` `D`                  | which variant                               |
| `width`   | `sidebar` `panel`                | frame it at 340px or at full editor width   |
| `theme`   | `dark` `light`                   | stand-in for the VS Code theme              |
| `layout`  | `waves` `longest-path` `dagre`   | variant B only: which layout places the graph |
| `dir`     | `LR` `TB`                        | variant B only: graph direction             |

## The variants

- **A, Frontier list.** Sections ordered by what you can do: needs you, frontier, claimed, blocked, fog, decisions. No graph; a blocked ticket names its blockers in text.
- **B, Graph.** The whole map as one dependency graph, with fog and the destination as nodes. Three layouts: hand-rolled "waves" (column = how many resolutions away), hand-rolled longest path, and dagre.
- **C, List + focus.** A flat list in map order with filter chips, plus a focus pane that draws only the selected ticket's neighbourhood: waits on → ticket → clears the way for.
- **D, Route.** The graph flattened into a trail: walked decisions, what's takeable now, what each resolution opens, the destination. Hover a stop to light up what it waits on and what it clears.

## What is real and what is faked

- Real: the map, its tickets, types, claims, blockers, decisions, fog and out of scope, pulled by `refresh-fixture.mjs` (`node webview/src/prototype/refresh-fixture.mjs` re-pulls it).
- Faked: live sessions. Two are seeded in `data.ts`; "Work" adds a fake one without opening a terminal, and clicking a status pill cycles through the six statuses.
