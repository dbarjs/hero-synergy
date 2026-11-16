# 07: `tally all`

Status: resolved
Blocked by: 04, 05, 06

Spec: [spec.md](../spec.md)

**What to build:** `tally all <file>` prints one report with three counts, in the order words, lines, characters, through the existing report formatter, and exits 0. This follows decision 03. Each count in the report matches what its single-count subcommand reports for the same file. After this ticket the usage line is in its final form.

- [ ] `tally all <file>` returns code 0, and its output is exactly three lines in this order: `words: <number>`, `lines: <number>`, `characters: <number>`.
- [ ] A file containing `"héllo 👋\nsecond line\n"` (with a precomposed `é`) reports `words: 4`, `lines: 2`, `characters: 20`.
- [ ] An empty file reports `words: 0`, `lines: 0`, `characters: 0`.
- [ ] For at least one non-trivial file, a test checks that each count in the `all` report equals the output of `tally words`, `tally lines` and `tally characters` on that file.
- [ ] `all` is a subcommand table entry that lists the same three counts the single-count subcommands use, in the order words, lines, characters. No counting logic is duplicated.
- [ ] An unknown subcommand, no arguments and a missing file argument each return code 2 with output exactly `usage: tally <words|lines|characters|all> <file>`.
- [ ] Tests go through `run(argv)` using the fixture helper from 04, and `npm test` is green.

## Comments

Resolved by `c4aa77f` (`tally all`) on `feature/word-counts`. Code-review fixes followed in `9260de3`..`793d530`. `npm test` green (24 tests).
