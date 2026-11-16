# 04: `tally words`

Status: resolved
Blocked by: None (can start immediately)

Spec: [spec.md](../spec.md)

**What to build:** `tally words <file>` prints a one-count report, `words: <number>`, and exits 0. A word is a maximal run of non-whitespace characters, as the glossary defines it, where whitespace means Unicode whitespace. This ticket also does the one prefactor the spec needs: the CLI's subcommand table changes from "subcommand → one count function" to "subcommand → ordered list of named counts", and `words` becomes its first entry. A bad invocation prints a usage line built from that table and exits 2.

- [ ] `tally words <file>` returns code 0, and its output is exactly `words: <number>`.
- [ ] Runs of spaces, tabs and newlines separate words, and each run counts as a single separator.
- [ ] Leading and trailing whitespace adds no words.
- [ ] Punctuation attached to a word is part of that word (`hello, world` is 2 words).
- [ ] An empty file and an all-whitespace file both report `words: 0`.
- [ ] The subcommand table maps each subcommand to an ordered list of counts, each with a report name and a count function. `run` applies every count in the list to the file's text and passes the resulting name/number pairs, in list order, to the existing report formatter.
- [ ] The word count is a pure function (text in, number out) in a small internal counts module next to the report formatter. Tests don't import it.
- [ ] An unknown subcommand, no arguments and a missing file argument each return code 2 with output `usage: tally <words> <file>`, and the list of subcommands comes from the table.
- [ ] Tests go through `run(argv)` only. Each test writes its file into a fresh temporary directory with explicit UTF-8 encoding, using a small fixture helper that tickets 05–07 will reuse.
- [ ] The existing tests still pass, `npm test` is green, and the tool still has no dependencies.

## Comments

Resolved by commits `dc00689` (subcommand table maps to an ordered list of named counts) and `29e5372` (`tally words`), already on `main`. `npm test` green (12 tests).
