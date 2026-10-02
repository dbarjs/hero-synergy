# Scout prototype — throwaway

Answers the ticket [Does the scout's interpret step earn its place?](https://github.com/dbarjs/hero-synergy/issues/16): does the hybrid pipeline (collect with code, interpret with Haiku, reconcile with code) beat code-only parsing by enough to justify a model call?

Everything here is disposable. No dependencies beyond Node 22+, `gh` and `claude`.

## Run

```bash
node scout.mjs collect > bundle.json                 # one GraphQL query, this repo's map
node scout.mjs frontier bundle.json                  # code-only snapshot: maps, frontier, warnings
node scout.mjs frontier fixtures/legacy.mjs          # same, on the legacy-form fixture
node scout.mjs compare bundle.json                   # code vs Haiku, field by field (default: full schema, thinking on)
MAX_THINKING_TOKENS=0 node scout.mjs compare bundle.json --lean   # fastest variant
node scout.mjs interpret bundle.json --whole         # the seed's literal shape: one call for the whole bundle
```

`--lean` asks the model only for what code cannot read (gists, free-form content, warnings), with no verbatim echo. `SCOUT_EFFORT=low` passes `--effort low`. Model readings are cached per item by content hash under `.cache*`; a warm run makes zero calls.

## What was measured

Two inputs:

- **This repo's map** (`bundle.json`, 2026-10-02): one well-formed five-section map and 20 tickets, 105 KB from one GraphQL query of 6 rate-limit points in 2.3 s.
- **A legacy fixture** (`fixtures/legacy.mjs`): a Notes/Decisions/Fog map with a task list of children, `Part of #n` and `Blocked by:` lines, a `wayfinder:claimed` label, a `Type:` line, tickets without `## Question`, a ticket with two type labels, a closed ticket never recorded on the map, and a free-form map written by hand.

Results are in `results/`. Costs are Anthropic list prices as `claude -p` reports them; the login was a claude.ai subscription, so nothing was billed.

| Variant (21 items, concurrency 4) | Wall | Per call | Cost | Output tokens | Frontier | Fields differing from code |
| --- | --- | --- | --- | --- | --- | --- |
| Code only | 3 ms | — | 0 | — | #20, #21 | — |
| Haiku, full schema, default thinking | 222 s | 38 s | $0.50 | 84K (thinking most of it) | same | 16 of 127: every "verbatim" text paraphrased |
| Haiku, lean schema | 144 s | 27 s | $0.36 | 56K, 49K of them thinking | same | 2 of 104 (shape only) |
| Haiku, lean, `--effort low` | 136 s | 24 s | $0.33 | 53K, 44K thinking | same | 2 of 104 |
| Haiku, lean, `MAX_THINKING_TOKENS=0` | 20 s | 3.9 s | $0.11 | 6K | same | missed 5 of the 6 Out of scope tickets |
| Haiku, one call for the whole bundle | 134 s | — | $0.12 | 12.6K | n/a | invented `Part of #1` on all 20 tickets; questions cut to a quarter |
| Warm cache, any variant | 1 ms | — | 0 | — | same | — |

Concurrency 8 did not beat concurrency 4 (20 s both): process start-up dominates once thinking is off.

On the fixture, code-only reading found the right frontier of both maps (#2 and #9; #7) and raised one warning per drift point. Haiku with thinking agreed on every frontier; without thinking it misread both map body forms.

## What the model reads that code cannot

- **A free-form map.** From the hand-written "Checkout redesign" body, Haiku (with thinking) pulled the destination, the one decision with its ticket number, the Apple Pay exclusion and the EU-tax fog. Code sees only "free-form, no sections".
- **One-sentence summaries** of a question when the body opens with a statement rather than a question. The ticket title already does this job.
- **Gists of long answers** (a resolution comment in one sentence).

Neither code nor model classified the fixture's "#5 was dropped, see the comment there" line as out of scope; both left #5 "unrecorded" and the model flagged the line as vague.

## What the model costs

- **Time:** 20 s to 4 min per cold refresh of one map of 21 items, against 3 ms. A repo with 45 maps is a multi-minute cold start with every variant.
- **Fabrication:** the whole-bundle call reported a `Part of #1` line on every ticket; no ticket has one. Per-item calls paraphrased fields asked for verbatim.
- **Warnings are not drift reports.** With thinking: `## Context` sections flagged as non-standard, native blockers reported as "not in Blocked by format". Without thinking: editorial remarks ("answer is very long", "Windsurf is now called Devin Desktop"). None of the real map's warnings pointed at anything the Cockpit should show.
- **Nondeterminism:** out-of-scope ticket lists and body forms changed between runs of the same input.

## Facts about `claude -p` worth keeping

- The seed's command works as written under a claude.ai subscription login: `--model haiku --safe-mode --permission-mode dontAsk --no-session-persistence --output-format json --json-schema`. The result is in `.structured_output`.
- `--tools ""` cuts the default system prompt from 18.1K to 4.4K tokens; the default prompt is prompt-cached on the second call (`cache_read_input_tokens`).
- `--bare` skips keychain reads and so fails with "Not logged in" under a subscription login.
- Haiku 4.5 thinks by default under `claude -p`; `--effort low` barely changes it, `MAX_THINKING_TOKENS=0` turns it off (and `CLAUDE_CODE_DISABLE_THINKING=1` too).
- `blockedBy.nodes` in GraphQL includes closed blockers; `issueDependenciesSummary.blockedBy` counts open ones only.
