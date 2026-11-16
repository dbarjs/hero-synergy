# 05: `tally lines`

Status: resolved
Blocked by: 04

Spec: [spec.md](../spec.md)

**What to build:** `tally lines <file>` prints a one-count report, `lines: <number>`, and exits 0. Lines follow decision 01: a line is a run of characters ended by `\n`, plus a last run with no `\n` if that run is non-empty. An empty file has 0 lines, and `\r\n` counts as one line ending. This ticket can run in parallel with 06.

- [x] `tally lines <file>` returns code 0, and its output is exactly `lines: <number>`.
- [x] `"a\nb"` reports `lines: 2`. A last line without a trailing newline still counts.
- [x] `"a\nb\n"` reports `lines: 2`. A trailing newline doesn't add an empty line.
- [x] `"a\r\nb\r\n"` reports `lines: 2`, so `\r\n` counts once.
- [x] `"a\n\nb"` reports `lines: 3`, so a blank line in the middle counts.
- [x] A lone `\r` doesn't end a line: `"a\rb"` reports `lines: 1`.
- [x] An empty file reports `lines: 0`.
- [x] The line count is a pure function in the internal counts module, added to the subcommand table as a one-count entry named `lines`. Tests don't import it.
- [x] The usage line includes `lines`, in the table order words, lines, characters, all, covering whichever of those subcommands exist when this lands.
- [x] Tests go through `run(argv)` using the fixture helper from 04, and `npm test` is green.

## Comments

- Implemented on integration branch `worktree-word-counts` in `da3f6d0` (`tally lines`); glossary entry for **Line** added in `40466cf`. All acceptance criteria verified; `npm test` green (24 tests at `b4f1339`). Not yet merged to `main`.
