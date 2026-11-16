# PROTOTYPE: how do specs and build tickets render in the Tree and the Detail?

Throwaway code for the ticket [#202 How do specs and build tickets render in the Tree and the Detail?](https://github.com/dbarjs/hero-synergy/issues/202) on the map [#195 Specs and build tickets in the Cockpit](https://github.com/dbarjs/hero-synergy/issues/195). It lives on the `prototype/spec-rendering` branch only and never merges to `main`.

Each variant draws the whole Cockpit in a VS Code frame: the Tree in the side bar and the Detail in an editor tab, with one shared selection. Rows are the real `Row.vue`. Maps and decision tickets render through the real `Detail.vue`, and the Focus pane copies the real `FocusPane.vue`. Only specs and build tickets are new.

## Run it

```bash
cd packages/vscode
pnpm run prototype        # vp dev on port 5202
# open http://localhost:5202/prototype.html
```

Use the yellow bar or `←` `→` to switch variants. Everything is in the URL, so a view can be shared:

| Param       | Values                 | Meaning                                                               |
| ----------- | ---------------------- | --------------------------------------------------------------------- |
| `variant`   | `A` `B` `C` `D`        | where a spec sits                                                     |
| `when`      | `now` `oct7`           | this repo today (#163, 11 build tickets) or on 2026-10-07 18:40 (#37) |
| `detail`    | `progress` `issue`     | the spec and build-ticket Detail: in parts, or the body as written    |
| `select`    | `b:172` `specitem:163` | the selected row (`map:` `mapitem:` `t:` `spec:` `b:` `lone:`)        |
| `width`     | `narrow` `wide`        | the side bar at 320px or 440px                                        |
| `theme`     | `dark` `light`         | stands in for the VS Code theme                                       |
| `collapsed` | (present)              | start with every map and spec folded                                  |

## The four variants: where a spec sits

- **A, Under its map.** The spec unfolds inside the map it came from, after the map's open tickets, and its build tickets sit one level deeper. A finished map whose spec is still being built stays out of Finished, and its row shows the spec's counts. A closed map comes back, muted, to carry its open spec. A spec with no map sits at the top level.
- **B, Beside the maps.** One list of two kinds, ordered together by urgency: maps still deciding and specs still building. A spec row says where it came from (`from #130 (closed)`). Once its spec exists, a finished map goes to Finished and points at it (`→ #163`). A built spec joins it there.
- **C, A section of its own.** Two views in the Hero Synergy container, as VS Code stacks them: SPECS on top, MAPS below, unchanged from today. Each view has its own badge. Specs say `← #130`, and finished maps in Finished say `spec #163`.
- **D, The spec takes over its map.** One row per effort. While the map decides, the row is the map, as today. Once `/to-spec` publishes, the row becomes the spec: its number and title lead, the build tickets are its children, and the map moves inside as a `⚑ #130 …` item with its Decisions fold. A map never sits in Finished while its spec is open, and a closed map rides inside its spec.

These parts are the same in all four variants:

- **The spec row.** A `file-text` icon, then `#n title`, then a trail: ▶, `N needs you`, the takeable badge (or `nothing takeable`, or `no tickets yet`), and built/total. ▶ runs **To tickets** when the spec has no build tickets and **Implement #next** when one is takeable. It runs nothing otherwise. A spec whose build tickets are all closed is _built_ and folds into Finished with a ✓.
- **Under a spec**, in this order: a `▤ Spec` item that opens the spec's Focus pane (its description is the problem statement's first line), the open build tickets (claimed, then the frontier with `next`, then held, then blocked with `waits on #n`), and a folded `✓ Built` node.
- **The build ticket row.** A `tools` icon, then `#n title`, then a trail: ▶ **Implement** on the frontier, the session's status and age, a pull request chip (`#214` plus a merge, check or ✗ glyph), `waits on #n`, `needs info`, `NEXT`, and AFK or HITL from the triage role.
- **The spec's Focus pane.** The map (or "none: it came from a grilling"), the counts, live sessions, the problem, the number of user stories, then Implement #next and Implement spec, or To tickets.
- **The build ticket's Focus pane.** The spec, the triage role with AFK or HITL, the claim, what it waits on (by name), the session, the worktree, the pull request and the number of boxes. Then Implement, or Resume on an ended session.
- **The Detail.**
  - _Spec, `progress`:_ a bar and a four-column board by place (In progress, Takeable, Waiting, Built), then the spec's sections behind a table of contents, with the user stories folded after the first five.
  - _Spec, `issue`:_ a list of the build tickets in sub-issue order, then the body as written.
  - _Build ticket:_ a three-column neighbourhood (Part of, Waits on, Clears the way for), What to build, and the acceptance criteria with their boxes as written.
  - _The map afterwards:_ a map's Detail opens with a `Spec #163 … · 3/11 built` line, and To spec is not offered again.

## What is real and what is faked

- **Real.** This repo's maps (#195, #159, #130, #123, #1, #64, #22), its specs (#37, #163, #155), their tickets, blockers, claims, closing pull requests and bodies, and the stray `ready-for-agent` issue #36. `refresh-fixture.mjs` pulls them into `fixture.json` (`node webview/src/prototype/refresh-fixture.mjs`). Public issues only, nothing from the private local corpus.
- **Replayed.** `?when=oct7` rewinds the real issues to 2026-10-07 18:40, using `createdAt` and `closedAt`. A build ticket that closed within the next hour counts as claimed then, with a faked session.
- **Invented.** A shop repo's worth of maps and specs, at #1000 and up, in `issues.ts`. Three maps are still deciding. Two finished maps have no spec yet. Four specs show each state: takeable with sessions that need you, a failing pull request and a `needs-info` ticket; no build tickets yet; nothing takeable; built. Two specs have no map. 26 finished maps have closed specs.
- **Faked.** Every session, worktree and open pull request on a build ticket. Commands are the prototype's guesses: [#205](https://github.com/dbarjs/hero-synergy/issues/205), [#206](https://github.com/dbarjs/hero-synergy/issues/206) and [#210](https://github.com/dbarjs/hero-synergy/issues/210) decide them. ▶ and the Action buttons show the command instead of opening a terminal.
- **Rules the prototype assumes, which other tickets decide.**
  - A spec is an issue whose body holds the spec headings, and its map is the first map its preamble links to ([#203](https://github.com/dbarjs/hero-synergy/issues/203)).
  - A spec's frontier follows the map's rule, `needs-info` holds a build ticket off it, and the states are no build tickets, takeable, nothing takeable and built ([#208](https://github.com/dbarjs/hero-synergy/issues/208)).
  - A build ticket shows its pull request ([#209](https://github.com/dbarjs/hero-synergy/issues/209)).

## Screenshots

`screenshots/` holds each variant at both widths (`a-…`, `b-…`, `c-…`, `d-…`), and the four variants folded with Finished open (`overview-a` … `overview-d`). It also holds the spec Detail in both shapes, the map afterwards, #37 mid-build on 2026-10-07, and D in the light theme.
