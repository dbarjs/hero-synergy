# Spec: Word, line and character counts

Status: resolved

Map: [map.md](map.md). Decisions: [01 line](issues/01-what-is-a-line.md), [02 character](issues/02-what-is-a-character.md), [03 `tally all`](issues/03-what-does-tally-all-print.md).

## Problem Statement

`tally` is supposed to report counts about a text file, but right now it can't count anything. Its list of subcommands is empty, so every run prints a usage line that offers no real subcommand and exits 2. Someone who wants to know how many words, lines or characters a file has has to reach for another tool, and that tool's answer may differ from theirs on the awkward cases: a missing final newline, Windows line endings, accented letters, emoji.

## Solution

`tally` gets four subcommands:

- `tally words <file>` prints a one-count report: `words: <number>`.
- `tally lines <file>` prints a one-count report: `lines: <number>`.
- `tally characters <file>` prints a one-count report: `characters: <number>`.
- `tally all <file>` prints one report with all three counts, in the order words, lines, characters:

  ```
  words: <number>
  lines: <number>
  characters: <number>
  ```

The definitions are fixed, so the answers are predictable:

- A **word** is a maximal run of non-whitespace characters (the glossary definition).
- A **line** is a run of characters ended by `\n`, plus a last run with no `\n` if that run is non-empty. An empty file has 0 lines. `"a\nb"` and `"a\nb\n"` both have 2 lines. `\r\n` counts as one line ending.
- A **character** is a Unicode code point, not a UTF-16 unit and not a byte. `"héllo 👋"` is 7 characters. Line endings count like any other character.

A bad invocation (unknown subcommand, missing subcommand, missing file argument) prints a usage line that lists the real subcommands and exits 2.

## User Stories

1. As a person with a text file, I want to run `tally words <file>`, so that I learn how many words it contains.
2. As a person with a text file, I want to run `tally lines <file>`, so that I learn how many lines it contains.
3. As a person with a text file, I want to run `tally characters <file>`, so that I learn how many characters it contains.
4. As a person with a text file, I want to run `tally all <file>`, so that I get all three counts from a single command.
5. As a person reading a report, I want each count on its own line as `<name>: <number>`, so that I can tell at a glance which number is which.
6. As a person running a single-count subcommand, I want the count in the report to be named after the subcommand I typed, so that the output matches my request.
7. As a person running `tally all`, I want the counts always in the order words, lines, characters, so that I know where to look every time.
8. As a script author, I want the report format to be stable and line-based, so that I can parse it with `grep`, `cut` or `awk`.
9. As a script author, I want `tally` to exit 0 when it prints a report, so that my script can treat that as success.
10. As a script author, I want `tally` to exit 2 on a bad invocation, so that my script can tell misuse apart from success.
11. As a person who mistypes a subcommand, I want a usage line that lists `words`, `lines`, `characters` and `all`, so that I can see what I should have typed.
12. As a person who forgets the file argument, I want the usage line instead of a crash, so that I know what is missing.
13. As a person who runs `tally` with no arguments, I want the usage line, so that I can discover how the tool works.
14. As a person counting words, I want words separated by any run of whitespace (spaces, tabs, newlines) to count once each, so that formatting doesn't change the count.
15. As a person counting words, I want leading and trailing whitespace to add no words, so that indentation and trailing newlines don't inflate the count.
16. As a person counting words, I want punctuation attached to a word to count as part of that word, so that `hello,` is one word, as the glossary definition says.
17. As a person counting words in a file that holds only whitespace, I want 0 words, so that blank files report as empty.
18. As a person counting lines, I want a file whose last line has no trailing newline to count that last line, so that `"a\nb"` reports 2 lines.
19. As a person counting lines, I want a trailing newline not to add an extra empty line, so that `"a\nb\n"` also reports 2 lines.
20. As a person counting lines in a file with Windows line endings, I want `\r\n` to count as one line ending, so that the count matches the file on any platform.
21. As a person counting lines, I want blank lines in the middle of a file to count, so that `"a\n\nb"` reports 3 lines.
22. As a person counting lines in an empty file, I want 0 lines, so that an empty file isn't reported as having one line.
23. As a person counting characters in non-English text, I want an accented letter like `é` to count as one character, so that the count isn't inflated by encoding.
24. As a person counting characters in text with emoji, I want `👋` to count as one character, so that the count isn't inflated by UTF-16 surrogate pairs.
25. As a person counting characters, I want line endings to count as characters, so that the count covers everything in the file.
26. As a person counting characters in a file with Windows line endings, I want each `\r\n` to count as two characters, since both are code points, so that the rule has no special cases.
27. As a person counting characters in an empty file, I want 0 characters, so that empty means zero.
28. As a person running `tally all` on an empty file, I want `words: 0`, `lines: 0` and `characters: 0`, so that all three counts agree that the file is empty.
29. As a person comparing commands, I want each count in `tally all` to equal the count from its single-count subcommand on the same file, so that the two ways of asking always agree.
30. As a developer maintaining `tally`, I want each subcommand declared in one place along with the counts its report contains, so that the usage line and the dispatch can't drift apart.
31. As a developer maintaining `tally`, I want every report to go through the existing report formatter, so that the output format lives in exactly one place.
32. As a developer maintaining `tally`, I want behaviour tested through `run(argv)`, so that tests check what users see and survive refactors of the count logic.
33. As a developer maintaining `tally`, I want the tool to stay dependency-free, so that it installs and runs with plain Node.js 22+.

## Implementation Decisions

