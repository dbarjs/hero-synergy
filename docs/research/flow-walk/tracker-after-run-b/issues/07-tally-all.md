# 07: `tally all`

Status: resolved
Blocked by: 04, 05, 06

Spec: [spec.md](../spec.md)

**What to build:** `tally all <file>` prints one report with three counts, in the order words, lines, characters, through the existing report formatter, and exits 0. This follows decision 03. Each count in the report matches what its single-count subcommand reports for the same file. After this ticket the usage line is in its final form.

- [x] `tally all <file>` returns code 0, and its output is exactly three lines in this order: `words: <number>`, `lines: <number>`, `characters: <number>`.
- [x] A file containing `"héllo 👋\nsecond line\n"` (with a precomposed `é`) reports `words: 4`, `lines: 2`, `characters: 20`.
- [x] An empty file reports `words: 0`, `lines: 0`, `characters: 0`.
- [x] For at least one non-trivial file, a test checks that each count in the `all` report equals the output of `tally words`, `tally lines` and `tally characters` on that file.
- [x] `all` is a subcommand table entry that lists the same three counts the single-count subcommands use, in the order words, lines, characters. No counting logic is duplicated.
- [x] An unknown subcommand, no arguments and a missing file argument each return code 2 with output exactly `usage: tally <words|lines|characters|all> <file>`.
- [x] Tests go through `run(argv)` using the fixture helper from 04, and `npm test` is green.

## Comments

- Implemented on integration branch `worktree-word-counts` in `a59b8da` (`tally all`); code-review fixes in `7de7607`..`b4f1339`. All acceptance criteria verified, including the real CLI end to end; `npm test` green (24 tests at `b4f1339`). Not yet merged to `main`.
