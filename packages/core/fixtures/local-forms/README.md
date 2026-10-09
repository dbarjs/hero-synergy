# Local tracker forms

One small invented file for every form [State forms on a real local tracker](https://github.com/dbarjs/hero-synergy/issues/131) catalogued on a real five-month local tracker, each with its careful reading. Built for [A pattern fixture for every catalogued form](https://github.com/dbarjs/hero-synergy/issues/133) on map [#130](https://github.com/dbarjs/hero-synergy/issues/130). The text is invented; only the forms are the real tracker's, and every file passed the map's leak check against it.

- `.scratch/` is a local tracker: one effort per group of forms, so blocker numbers and `Map:` links resolve inside their effort.
  - `status-lines`, `claims`, `types`, `blockers`, `resolutions` and `traps` hold one ticket per form and no map.
  - `map-*` hold one map per map form: `MAP.md` or `map.md`, its Status line and header lines, extra sections.
  - `membership`, `prd-in-map`, `no-map-triage` and `no-map-prd` hold the membership lines, `/to-tickets` issues beside a map, and efforts with no map.
  - `other-files` holds what is not a ticket: research write-ups, asset notes, a handoff and a QA checklist.
- `truth.json` holds, per file, the form it stands for, its kind (`ticket`, `map` or `note`) and its careful reading. A ticket's reading is its state (`open`, `claimed` or `closed`), triage role, assignee, type, AFK or HITL, map, PRD parent, the blockers and blocked tickets its own lines name, and its resolution: where it sits, its first line and its byline. The readings follow [Where a local ticket's type and blockers come from](https://github.com/dbarjs/hero-synergy/issues/137) and [Where a local ticket's resolution lives](https://github.com/dbarjs/hero-synergy/issues/138). A map's reading is its state and the tickets its Decisions so far links.
- A reading is what the file's own lines declare, as [The truth for the files a careful reader can't call](https://github.com/dbarjs/hero-synergy/issues/134) settled: `ready-for-human` is an open ticket's role, one OPEN half keeps a ticket open, and a map with no Status line or with `route walked` is open. `disagreements` lists evidence elsewhere that contradicts the declared state, such as a map's prose closing tickets their files keep open. It never changes the reading.
- `forms.ts` loads it: `localForms()` gives every file with its body and truth for one table test, and `formsRepo(root)` the tree for `FileSystem.inMemory`. `src/scout/local-forms.test.ts` keeps the fixture whole.

Add a form by adding its file and its entry in `truth.json`. A form taken from a real tracker passes that tracker's leak check before it is pushed.
