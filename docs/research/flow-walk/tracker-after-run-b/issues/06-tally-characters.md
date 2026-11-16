# 06: `tally characters`

Status: resolved
Blocked by: 04

Spec: [spec.md](../spec.md)

**What to build:** `tally characters <file>` prints a one-count report, `characters: <number>`, and exits 0. Characters follow decision 02: a character is a Unicode code point, not a UTF-16 unit and not a byte, and line endings count like any other character. This ticket can run in parallel with 05.

- [x] `tally characters <file>` returns code 0, and its output is exactly `characters: <number>`.
- [x] `"héllo 👋"` (with a precomposed `é`) reports `characters: 7`. The emoji counts once, not as two UTF-16 units, and the accented letter counts once, not as its bytes.
- [x] `"\r\n"` reports `characters: 2`, because line endings are characters.
- [x] An empty file reports `characters: 0`.
- [x] The character count is a pure function in the internal counts module that counts code points, not the string's UTF-16 length. It's added to the subcommand table as a one-count entry named `characters`. Tests don't import it.
- [x] The usage line includes `characters`, in the table order words, lines, characters, all, covering whichever of those subcommands exist when this lands.
- [x] Tests go through `run(argv)` using the fixture helper from 04, and `npm test` is green.

## Comments

- Implemented on integration branch `worktree-word-counts` in `0c38ffd` (`tally characters`), merged with 05 in `3f3d23a`; glossary entry for **Character** added in `40466cf`. All acceptance criteria verified; `npm test` green (24 tests at `b4f1339`). Not yet merged to `main`.
