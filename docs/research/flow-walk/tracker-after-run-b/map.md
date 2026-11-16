# Word, line and character counts

## Destination

`tally` reports a file's words, lines and characters, each as its own subcommand, and all three at once with `tally all`. Every question that depends on is decided, so the result goes straight to `/to-spec`.

## Notes

- Domain: read `GLOSSARY.md` first. Plain Node.js, no dependencies; tests through `npm test`.
- The existing seam is `run(argv)` in the CLI module, which returns `{ code, out }` without touching the process: test there.

## Decisions so far

- [01 What is a line?](issues/01-what-is-a-line.md): a line is a run of characters ended by `\n`, plus a last run with no `\n` if it is non-empty; an empty file has 0 lines; `\r\n` counts once.
- [02 What is a character?](issues/02-what-is-a-character.md): a Unicode code point, not a UTF-16 unit and not a byte; `"héllo 👋"` is 7 characters.
- [03 What does `tally all` print?](issues/03-what-does-tally-all-print.md): one report of three counts, in the order words, lines, characters, through the existing report formatter; the subcommands `words`, `lines` and `characters` each print a one-count report.

## Not yet specified

## Out of scope

- Reading from standard input, several files at once, and bytes as a count.
