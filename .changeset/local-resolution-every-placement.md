---
'hero-synergy': minor
---

On a local tracker, the Detail now shows a closed ticket's answer wherever you wrote it, not only under `## Answer`. With no `## Answer`, it shows your last Resolution heading, at any level, or your last bold label leading a paragraph, such as `**Resolution — 2026-10-04**`. `Resolution` matches in any case, and so does `Resolução`, with or without its accents. A reopened ticket shows its second closing. With neither, it shows the last entry under your last `## Comments`: the last dated item, the last `###` subsection, or the text there. A bold `**Resolved**` or `**Done**`, a `## Decision` section and anything inside a code fence are never read as the answer. An answer section or label with nothing under it is skipped.

The answer's byline is the first date on the label line or the dated item, plus the `(name)` right after a dated item's date. Nothing is guessed from prose. An open ticket never shows an answer, even with a `## Answer`, a Resolution heading or dated comments. Each answer outside `## Answer` gets a quiet warning naming where it was found, so you can tell an answer from a fallback. A closed ticket with no answer anywhere still gets a loud warning, and its hint now mentions the Resolution heading. Nothing changes on GitHub.
