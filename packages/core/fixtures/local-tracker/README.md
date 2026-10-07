# Local tracker fixture

A repo on the local markdown tracker, seeded into the in-memory file system by `src/scout/local.test.ts` and `src/scout/find-repo.test.ts` under a made-up root. `docs/agents/issue-tracker.md` is the tracker doc; `.scratch/` holds three effort directories in directory order, plus a stray file that is no effort:

- `billing-rewrite` (map 1): a map in the current five-section form, one resolved ticket the map records as a decision, one claimed ticket blocked by it, one open ticket blocked by both.
- `cockpit-colors` (map 2): a ticket without an H1, titled from its slug, and a resolved ticket the map rules out of scope.
- `onboarding-spec` (position 3, no map): a `/to-spec` effort whose issue files belong to no map, so they land in `unmapped` with `no-map`.

The repo's `.gitignore` ignores `.scratch` everywhere and re-includes the ones under a fixtures directory.
