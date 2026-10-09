# Scratch mirror fixture

A sanitized mirror of a private five-month production tracker on the local markdown tracker: the end-to-end benchmark for reading state from `.scratch` at real scale ([map 130](https://github.com/dbarjs/hero-synergy/issues/130), [ticket 132](https://github.com/dbarjs/hero-synergy/issues/132)). `seed.ts` loads it into the in-memory file system under a made-up root; `src/scout/scratch-mirror.test.ts` checks it loads and that the truth names every file.

- `.scratch/`: 49 efforts, `effort-01` to `effort-49` in the source's sorted order, holding its 342 Markdown files in their places: 35 maps (`MAP.md`), 257 tickets under `issues/` and 50 other notes. Non-Markdown files are dropped, so some links dangle.
- `docs/agents/issue-tracker.md`: a tracker doc that makes this a local-tracker repo. The source's own doc was not copied.
- `truth.json`: the careful reading of every file, by path. A map has its `state` (`open`, `in-progress`, `closed`); a ticket has its `state` (`open`, `claimed`, `in-progress`, `closed`), `type`, `blockedBy` (ticket numbers in the same effort), `map` and `resolution` (the line that opens it as written here, and the H2 it sits under); every other file is a `note` with the survey's kind. The 24 files [ticket 134](https://github.com/dbarjs/hero-synergy/issues/134) settles have `settled: false`.
- `tools/`: the scripts that build all of it, rerun when the tracker grows.

## What the mirror keeps

The sanitizer works on an allowlist (`tools/vocabulary.ts`). Kept: header keys, state words and section headings in both of the source's languages, `wayfinder:` labels, triage roles, AFK/HITL, Markdown structure and line styles, ticket numbers, and the links between files with their targets renamed. Dates move by one fixed offset, kept beside the corpus. Every other word is replaced: a run of them becomes `lorem`, and a line left with nothing that carries state becomes `Lorem ipsum.`. Titles become `Lorem ipsum` after their `Type:` prefix, numbers of three digits or more become `100`, and URLs off GitHub's hero-synergy and skills repos become `https://example.com/`. A ticket keeps its number (`07-ticket.md`); other files and directories get generic names.

## Rebuilding it

The corpus and the survey records live only on the machine that holds them, never in the repo. From the repo root, with the offset from the survey directory:

```sh
node packages/core/fixtures/scratch-mirror/tools/sanitize.ts --corpus <corpus> --out packages/core/fixtures/scratch-mirror/.scratch --shift-days=<offset>
node packages/core/fixtures/scratch-mirror/tools/truth.ts --corpus <corpus> --records <survey>/records --shift-days=<offset> --out packages/core/fixtures/scratch-mirror/truth.json
node packages/core/fixtures/scratch-mirror/tools/leak-check.ts --corpus <corpus> $(git ls-files --others --modified packages/core/fixtures/scratch-mirror)
```

Clear `.scratch/` first when files were removed. Nothing leaves the machine until the leak check passes on every changed file. It fails on a word the corpus uses that is neither a lower-case dictionary word (Debian's `wamerican`) nor in `tools/reviewed-words.txt` or the repo's public text, and on a URL off the allowed hosts. Every kept word the dictionary lacks, the second language's included, is on the reviewed list, with the code words of these tools and their tests; add a word there only after reviewing it. The tests' two invented URLs fail the URL rule on purpose.