- **Subcommand table.** The CLI module's existing subcommand table, empty today, gets four entries: `words`, `lines`, `characters`, `all`, in that order. Each entry maps a subcommand to the ordered list of counts its report contains. Each count in the list has a report name and a count function. `words`, `lines` and `characters` each list one count, named after the subcommand. `all` lists those same three counts in the order words, lines, characters. Today's table maps a subcommand to a single count function, and that shape can't express `all`; this replaces it.
- **Dispatch.** `run(argv)` keeps its contract: it takes `[subcommand, file]`, never touches the process, and returns `{ code, out }`. On success it reads the file, applies each count in the subcommand's list to the text, and passes the resulting `[name, number]` pairs to the report formatter, keeping the list order. `code` is 0.
- **Usage.** An unknown subcommand, a missing subcommand or a missing file argument returns code 2 with `out` set to `usage: tally <words|lines|characters|all> <file>`. The list of subcommands comes from the table, in table order, so it can't drift from what the CLI actually accepts.
- **Counts.** There are three pure count functions, each taking the file's whole text as a string and returning a number. They live in a small internal module next to the report formatter. They are not a test seam (see Testing Decisions).
  - **Word count:** the number of maximal runs of non-whitespace characters, per the glossary. Whitespace means Unicode whitespace, the set JavaScript's regular-expression whitespace class matches. Leading, trailing and repeated whitespace produce no empty words, and an empty or all-whitespace text gives 0.
  - **Line count:** the number of `\n` characters, plus 1 if the text after the last `\n` (or the whole text, if there is no `\n`) is non-empty. Only `\n` ends a line, so `\r\n` counts once without special handling, and a lone `\r` is an ordinary character, not a line ending.
  - **Character count:** the number of Unicode code points in the text, counted by iterating code points rather than by the string's UTF-16 length. Every code point counts, line endings included, so `\r\n` is 2 characters.
- **File reading.** Unchanged: the whole file is read as UTF-8 text.
- **Report formatting.** Unchanged: the existing formatter already prints one `<name>: <number>` line per count in the order given. Nothing about it changes.
- **Entry point.** Unchanged: the executable wrapper still calls `run` with the process arguments, prints `out`, and exits with `code`.

## Testing Decisions

- **One seam: `run(argv)`.** This is the seam the map named, and it is the highest one available. All new behaviour is tested by calling `run` with a subcommand and a file path and asserting on the returned `code` and the exact `out` string. Tests don't import the count functions or the subcommand table.
- **What makes a good test here:** it checks only what a user can see, meaning the exact report text and the exit code for a given file's contents. If the count logic is refactored, moved or merged, a good test still passes. Each test names the behaviour it pins down (for example, "a last line without a trailing newline still counts").
- **Fixtures:** each test writes its file contents into a fresh temporary directory, using Node's built-in fs and os modules and an explicit UTF-8 encoding, then passes that path to `run`. No checked-in fixture files and no test dependencies.
- **Cases to cover, at minimum:**
  - Words: words separated by single spaces, runs of spaces, tabs and newlines; leading and trailing whitespace; punctuation attached to a word; an all-whitespace file gives 0.
  - Lines: `"a\nb"` and `"a\nb\n"` both give 2; `"a\r\nb\r\n"` gives 2; a blank line in the middle counts; an empty file gives 0.
  - Characters: `"héllo 👋"` gives 7 (with a precomposed `é`); `"\r\n"` gives 2; an empty file gives 0.
  - `all`: the exact three-line report, in the order words, lines, characters, for a non-trivial file and for an empty file.
  - Usage: an unknown subcommand, no arguments and a missing file argument each give code 2, with `out` equal to the usage line that lists `words|lines|characters|all`.
- **Prior art:** the existing CLI test already calls `run` and asserts on `code` for an unknown command, and the new tests extend that file in the same style (`node:test`, `node:assert/strict`). The existing report formatter test stays as it is, since the formatter's interface doesn't change.
- **Runner:** `npm test` (Node's built-in test runner), as today.

## Out of Scope

- Reading from standard input.
- Several files in one invocation.
- Bytes as a count.
- Behaviour when the file doesn't exist or can't be read: no decision has been made, and `run` keeps its current behaviour (the read error propagates).
- Handling of invalid UTF-8 or a byte-order mark: the file is decoded as Node decodes UTF-8 today, and a byte-order mark, if present, counts as one character.
- Grapheme clusters as characters (for example, counting a family emoji built with zero-width joiners, or a decomposed `é`, as one character): characters are code points.
- Locale-aware word segmentation: words are whitespace-delimited runs.
- Flags, options or alternative output formats (JSON, bare numbers).
- Any change to the report format.

## Further Notes

- **Glossary gap:** **Line** and **Character** are defined only in decision tickets 01 and 02, not in `GLOSSARY.md`. Adding them there (via `/domain-modeling`) would put them next to **Word**, **Count** and **Report**.
- **Code points have visible consequences:** a decomposed `é` (`e` plus a combining accent) is 2 characters, and a ZWJ emoji sequence is several. This follows directly from decision 02 and is expected.
- **Whitespace for words** is taken as Unicode whitespace. The glossary says only "non-whitespace", so this is the one reading the grilling didn't pin down explicitly. If a narrower set (ASCII space, tab and newline only) is wanted, that's a one-line change in the word count and a new test case.

## Comments

Implemented on `feature/word-counts` (tip `793d530`) through tickets 04–07. All 24 tests pass. The code review found nothing missing or wrong against the spec, and its standards findings are fixed. The Line and Character glossary gap from Further Notes is closed in `793d530`.
