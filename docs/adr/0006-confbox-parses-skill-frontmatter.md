# confbox parses SKILL.md frontmatter

`SKILL.md` frontmatter is read with `parseYAML` from [confbox](https://github.com/unjs/confbox), a runtime dependency of `@hero-synergy/core`, bundled into the extension. The Cockpit reads each skill's `description` and `disable-model-invocation` to decide what `Run skill…` lists, and the frontmatter is real YAML: mattpocock-skills 1.3.1 has a nested `metadata:` map on `pr` and double-quoted descriptions with `\"` escapes on `code-review` and `to-spec`, and a plugin author may write anything YAML allows. A line-oriented reader gets those wrong (a description cut at a colon, an escape left in the text, a map read as a key), and a skill read wrongly is a skill the Cockpit lists with the wrong words or not at all.

confbox is the UnJS parser the stack's "UnJS utilities before other dependencies" rule points to. It ships `parseYAML` as a single bundled file with no dependencies, so it adds no transitive packages to the VSIX. It is built on the `yaml` package, which implements YAML 1.2 and is the parser most of the ecosystem uses.

Measured on 2026-10-07, with confbox 0.3.1, against every `SKILL.md` in mattpocock-skills 1.2.3 (25 skills, the installed release) and the `pr`, `code-review`, `to-spec` and `wayfinder` frontmatter of 1.3.1: all decode, the nested map is read past, and the escaped quotes come out unescaped. Invalid YAML throws, and the decoder turns that into the `skill-unreadable` health code.

## Considered options

- **`yaml` directly.** The same parser with a larger API (documents, comments, CST) the Cockpit never uses. Rejected: confbox is the UnJS wrapper and enough for `parseYAML`.
- **`js-yaml`.** A widely used YAML parser. Rejected: it does the same job as confbox, outside the UnJS family the stack prefers.
- **A hand-written frontmatter reader.** What the seed assumed. Rejected: nested maps and quoted values exist upstream already, so it would be wrong on shipped skills.

## Consequences

- Core exports `readSkillFrontmatter`, never the YAML parser or a schema. Only `name`, `description` and `disable-model-invocation` are read; unknown keys, nested or not, are ignored.
- The frontmatter is the text between the leading `---` lines. The Markdown body after it is never parsed.
- If confbox stops being maintained, `parseYAML` is the only call to replace.
