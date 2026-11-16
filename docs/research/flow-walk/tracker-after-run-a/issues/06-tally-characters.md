# 06: `tally characters`

Status: resolved
Blocked by: 04

Spec: [spec.md](../spec.md)

**What to build:** `tally characters <file>` prints a one-count report, `characters: <number>`, and exits 0. Characters follow decision 02: a character is a Unicode code point, not a UTF-16 unit and not a byte, and line endings count like any other character. This ticket can run in parallel with 05.

- [ ] `tally characters <file>` returns code 0, and its output is exactly `characters: <number>`.
- [ ] `"héllo 👋"` (with a precomposed `é`) reports `characters: 7`. The emoji counts once, not as two UTF-16 units, and the accented letter counts once, not as its bytes.
- [ ] `"\r\n"` reports `characters: 2`, because line endings are characters.
- [ ] An empty file reports `characters: 0`.
- [ ] The character count is a pure function in the internal counts module that counts code points, not the string's UTF-16 length. It's added to the subcommand table as a one-count entry named `characters`. Tests don't import it.
- [ ] The usage line includes `characters`, in the table order words, lines, characters, all, covering whichever of those subcommands exist when this lands.
- [ ] Tests go through `run(argv)` using the fixture helper from 04, and `npm test` is green.

## Comments

Resolved by `22a1859` (`tally characters`) on `feature/word-counts`. Glossary entry for **Character** added in `793d530`.
