# How do the best developer-tool READMEs and extension listings open?

Research for the ticket [#115 How do the best developer-tool READMEs and extension listings open?](https://github.com/dbarjs/hero-synergy/issues/115), on the map [#22 The front door: READMEs, Marketplace listing and repository cards](https://github.com/dbarjs/hero-synergy/issues/22). It feeds [#117 What does Hero Synergy say about itself?](https://github.com/dbarjs/hero-synergy/issues/117) and [#119 Prototype the two READMEs and the social card](https://github.com/dbarjs/hero-synergy/issues/119).

**The question.** What do the READMEs and Marketplace pages that developers admire put on their first screen, and in what order does the rest follow?

Read on **2026-10-09**, between 11:40 and 12:15 UTC, read-only. Each README was read raw from GitHub (`gh api repos/<owner>/<repo>/readme`). Each listing was read through the Marketplace gallery API (the query the Extensions view sends), together with the README the listing actually serves (the version's `Content.Details` asset), and one Marketplace page was fetched as a page. The rendering rules come from the source of `@vscode/vsce` 4.0.0 (the version this repo packages with) and of VS Code. Install counts and ratings are what the gallery reported at that time.

Two definitions used throughout:

- **First screen** means everything above a README's first section heading. On a listing, it is the Marketplace header plus that.
- **Words** are whitespace-separated tokens containing a letter or a digit, so `—`, `--` and `&` are not counted.

## Examples read

- **Matt Pocock's ecosystem**: [mattpocock/skills](https://github.com/mattpocock/skills), and the Total TypeScript extension: its [repository](https://github.com/mattpocock/ts-error-translator), [listing](https://marketplace.visualstudio.com/items?itemName=mattpocock.ts-error-translator) and [product page](https://www.totaltypescript.com/vscode-extension).
- **Claude Code**: [anthropics/claude-code](https://github.com/anthropics/claude-code) and the [Claude Code for VS Code listing](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code), which has no public repository.
- **Widely installed extensions**: GitLens ([repository](https://github.com/gitkraken/vscode-gitlens), [listing](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens)), Error Lens ([repository](https://github.com/usernamehw/vscode-error-lens), [listing](https://marketplace.visualstudio.com/items?itemName=usernamehw.errorlens)) and Pretty TypeScript Errors ([repository](https://github.com/yoavbls/pretty-ts-errors), [listing](https://marketplace.visualstudio.com/items?itemName=yoavbls.pretty-ts-errors)).
- **Agent tools**: Cline ([repository](https://github.com/cline/cline), [listing](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev)), Continue ([repository](https://github.com/continuedev/continue), [listing](https://marketplace.visualstudio.com/items?itemName=Continue.continue)) and [Aider](https://github.com/Aider-AI/aider).
- **Neighbours that run many agent sessions**: [claude-squad](https://github.com/smtg-ai/claude-squad), [Vibe Kanban](https://github.com/BloopAI/vibe-kanban) and [opcode](https://github.com/winfunc/opcode).
- **Built on someone else's project**: Draw.io Integration ([repository](https://github.com/hediet/vscode-drawio), [listing](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio), [Marketplace page](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio) read as a page) and Chat for Claude Code ([repository](https://github.com/andrepimenta/claude-code-chat), [listing](https://marketplace.visualstudio.com/items?itemName=AndrePimenta.claude-code-chat)). opcode and claude-squad also belong here.
- **TypeScript projects**: [Effect](https://github.com/Effect-TS/effect), [Vite](https://github.com/vitejs/vite), [tRPC](https://github.com/trpc/trpc) and [Zod](https://github.com/colinhacks/zod).
- **Supporting evidence only**: the [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat) and [GitHub Pull Requests](https://marketplace.visualstudio.com/items?itemName=GitHub.vscode-pull-request-github) listings (how Microsoft shows motion on a listing), [CloudCLI](https://github.com/siteboon/claudecodeui) (a rename), and Hero Synergy's own [live listing](https://marketplace.visualstudio.com/items?itemName=dbarjs.hero-synergy) (v0.1.1) as the baseline.

That makes 19 examples, plus the supporting reads.

**Swaps.** Continue was kept, but as a warning rather than a model: its README now says "The `continuedev/continue` repository is no longer actively maintained and is read-only for all users", and its three surfaces carry three different pitches. claude-squad, Vibe Kanban and opcode were added because they are what Hero Synergy will be compared with: tools that run several agent sessions, each in its own worktree or workspace. Vibe Kanban's H1 now reads "Vibe Kanban is sunsetting.", but its structure is still the clearest problem-first opening, and its board is the real product the trailer's stylized board most resembles. Draw.io Integration was added for the cleanest unofficial first line in the Marketplace, and Chat for Claude Code and opcode as two Claude Code companions that handle the unofficial line in opposite ways.

## In short

- **The first screen is name, one line, proof.** Visual products put a real image there: before/after screenshots, a GIF, a screenshot or an uploaded video. Libraries show code or send you to docs. Matt Pocock shows nothing and argues in words instead.
- **Lead with what no neighbour has.** GitLens, at 53 million installs, now advertises Claude Code "Agent sessions" with "live state: working, idle, or needs input" and "Start Work with Agent", which turns an issue into a worktree and a session. claude-squad, Vibe Kanban and opcode all run many sessions. Only the wayfinder map and its frontier belong to Hero Synergy.
- **The two READMEs render under different rules.** A video plays only on GitHub, up to 10 MB per upload on a free plan; the trailer is 24.5 MB, and a 720p, 30 fps encode came to 2.9 MB. The listing needs https PNG or GIF images. vsce rewrites relative paths from the repository root, ignoring `packages/vscode`, and turns any ` #12` into a link to this repository's issue 12, even inside code.
- **The one-line About is empty.** So a shared link unfolds into a card with no line at all, only the avatar and "0 Stars". The Extensions view shows the Marketplace description on one line, cut with an ellipsis. The line has to do its job in its first 40 or so characters, and the strongest listings reuse one sentence across the About, the description and the README.
- **Say unofficial without apologising.** Use the adjective in the first sentence, one plain not-affiliated sentence and a credits section that names what the tool relies on. Keep upstream names and colours out of the product's own name and art. Three Claude Code companions named after Claude have since been renamed.
- **The trailer differs from the product in claims, not only in style.** Besides the board and the "+ CLI" outro, the command it types names the session without `#12`. By the README's own convention, the Cockpit would not match that session to its ticket. A caption can cover style; a claim needs a fix.

## First screens

### Repository READMEs on GitHub

| Example | Hero or logo | One-line pitch, quoted (words) | Demo: type and placement | Badges | Call to action |
| --- | --- | --- | --- | --- | --- |
| [mattpocock/skills](https://github.com/mattpocock/skills) | Wordmark image, dark and light `<picture>`, linking to the newsletter | "My agent skills that I use every day to do real engineering - not vibe coding." (15) | None, anywhere | 1 (skills.sh) | "Sign Up To The Newsletter", then "Installation (30-second setup)" |
| [anthropics/claude-code](https://github.com/anthropics/claude-code) | None | "Claude Code is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster by executing routine tasks, explaining complex code, and handling git workflows -- all through natural language commands." (36) | GIF directly under the pitch | 2 (Node.js 18+, npm version) | "Learn more in the official documentation", then "Get started" |
| [GitLens](https://github.com/gitkraken/vscode-gitlens) | None; the H1 is "GitLens — Supercharge Git in VS Code" | "Understand any line of code, keep every branch, worktree, and coding agent in view, and ship cleaner history — without leaving VS Code." (22) | A poster (real screenshot plus play button) opening a YouTube video, after a problem paragraph | 0; prose says "installed more than 51 million times" | "Start your free 14-day Pro trial — no credit card required." |
| [Error Lens](https://github.com/usernamehw/vscode-error-lens) | None, and no title | "ErrorLens turbo-charges language diagnostic features by making diagnostics stand out more prominently, highlighting the entire line wherever a diagnostic is generated by the language and also prints the message inline." (30) | Static PNG under the pitch | 4 (version, installs, rating, Open VSX) | None |
| [Pretty TypeScript Errors](https://github.com/yoavbls/pretty-ts-errors) | Icon at 140 px | "Make TypeScript errors prettier and human-readable in VSCode." (8) | Before-and-after screenshot pair, after two sentences of problem | 6 (stars, VS Code, licence, installs, a WebStorm icon, Cursor) | None; a creator's video thumbnail follows |
| [Cline](https://github.com/cline/cline) | Icon at 80 px | "The open source coding agent in your IDE, terminal, & desktop." (10) | None | 0; a row of five text links | Five product cards, each with its install command or link |
| [Continue](https://github.com/continuedev/continue) | An art banner (a watercolour tree, 2.1 MB PNG) | "Pioneering open-source coding agent" (4) | None | 3 | The read-only notice, then docs |
| [Aider](https://github.com/Aider-AI/aider) | Logo at 300 px; the H1 is the category, "AI Pair Programming in Your Terminal" | "Aider lets you pair program with LLMs to start a new project or build on your existing codebase." (18) | Animated SVG screencast under the pitch | 5 generated metrics | None until "Getting Started" |
| [claude-squad](https://github.com/smtg-ai/claude-squad) | None | "Claude Squad is a terminal app that manages multiple Claude Code, Codex, Gemini (and other local agents including Aider) in separate workspaces, allowing you to work on multiple tasks simultaneously." (30) | Screenshot under the pitch; an uploaded video after four highlights | 2 (CI, release) | None until "Installation" |
| [Vibe Kanban](https://github.com/BloopAI/vibe-kanban) | Logo, dark and light `<picture>` | "Get 10X more out of Claude Code, Gemini CLI, Codex, Amp and other coding agents..." (15), then the H1 "Vibe Kanban is sunsetting." | Screenshot of the board under the H1 | 3 | "Read the announcement."; later `npx vibe-kanban` |
| [opcode](https://github.com/winfunc/opcode) | Icon at 120 px | "A powerful GUI app and Toolkit for Claude Code" (9) | Uploaded video under the header | 5, used as navigation links | A "Star the repo" tip, then the not-affiliated note |
| [Draw.io Integration](https://github.com/hediet/vscode-drawio) | None | "This unofficial extension integrates Draw.io (also known as diagrams.net) into VS Code." (12) | GIF after the feature list | 1 (follow on Twitter) | None |
| [Effect](https://github.com/Effect-TS/effect) | None | "Effect is a library for building robust, maintainable, type-safe, and production grade applications in TypeScript." (15) | None | 1 | `npm install effect` |
| [Vite](https://github.com/vitejs/vite) | Logo, dark and light `<picture>`, 60 px high | "Next Generation Frontend Tooling" (4), then six bullets of two or three words | None | 4 | "Read the Docs to Learn More" |
| [tRPC](https://github.com/trpc/trpc) | Banner, dark and light `<picture>` | "Move fast and break nothing. End-to-end typesafe APIs made easy." (10) | GIF with a caption: "The client above is **not** importing any code from the server, only its type declarations." | 5 | Quickstart, then docs |
| [Zod](https://github.com/colinhacks/zod) | Logo at 200 px, byline "by @colinhacks" | "TypeScript-first schema validation with static type inference" (7) | A code sample just below the first screen | 5, plus a row of links | "Read the docs →" |
| Hero Synergy today, [README.md](https://github.com/dbarjs/hero-synergy/blob/main/README.md) | None | "An unofficial VS Code cockpit for Matt Pocock's agent skills: wayfinder maps, frontier tickets and named Claude Code sessions in VS Code terminals." (23) | None | 0 | A pointer to the listing README, then "Developing" |

### Marketplace listings

The header of a Marketplace page shows the icon, display name, publisher, install count, rating, the manifest's `description` and the Install button. Tabs follow (Overview, Version History, Q & A, Rating & Review), and only then the README. The Extensions view in VS Code shows the same `description` on a single line cut with an ellipsis. The fourth column below is what roughly fits.

| Extension | Display name | Description, quoted (words, characters) | First 40 characters | Category | Installs, rating | The listing README opens with |
| --- | --- | --- | --- | --- | --- | --- |
| [GitLens](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens) | GitLens — Git supercharged | "Supercharge Git within VS Code — Visualize code authorship at a glance via Git blame annotations and CodeLens, seamlessly navigate and explore Git repositories, gain valuable insights via rich visualizations and powerful comparison commands, and so much more" (37, 258) | "Supercharge Git within VS Code — Visuali" | SCM Providers | 53.2 M, 3.38 (943) | The same file as on GitHub |
| [Claude Code for VS Code](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code) | Claude Code for VS Code | "Claude Code for VS Code: Harness the power of Claude Code without leaving your IDE" (15, 82) | "Claude Code for VS Code: Harness the pow" | AI, Chat | 27.4 M, 3.73 (821) | "Unleash Claude’s raw power directly in your terminal." No image anywhere; 25 lines |
| [Error Lens](https://marketplace.visualstudio.com/items?itemName=usernamehw.errorlens) | Error Lens | "Improve highlighting of errors, warnings and other language diagnostics." (9, 72) | "Improve highlighting of errors, warnings" | Other | 10.0 M, 4.87 (188) | The same file as on GitHub |
| [Cline](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev) | Cline | "Autonomous coding agent right in your IDE, capable of creating/editing files, running commands, using the browser, and more with your permission every step of the way." (26, 167) | "Autonomous coding agent right in your ID" | 6 categories | 5.6 M, 4.04 (319) | A different, older file: "Meet Cline, an AI assistant that can use your **CLI** a**N**d **E**ditor." |
| [Continue](https://marketplace.visualstudio.com/items?itemName=Continue.continue) | Continue - open-source AI code agent | "The leading open-source AI code agent" (6, 37) | All of it | 6 categories | 4.3 M, 3.25 (185) | "Source-controlled AI checks, enforceable in CI" |
| [Draw.io Integration](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio) | Draw.io Integration | "This unofficial extension integrates Draw.io into VS Code." (8, 58) | "This unofficial extension integrates Dra" | Visualization | 4.2 M, 4.91 (161) | The same file as on GitHub |
| [Pretty TypeScript Errors](https://marketplace.visualstudio.com/items?itemName=yoavbls.pretty-ts-errors) | Pretty TypeScript Errors | "Make TypeScript errors prettier and more human-readable in VSCode" (9, 65) | "Make TypeScript errors prettier and more" | Programming Languages, Debuggers, Visualization | 2.3 M, 4.97 (117) | The same file as on GitHub |
| [Chat for Claude Code](https://marketplace.visualstudio.com/items?itemName=AndrePimenta.claude-code-chat) | Chat for Claude Code | "Beautiful Claude Code Chat Interface for VS Code" (8, 48) | "Beautiful Claude Code Chat Interface for" | 9 categories | 536 K, 4.30 (27) | "🚀 Claude Code Chat - Beautiful Claude Code Chat Interface for VS Code" |
| [Total TypeScript](https://marketplace.visualstudio.com/items?itemName=mattpocock.ts-error-translator) | Total TypeScript | "Learn TypeScript in VSCode with a TypeScript error translator and syntax guide." (12, 79) | "Learn TypeScript in VSCode with a TypeSc" | Linters, Education | 267 K, 4.42 (33); last updated 2023-09-13 | 7 lines, no image, pointing at the product page |
| [Hero Synergy](https://marketplace.visualstudio.com/items?itemName=dbarjs.hero-synergy) v0.1.1 | Hero Synergy | "Unofficial cockpit for mattpocock/skills: wayfinder maps, frontier tickets and named Claude Code sessions in VS Code terminals." (17, 127) | "Unofficial cockpit for mattpocock/skills" | Other | 2 installs | "An unofficial VS Code cockpit for Matt Pocock's agent skills.", then Requirements; no image |

## The rest: section order and length

| Example | What follows the first screen | Length |
| --- | --- | --- |
| mattpocock/skills | Installation (30-second setup), one `<details>` per agent → Why These Skills Exist: four failure modes, each a book quote, "The Problem" and "The Fix" → Reference: every skill in one line | 258 lines, about 100 of them the "why" |
| Claude Code | Get started (install options) → Plugins → Reporting Bugs → Discord → Data collection, usage, and retention | 72 lines |
| Claude Code for VS Code (listing) | Five bold-led bullets → New to Claude Code? → Prefer the Terminal-based extension? → Requirements (one line) → Docs | 25 lines |
| Total TypeScript | Listing: a docs link, two sentences, a download link. Product page: Syntax Guide and Error Translation, one screenshot each → Reviews → Install | 7 lines |
| GitLens | Getting Started in four steps → nine feature sections, mostly named benefit first ("See Everything in One Place — Commit Graph"), each a problem sentence and bullets, the first three with a screenshot → Community and Pro → Support → Contributing → Contributors → License | 330 lines, about 120 of them contributor names |
| Error Lens | Features (four bullets) → Commands (15), Settings (76) and Colors (30), all generated tables → Upstream issues → a docs link | 175 lines, about 110 of them tables |
| Pretty TypeScript Errors | Watch this → Features (4) → Supports (5) → Installation → Why isn't it trivial (three numbered limits) → Hype section → Stars from stars → Sponsorship → Contribution | 146 lines |
| Cline | Repository: an index table → ten one-paragraph capability sections → Contributing → License. Listing: a four-step "how it works" → seven feature sections with floated images → Contributing → Enterprise → License | 235 and 143 lines |
| Continue | Repository: What is Continue? → Documentation → Final 2.0.0 Release → per-product badges → Contributors → License. Listing: four features, one line and one GIF each | 63 and 55 lines |
| Aider | Features (nine, one or two sentences each, with icons) → Getting Started → More Information → Kind Words From Users (36 quotes) | 180 lines |
| claude-squad | Highlights (4) → video → Installation → Prerequisites → Usage (the CLI's help) → menu keys → Configuration → FAQs → How It Works (three lines) → License → Star History | 162 lines |
| Vibe Kanban | Overview: one problem sentence, six bold-led bullets, a second screenshot, "One command. Describe the work, review the diff, ship it." → Installation → Documentation → Self-Hosting → Support → Contributing → Development | 163 lines, about 90 of them development |
| opcode | The not-affiliated note → Overview → a table of contents → Features, each with emoji headings → Usage → Installation → Build from Source → Development → Security → Contributing → License → Acknowledgments | 425 lines |
| Draw.io Integration | Features (six bullets) → Demo → feature sections, four with their own GIF → Themes (collapsed) → settings and Insiders notes → Contributors → See Also / Similar Extensions (the credits) | 142 lines |
| Chat for Claude Code (listing) | An emoji feature list → one screenshot → 14 feature subsections → Getting Started → Usage Examples (composed conversations) → Configuration → Pro Tips → Advanced Features → Contributing → License → Acknowledgments → Support → Download Now | 363 lines |
| Effect | An LTS callout → Installation → Requirements (three, each with a floor) → Links → Let's talk → Long-term support → Effect v3 → Packages (32 rows) → License | 97 lines |
| Vite | What it is, in two parts → a docs link → Packages → Contribution → License → Sponsors | 66 lines |
| tRPC | Intro (one sentence) → Features (9) → Quickstart → docs → AI Agents → Star History → Core Team → Sponsors → All contributors | 211 lines |
| Zod | What is Zod? (three sentences and code) → Features (8) → Installation → Basic usage, a short tutorial | 218 lines |
| Hero Synergy today | Root: Developing → Licence. Listing: Requirements → Settings → Commands → Conventions → Links | 19 and 41 lines |

## Notes per example

### Matt Pocock's ecosystem

**mattpocock/skills** (282 thousand stars, MIT)

- The voice is first person, contrarian and plain. The pitch is "My agent skills that I use every day to do real engineering - not vibe coding." The next paragraph names the approaches it rejects: "Approaches like GSD, BMAD, and Spec-Kit try to help by owning the process. But while doing so, they take away your control and make bugs in the process hard to resolve." It signs off with "Hack around with them. Make them your own. Enjoy."
- It sells with problems, not pictures. There is no screenshot or GIF anywhere. Four failure modes each open with a quote from a classic book, then "The Problem" and "The Fix".
- The install is time-boxed and ends at a win: "Installation (30-second setup)", three numbered steps, and "3. Bam - you're ready to go."
- It defines what Hero Synergy reads, in the upstream's own words. For wayfinder: "Plan a huge chunk of work, more than one agent session can hold, as a shared map of decision tickets on the issue tracker, and resolve them one at a time until the way to the destination is clear." implement-spec runs "implementer subagents across the ready frontier". A README can quote these, with credit, to explain the map and the frontier to someone who has never seen them.
- The About is two short sentences: "Skills for Real Engineers. Straight from my .agents directory." The repository has no topics.

**Total TypeScript**, Matt's own extension

- Same plain verbs. The listing says "Learn TypeScript from within your IDE. Get helpful hints on syntax, and get translations of TypeScript's most cryptic errors." The product page's headline is "Learn TypeScript from within VSCode", followed by one screenshot per feature (Syntax Guide, Error Translation), reviews and "Install the VSCode Extension".
- The listing itself is 7 lines with no image and has not changed since 2023-09-13. It ends with "Download the VSCode Extension", a link to the page the reader is already on. Take the voice, not the completeness.

### Claude Code

**anthropics/claude-code**

- A doorway: one 36-word definition, a docs link, a GIF, the install methods, then housekeeping. The definition is accurate but carries three verb phrases and a dash clause; it reads as a paragraph, not a line.
- It gives data collection a section of its own, which is unusual and builds trust.
- Staleness: a "Node.js 18+" badge sits right above the note "Installation via npm is deprecated." The GIF last changed on 2025-09-29.

**Claude Code for VS Code** (listing)

- It opens with "Unleash Claude’s raw power directly in your terminal. Search million-line codebases instantly. Turn hours-long workflows into a single command. Your tools. Your workflow. Your codebase, evolving at thought speed." That is on the listing of an editor extension whose next bullets announce a "New, friendlier interface". The slogan describes the CLI.
- Its Requirements say "VS Code 1.98.0 or higher" while its manifest's engine is `^1.94.0`.
- The description repeats the name before saying anything: "Claude Code for VS Code: Harness the power of Claude Code without leaving your IDE". There is no image on the listing.
- One part works well. "Prefer the Terminal-based extension?" tells existing users exactly which setting brings the old behaviour back.

### Widely installed extensions

**GitLens** (53.2 million installs)

- The strongest extension README in the set. It opens with a problem paragraph in the reader's words: "Your repository moves faster than it used to. Coding agents open branches, worktrees pile up, and pull requests stack while you're still reading a diff." Then come a poster image that opens a YouTube video, the call to action, and a four-step Getting Started that ends at the first win: "click the GitLens icon in the activity bar, and there it is: your history, your working changes, and everything in flight." The feature sections are named benefit first, and the first three each carry one real screenshot.
- Social proof is in prose and stated as a floor: "installed more than 51 million times", while the gallery counts 53.2 million. A floor stays true as the number grows. There are no badges.
- One file serves every editor. HTML comments such as `<!-- #vscode -->VS Code<!-- /#vscode: Your Editor -->` let a build step swap "VS Code" for "your editor".
- **It now overlaps Hero Synergy directly**, in its Pro edition. "**Agent sessions** — Claude Code sessions show up in the Commit Graph with live state: working, idle, or needs input. Resume one straight from the row it's working on." "**Start Work with Agent** — pick an issue and GitLens creates the branch or worktree, then hands it to a coding agent." And an "Agent Kanban" that "groups agent sessions by what needs your attention first". Its screenshot shows a session marked "Permission · 4m", "1 need input · 58 completed", and Allow and Deny buttons.
- What fails: the manifest description still sells blame annotations and CodeLens ("Supercharge Git within VS Code — ... and so much more", 258 characters) while the README sells agents and worktrees. About 120 lines are contributor names, the links carry tracking parameters, and the trial is pitched twice.

**Error Lens** (10.0 million installs, rated 4.87)

- There is no title at all; the page opens on four badges. The README's pitch says "turbo-charges", yet the manifest description is a model of the form: "Improve highlighting of errors, warnings and other language diagnostics." That is 9 words, verb first.
- It is the canonical settings wall: tables of 15 commands, 76 settings and 30 colours fill about 110 of 175 lines. They are generated between `<!-- SETTINGS_START -->` markers and so never go stale. But VS Code's details page already has a Features tab that "Lists features contributed by this extension".
- The demo PNG last changed on 2019-06-04.
- "Upstream issues: Please upvote the following VS Code issues" names the limits that belong to the upstream, plainly and without apology.
- On the listing, vsce turned `#00000050` inside a code span into `[#00000050](https://github.com/usernamehw/vscode-error-lens/issues/00000050)`.

**Pretty TypeScript Errors** (2.3 million installs, rated 4.97)

- The best first screen for a visual product. An 8-word imperative pitch, then two sentences of problem in the author's voice ("TypeScript will throw on you a shitty heap of parentheses"), then a before-and-after pair of screenshots. The reader sees the change before any feature list.
- Proof comes from others: the thumbnail of a well-known creator's video and links to more, then tweets and the avatars of known developers, Matt Pocock among them.
- An honest engineering section, "Why isn't it trivial", explains the three hacks the extension needs.
- It credits a neighbour as a feature: "A button that navigates you to ts-error-translator, where you can read the error in plain English". That is Matt's project.
- What fails: six badges in four styles, one of them an icon from a third-party icon site, and tweets kept as images. The logo sits inside a link styled `display: none`, apparently to hide it where the Marketplace header already shows the icon (not verified, below).

### Agent tools

**Cline**

- The repository README is a product chooser. The CLI, desktop app, VS Code extension, JetBrains plugin and SDK each get a card of two or three lines with their own install command or link. There is no demo at all.
- The listing README is a separate, older text. It credits its model in the first paragraph ("Thanks to Claude Sonnet's agentic coding capabilities"), explains how it works in four numbered steps, and alternates floated images left and right, using a 2000 × 0 transparent image to clear the floats.
- What fails: the stale claim "With Claude Sonnet's new Computer Use capability", linked to the 2024 announcement. vsce rewrote `../../CONTRIBUTING.md` into the broken `https://github.com/cline/cline/blob/HEAD/../../CONTRIBUTING.md`. It claims six categories. Its ID, `saoudrizwan.claude-dev`, still carries an older name.

**Continue**

- Three surfaces, three pitches. The repository says "Pioneering open-source coding agent", the listing's description "The leading open-source AI code agent", and the listing README "Source-controlled AI checks, enforceable in CI". The repository is now read-only. This is what separate files do over time.
- The listing's body is compact: four features, one line and one GIF each.

**Aider**

- The H1 is the category, "AI Pair Programming in Your Terminal", and the name lives in the logo. It reads well and is what people search for.
- The demo is an animated SVG screencast: crisp text and a small file, but it works on GitHub only, since vsce rejects SVG.
- The badges are generated by a script from real numbers, including "Singularity 88%", whose tooltip reads "Percentage of the new code in Aider's last release written by Aider itself".
- What fails: the first feature names "Claude 3.7 Sonnet, DeepSeek R1 & Chat V3, OpenAI o1, o3-mini & GPT-4o" as the models it works best with, and 36 testimonials close the page.

### Neighbours that run many agent sessions

**claude-squad**

- A screenshot directly under the pitch, then four highlights in benefit form ("Each task gets its own isolated git workspace, so no conflicts"). Then comes a video uploaded to GitHub and pasted as a bare URL. GitHub renders it as a `<video>` player; that was checked in the page's HTML.
- "How It Works" fits in three numbered lines, at the end: tmux, git worktrees and a TUI.
- It credits by linking every upstream agent in its first sentence. It never says it is unofficial, although "Claude" is in its name.

**Vibe Kanban**

- Problem first: "In a world where software engineers spend most of their time planning and reviewing coding agents, the most impactful way to ship more is to get faster at planning and review." Then bold-led bullets and "One command. Describe the work, review the diff, ship it."
- Its board of issues and workspaces is the closest shipped product to the trailer's stylized board.
- It now opens with "Vibe Kanban is sunsetting." as its H1.

**opcode**

- A video under the header, then a `[!NOTE]` alert: "This project is not affiliated with, endorsed by, or sponsored by Anthropic. Claude is a trademark of Anthropic, PBC. This is an independent developer project using Claude." It is the clearest disclaimer in the set, and it is on the first screen.
- "Think of opcode as your command center for Claude Code" uses the same family of metaphor as "cockpit".
- What fails: five large badges used as navigation links, a "Star the repo" tip ahead of the content, and "powerful" and "beautiful" in the first lines.
- It used to be called Claudia: `getAsterisk/claudia` now resolves to `winfunc/opcode`.

### Built on someone else's project

**Draw.io Integration** (4.2 million installs, rated 4.91)

- "This unofficial extension integrates Draw.io (also known as diagrams.net) into VS Code." Then: "Mentioned in the official diagrams.net blog." Unofficial is an adjective in the first sentence, the upstream's own mention is the proof, and nothing apologises. The same sentence is its GitHub About and, shortened, its Marketplace description.
- The credits come at the end: "This extension relies on the giant work of Draw.io. Their embedding feature enables this extension! This extension bundles a recent version of Draw.io." It also links a similar extension by someone else.
- What fails: the main demo GIF last changed on 2020-05-09.

**Chat for Claude Code** (536 thousand installs)

- It credits Anthropic only in an "Acknowledgments" section at the end ("For creating the amazing Claude AI and more specifically the Claude Code SDK") and with a "Powered by Claude Code" badge. There is no unofficial or not-affiliated line anywhere.
- Its display name is now "Chat for Claude Code", but the README's H1 still reads "Claude Code Chat - Beautiful Claude Code Chat Interface for VS Code".
- What fails: "beautiful", "intuitive", "stunning", "like never before"; usage examples written as conversations in code blocks; nine categories.

### TypeScript projects

- **Effect.** No logo, demo or code. A 15-word definition, then the hard problems it handles: "typed errors, dependency injection, structured concurrency, scheduling, tracing, and unified schema validation". Requirements with floors (TypeScript 5.9, Node.js 18, `strict`) read like Hero Synergy's own. An HTML comment explains why its one badge is static.
- **Vite.** A doorway of 66 lines: logo, four badges, a tagline, six bullets of two or three words, a two-part explanation of what it is, and "Read the Docs". "Next Generation" and "Rich Features" say nothing.
- **tRPC.** The GIF's caption tells the reader the one thing to notice: "The client above is **not** importing any code from the server, only its type declarations." The GIF's file is named `v10-dark-landscape.gif` while `@trpc/server` is at 11.19.0. An "AI Agents" section tells agent users which skills to install. Team and sponsor tables take most of the length.
- **Zod.** A tagline and a byline, "by @colinhacks". "What is Zod?" answers in three sentences: what it is, what you do and what you get ("Define a schema and parse some data with it. You'll get back a strongly typed, validated result."). Then code.

## Cross-cutting patterns

- **Name, one line, proof.** Tools you watch at work put a real image or recording in the first screen: Pretty TypeScript Errors, Error Lens, GitLens, claude-squad, Vibe Kanban, opcode, tRPC and Aider. Libraries show code (Zod) or send you to docs (Effect, Vite). Matt shows nothing and makes the case in words, which works for text files and would not for a UI.
- **Taglines are 4 to 10 words; definitions 15 to 22.** Taglines: Vite 4, Zod 7, Pretty TypeScript Errors 8, Cline 10, tRPC 10. The clear definitions: Matt 15, Effect 15, Aider 18, GitLens 22. The run-ons: Error Lens 30, claude-squad 30, Claude Code 36. On listings, the clearest descriptions are 8 or 9 words and 58 to 72 characters (Draw.io Integration, Error Lens, Pretty TypeScript Errors).
- **Verbs first, the reader as the subject.** Make, Improve, Learn, Understand, Manage, Get. The weak lines make the product the subject of a marketing verb: turbo-charges, Supercharge, Unleash, Harness.
- **The problem comes before the features**, in the reader's words: GitLens, Matt, Pretty TypeScript Errors, Vibe Kanban.
- **One screenshot per feature, under a benefit heading**: GitLens for its main features, Matt's Total TypeScript page, Draw.io Integration, and both Cline's and Continue's listings.
- **Getting started ends at the first win**: GitLens's third step, Matt's "Bam", Vibe Kanban's "One command."
- **How it works is short and late**: claude-squad in three lines, Pretty TypeScript Errors in three points, Vite in two parts.
- **Proof as prose floors, not badges.** GitLens's "more than 51 million", Draw.io's "Mentioned in the official diagrams.net blog". The badges that stay honest are generated (Aider) or report a build.
- **Separate files drift.** Where the listing README is its own file (Cline, Continue), it tells an older or different story, and manifest descriptions drift too (GitLens). Hero Synergy says its one line in four places: the root README, the listing README, the manifest description and the About.
- **The neighbourhood is crowded and churns.** Many-session tools: claude-squad, Vibe Kanban (sunsetting), opcode, and GitLens Pro's agent sessions. Continue went read-only. A reader arriving from any of them asks "what does this do that the others don't?"

## How each surface renders

These are the facts that bind #119. Each comes from the source named in the last column.

| Surface | Video | Images | Relative paths and `#123` | Source |
| --- | --- | --- | --- | --- |
| GitHub repository page | An uploaded video pasted as a bare `https://github.com/user-attachments/assets/...` URL renders as a `<video>` player (claude-squad, opcode). An upload may be "10MB for videos uploaded to a repository owned by a user or organization on a free GitHub plan", 100 MB on a paid plan; `.mp4`, `.mov`, `.webm` | PNG, GIF and SVG; "The `<picture>` HTML element is supported", which is how Vite, tRPC and Matt switch dark and light art | Relative paths resolve in the repository. GitHub alerts such as `> [!NOTE]` render | GitHub docs; the claude-squad page's HTML |
| Marketplace website | Not verified. Microsoft's own Copilot Chat and Pull Requests listings use GIFs, with alt text like "Video showing an agent session building a complete feature in VS Code." | vsce refuses non-https images ("Images in README.md must come from an HTTPS source"), SVG except from a fixed list of badge hosts ("SVGs are restricted in README.md; please use other file image formats, such as PNG") and inline `<svg>` | vsce rewrites relative links to `https://github.com/dbarjs/hero-synergy/blob/HEAD/<path>` and images to `.../raw/HEAD/<path>`, from the repository root: it reads only `repository.url` and ignores `repository.directory`, so `media/x.png` in `packages/vscode/README.md` breaks. It also turns any `#<digits>` preceded by whitespace into a link to this repository's issues, before Markdown is parsed, so code spans and code blocks are not spared | `@vscode/vsce` 4.0.0, `out/package.js` |
| VS Code's details page | `<video>` is on the sanitizer's allow list with `autoplay`, `controls`, `loop`, `muted` and `poster`, and the page's policy allows `media-src https:`. Not rendered here to confirm | `img-src https: data:`. `<picture>` is not on the allow list, so only its inner `<img>` shows. `style` is dropped except a narrow set on `<span>` | As packaged by vsce. Tabs: Details ("rendered from the extension's 'README.md' file"), Features ("Lists features contributed by this extension"), Changelog | VS Code `extensionEditor.ts`, `markdownRenderer.ts`, `domSanitize.ts` |
| Extensions view list | None | The icon only | The description sits in `.description.ellipsis`: one line, `white-space: nowrap`, `text-overflow: ellipsis` | VS Code `extensionsList.ts`, `media/extension.css` |
| A shared repository link | None | GitHub's default card prints the About description under the repository name. Hero Synergy's card has no line, only the owner's avatar and "3 Contributors, 14 Issues, 0 Stars, 0 Forks". A custom image should be a PNG, JPG or GIF "under 1 MB", "1280 by 640 pixels for best display" | | GitHub docs; the two cards fetched from `opengraph.githubassets.com` |

The trailer itself is 1920 × 1080, 60 fps, H.264 with AAC, 30 seconds and 24.5 MB, over the free plan's 10 MB. Two test encodes were made in a scratch folder, not the repository: 720p at 30 fps, H.264 CRF 26, came to **2.9 MB**, and 1080p at 30 fps, CRF 23, to **11.4 MB**. The board's text stays legible at 720p in the frames checked.

Hero Synergy's `package` script today is `vsce package --no-dependencies --allow-unused-files-pattern`, so relative links are rewritten from the root and issue linking is on. The README is processed at package time, and `publish:marketplace` publishes that VSIX, so any flag belongs in `package`. vsce offers `--no-gitHubIssueLinking`, `--no-rewrite-relative-links`, `--baseContentUrl`, `--baseImagesUrl` and `--githubBranch`.

## What fails

- **Badge walls, and badges that repeat the page.** Pretty TypeScript Errors has six badges in four styles; opcode five, used as navigation links; Aider five metrics; Error Lens four before any title, whose installs and rating repeat what the Marketplace header already shows. GitLens has none, and Matt has one.
- **Stale demos.** Error Lens's demo is from 2019-06-04 and Draw.io's from 2020-05-09. tRPC's GIF is named for v10 while the package is at 11.19.0. claude-squad's screenshot last changed on 2025-03-30. Claude Code's GIF (2025-09-29) sits under a "Node.js 18+" badge for an install method it deprecates.
- **Claims that went stale or contradict each other.** Aider's list of best models. Cline's "new Computer Use". The Claude Code extension's "directly in your terminal" and its 1.98.0 against `^1.94.0`. GitLens's manifest description against its README. Continue's three pitches.
- **Marketing words**, all from this sample: supercharge, turbo-charges, unleash, raw power, thought speed, harness the power, powerful, beautiful, stunning, intuitive, like never before, seamlessly, next generation, pioneering, leading, 10X, rich features, and so much more.
- **Walls of settings.** Error Lens's 121 rows of tables. Chat for Claude Code's 14 feature subsections and its "Pro Tips".
- **Invented material shown as the product.** Chat for Claude Code's "Usage Examples" are composed conversations in code blocks. For Hero Synergy the risk is its own trailer, covered under "What to take". By contrast, Continue's art banner is plainly art and misleads nobody.
- **Self-links and leaks of the other surface.** Total TypeScript's "Download the VSCode Extension" and Cline's "Download on VS Marketplace" appear on the Marketplace page itself, and Chat for Claude Code ends on "Download Now".
- **Walls of people.** GitLens's 120 lines of contributors, tRPC's sponsor tables, Aider's 36 testimonials.
- **Broken rewriting.** Cline's CONTRIBUTING link and Error Lens's `#00000050`, both from vsce.
- **Upstream names in the product name.** Claudia is now opcode; "Claude Code UI" is now "Cloud CLI (aka Claude Code UI)"; "Claude Code Chat" now displays as "Chat for Claude Code"; Cline's ID still says `claude-dev`. None of the pages read gives a reason. Anthropic's guidelines say "You may not use our trademarks in a manner that implies Anthropic's sponsorship or endorsement, or a relationship or affiliation with Anthropic, except as we expressly authorize."

## What to take

### First, for #117 and #119 alike: lead with the map

"Many Claude Code sessions, each in its own worktree, with live status" now describes GitLens Pro, claude-squad, Vibe Kanban and opcode. GitLens Pro even turns an issue into a worktree and a session, and flags the one that "needs input". What none of them does is read a wayfinder map and show its frontier: the open, unblocked, unclaimed tickets, in map order, with claims and blockers. So:

- The pitch line names the map and the frontier first. Sessions come second and status third.
- The first real screenshot shows the frontier in the Tree, not a terminal.
- The trailer already agrees: "One giant map." and "See the frontier." come before any session.

### The one-line About and the listing description

Where the line shows:

- On GitHub, in the About box at the top of the repository page, above the file list and the README.
- On the default card a shared link unfolds into, under the repository name. Today the card has no line.
- In the Marketplace header.
- In the Extensions view, on one line cut with an ellipsis.
- The manifest docs say the display name and description are "important for the Marketplace and in product displays" and "also used for text search in VS Code".

Rules:

- **One sentence, reused.** Draw.io Integration uses one sentence as its README's first line and its About, and a shorter version as its description. Use the same sentence for the About and the manifest `description`, and let each README's opening paragraph expand it.
- **8 to 17 words, at most about 110 characters**, with the job done in the first 40 characters: those are what the Extensions view shows at its default width. That is longer than the best single-purpose descriptions (8 or 9 words) because this line has to name its upstreams.
- **Fill the rest of the About too.** Error Lens, Pretty TypeScript Errors and Draw.io Integration all point the About's website at their Marketplace listing, which suits a project with no website of its own. Topics: at most 20, lowercase letters, numbers and hyphens, 50 characters each. The neighbours' topics are `vscode-extension` plus the upstream's name and two to six words for the job.
- **Category and keywords, for #117 to decide.** The listing sits in "Other". VS Code's own category list includes "AI" and "Chat", and the agent tools sit in AI (Claude Code, Cline, Copilot Chat). Hero Synergy has no chat, so "AI" alone would match. Pick one or two categories, not six or nine. Keywords are "currently limited to 30". Use the searcher's words (claude code, worktree, sessions, github issues, wayfinder, mattpocock), and no competitors' names, unlike Continue's `cline`, `copilot` and `roo`.

### The repository README (`README.md`)

Recommended section order:

1. The Seal by relative path (`packages/vscode/media/icon.svg`, which `docs/brand.md` allows here), the name, the pitch line, and one sentence that says "unofficial" and links Matt Pocock's skills and Claude Code.
2. The trailer, with a caption that calls it stylized, and directly under it a real screenshot of the Tree showing a frontier and live sessions.
3. The problem in two or three sentences, in the reader's words. The trailer's first beats already are this paragraph: "One giant map. Too many terminals. Which one needs you?"
4. What it does, as four short parts headed by the trailer's beats ("See the frontier.", "One click. One named session.", "Live status for every session.", "Close one. Unblock the rest."), each with one real screenshot.
5. Get started: three or four numbered steps that end at the first ticket session. The requirements stay in the listing README, linked from here.
6. How it works, in three to five lines: it reads the tracker with `gh`; the frontier is open, unblocked and unclaimed tickets; every action shows the exact command it will run; status comes from Claude Code's registry and the status plugin; it never creates, merges or removes a worktree.
7. Credits and the unofficial line.
8. Developing: the current commands.
9. Licence.

First-screen options to prototype:

- **A. Trailer first**, like GitLens, opcode and claude-squad. Seal, name, pitch and the unofficial sentence. Then the trailer with its caption, then a real screenshot right away. It risks the board being the first image a reader takes in, which the caption and the adjacent screenshot have to undo.
- **B. Product first**, like Pretty TypeScript Errors and Vibe Kanban. Name and pitch, then the real screenshot with a tRPC-style caption that says what to notice, then the four beats, with the trailer further down. It is the most honest, and the least cinematic.
- **C. Problem first, in Matt's register**, like mattpocock/skills. Name, one contrarian line, the three problem beats as a short paragraph, one sentence of answer, the real screenshot, then the trailer. It matches the voice of the ecosystem and costs a few lines before the first image.

Keep it near 150 lines. Settings, commands and conventions belong to the listing README. Use no badges: a two-install or zero-star badge proves nothing yet.

### The listing README (`packages/vscode/README.md`)

Recommended section order:

1. The opening paragraph, expanding the description and naming Matt Pocock's skills, wayfinder and Claude Code. No logo image: the header already shows the icon on the midnight `galleryBanner`.
2. One real screenshot or a short GIF.
3. The unofficial sentence. The current wording works.
4. Get started, in numbered steps that end at the first ticket session.
5. What you see: the Tree, the Focus pane and the Detail, and what each session status means. Two or three screenshots at most.
6. A link to the trailer, labelled as a stylized 30-second trailer: text, or a poster made from a title-card frame such as the Seal or a headline beat, never a frame of the bare board.
7. Requirements: keep today's floors and tested ceilings.
8. Settings (the two-row table), Commands (tightened) and Conventions (keep).
9. Links: source and issues, changelog, licence.

First-screen options to prototype:

- **L1. Screenshot first**: the opening paragraph, a real PNG of the Tree with a frontier and session statuses, then the unofficial sentence.
- **L2. Loop first**: a GIF of 5 to 10 seconds of the real Cockpit (pick a frontier ticket, Work ticket, a terminal tab named "#12 …", the status changing), then the opening paragraph.

Rendering rules, from the evidence above:

- Images are absolute https PNG or GIF URLs, as `docs/brand.md` already says. vsce ignores `repository.directory`, so relative paths break.
- **Pin images to the release tag** (`v0.1.2` and so on). Both vsce's default `raw/HEAD` and a `main` URL show the newest pictures on an older release's listing, which breaks "every claim holds for the release it ships in". An alternative is relative paths plus `--baseImagesUrl https://github.com/dbarjs/hero-synergy/raw/v<version>/packages/vscode` in the `package` script. That would need a one-line change to `docs/brand.md`.
- Add `--no-gitHubIssueLinking` to the `package` script, or never write a whitespace-preceded `#<digits>`. Ticket numbers are part of the product's vocabulary, and " #12" would link to this repository's own issue 12.
- No badges (the header shows installs and rating) and no "install from the Marketplace" link.
- Keep the settings and commands short. VS Code's Features tab lists them in the editor, but the Marketplace website has no such tab, so the README still needs the two-row table, and no more.

### Rules for the pitch line

- **Length.** A tagline of 4 to 10 words; a definition of 15 to 22; a description or About of 8 to 17 words, doing its job in the first 40 characters.
- **Verbs.** Concrete things the reader does: see, pick, start, open, run, watch, close, unblock. Not manage, supercharge, unleash, harness, empower, streamline, transform or boost.
- **Nouns.** The glossary's terms: map, ticket, frontier, session, Cockpit, Needs you. Gloss a coined term at first use for readers who don't know wayfinder ("the frontier, the tickets you can take now"). Name the upstreams by their own names: Matt Pocock's skills (`mattpocock/skills`), wayfinder, Claude Code, VS Code.
- **Words to avoid.** In prose, the glossary's "Avoid" words: dashboard, control panel, board, backlog, agent or job for a session. From the sample: every marketing word in "What fails". "AI-powered" and "autonomous" say nothing about this tool.
- **Wit only before a literal line.** Matt's "not vibe coding" is followed by plain sentences, and tRPC's "Move fast and break nothing." by "End-to-end typesafe APIs made easy." The trailer's "A hero with this many skills needs synergy." is a closing line, not a description.
- **Only what ships.** No CLI, and no claim that depends on a tracker without saying so: worktrees are made only for tickets on GitHub.

### Crediting an upstream, and the unofficial line

Patterns that read as confident:

- **"Unofficial" as an adjective in the first sentence**: Draw.io Integration's "This unofficial extension integrates Draw.io ... into VS Code."; Hero Synergy's own "An unofficial VS Code cockpit for Matt Pocock's agent skills".
- **One plain not-affiliated sentence.** opcode puts its sentence in a `[!NOTE]` alert on the first screen and adds a trademark attribution: "Claude is a trademark of Anthropic, PBC." Hero Synergy's "Hero Synergy is a personal project and is not affiliated with or endorsed by Matt Pocock or Anthropic." is already in the right register; keep it.
- **Link upstreams at first mention**, as claude-squad and CloudCLI do in their first sentence.
- **Say what you rely on, in a credits section**, as Draw.io does: "This extension relies on the giant work of Draw.io." For Hero Synergy that means the wayfinder conventions of `mattpocock/skills` (MIT) and the Claude Code CLI, neither of which it ships.
- **Borrow the upstream's own definitions, quoted and credited.** Matt's line for wayfinder explains the map in one sentence, in Matt's words.
- **Upstream proof only when it exists.** Draw.io can say "Mentioned in the official diagrams.net blog"; Hero Synergy has no such mention and should not imply one.

Patterns to avoid:

- **Credit without a disclaimer**: Chat for Claude Code's acknowledgments and badge, and claude-squad.
- **Upstream marks in the name or the art.** Anthropic's Agent SDK guidance, written for SDK partners and only adjacent here, says "Your product should maintain its own branding and not appear to be Claude Code or any Anthropic product." Keep Claude's orange, Claude's logo and any "Powered by Claude Code" badge off the trailer, the card and the READMEs. `docs/brand.md` already keeps the Seal away from Matt Pocock's and AI Hero's marks.

### Placing the stylized trailer beside real screenshots

- **Caption it as stylized and point at the real thing**, the way tRPC's caption tells you what you are looking at.
- **Keep a real screenshot on the same screen as the trailer**, so nobody scrolls away thinking the board is the product.
- **The trailer's words, the product's pixels.** Use its beats as headings and put real captures under them. Never crop the board into a "screenshot".
- **Caption style; fix claims.** The trailer differs from the shipped Cockpit in three ways:
  - **Style:** its Cockpit is a board of Decided, Frontier and Blocked columns, where the product has the Tree, the Focus pane and the Detail. A caption covers this.
  - **Claim:** the outro says "VS Code extension + CLI", and no CLI ships.
  - **Claim:** at 0:18 it types `claude -n "Define the snapshot schema" -w define-snapshot-schema "/wayfinder #1 #12"`. The shipped Work ticket (`packages/core/src/claude/actions.ts`) runs `claude -n "#12 <title>" -w 12 --plugin-dir <plugin> "<wayfinder command> <map URL> <ticket URL>"`, and the listing README teaches readers that "The Cockpit matches a session to a ticket by the leading `#<number>` of the session's name". A reader who copies the trailer's command gets a session the Cockpit would not match to #12. The trailer's session list also shows names without their numbers.
  - The two claims call for a cut or a re-render rather than a caption, which feeds the map's open question about the trailer.
- **Alt text tells them apart**: "Stylized trailer of Hero Synergy" against "Screenshot: the Cockpit's Tree in VS Code, …".
- **Per surface.** On GitHub, upload a 720p, 30 fps encode (about 3 MB) and paste the bare URL. On the listing, use a text link or a title-card poster, since a bare upload URL is only a player on GitHub and a 30-second GIF of the board would become the listing's first impression.

### Candidate lines

These are candidates only, written to show the rules at work; #117 decides the words.

- **Taglines** (4 to 10 words): "See the frontier. Start the session." (6) · "Your wayfinder map, one click from every ticket." (8) · "The frontier of your wayfinder map, in VS Code." (9)
- **About and description**, with their first 40 characters:
  - "See the frontier of your wayfinder maps and start each ticket as a named Claude Code session." (17 words, 93 characters; it opens "See the frontier of your wayfinder maps ")
  - "Unofficial VS Code cockpit for wayfinder maps: see the frontier, start a Claude Code session per ticket." (17, 104; "Unofficial VS Code cockpit for wayfinder")
  - "This unofficial extension shows your wayfinder frontier and runs each ticket in its own Claude Code session." (17, 108; "This unofficial extension shows your way")
- **Opening paragraph**, in Zod's three-sentence shape (what it is, what you do, what you get): "Hero Synergy is an unofficial VS Code cockpit for Matt Pocock's skills. Open a wayfinder map and pick a ticket from its frontier. You get a named Claude Code session in its own worktree, and its status in the Tree." The worktree holds only on a GitHub tracker, so a final version has to say that or drop it.
- **Trailer caption**: "Stylized trailer. Every screenshot below is the real extension." (9 words)
- **Screenshot caption**: "The terminal tab is named after the ticket, and the Tree shows which session needs you." (16 words)

## Not verified

- **The Marketplace website's renderer.** Whether it plays `<video>`, switches `<picture>` sources, or honours inline `style` (the `display: none` on Pretty TypeScript Errors' logo) was not tested; nothing was published. Microsoft's own listings using GIFs is circumstantial evidence only.
- **VS Code's details page playing a video.** The sanitizer's allow list and the page's content policy permit an https `<video>`; it was not rendered in a running VS Code.
- **A bare user-attachments URL outside GitHub** is assumed to stay a plain link on the Marketplace and in VS Code, since neither knows GitHub's convention. It was not rendered.
- **About 40 characters** is an estimate for the Extensions view at its default width and font, not a measurement; the cut-off moves with the sidebar.
- **Eduardo's GitHub plan.** `gh api user` returned no plan, so the video limit could be 10 MB (free) or 100 MB (paid). The 2.9 MB encode fits either way. Only three frames of it were checked for legibility, and nothing was uploaded.
- **Whether GitHub truncates a long description** on the default card, and whether a custom social image hides the stats line.
- **Why the Claude-named companions were renamed.** None of the pages read gives a reason. Anthropic's trademark guidelines (last updated 2024-08-01) forbid implying affiliation, and its Agent SDK branding rules govern SDK partners, not tools that launch the CLI. This is a reading of public pages, not legal advice.
- **Pinning images to a tag.** Whether Hero Synergy's release workflow pushes the `v<version>` tag before or after `vsce package` runs was not checked; the URLs only need the tag to exist by the time the listing is viewed.
- **GitLens's comment markers.** That they are rewritten for Open VSX is inferred from their form; the build step was not read.
- **Install counts and ratings** are a snapshot from 2026-10-09. That the short descriptions belong to the highest-rated extensions is a correlation, not a cause.
- **The Marketplace page's header** was read through a fetch tool that summarises pages; its order matches the gallery data but was not seen in a browser.

## Sources

Examples, read on 2026-10-09:

- READMEs: `gh api repos/<owner>/<repo>/readme` for every repository linked in "Examples read". About boxes, stars and topics: one `gh api graphql` query over the same repositories.
- Listings: `POST https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery` (flags 919, by extension name), and each version's `Microsoft.VisualStudio.Services.Content.Details` asset for the README the listing serves.
- Marketplace page: <https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio>
- Total TypeScript product page: <https://www.totaltypescript.com/vscode-extension>
- Image ages: `gh api "repos/<owner>/<repo>/commits?path=<file>&per_page=1"` for `demo.gif` (anthropics/claude-code), `docs/demo.gif` (hediet/vscode-drawio), `img/demo.png` (usernamehw/vscode-error-lens), `assets/this.png` (yoavbls/pretty-ts-errors) and `assets/screenshot.png` (smtg-ai/claude-squad).
- tRPC's version: <https://registry.npmjs.org/@trpc/server/latest> (11.19.0).
- The opcode rename: `gh api repos/getAsterisk/claudia` resolves to `winfunc/opcode`.
- Default share cards: `https://opengraph.githubassets.com/<hash>/dbarjs/hero-synergy` and `.../mattpocock/skills`, from each repository's `openGraphImageUrl`.
- The video player on claude-squad's page: <https://github.com/smtg-ai/claude-squad>, whose HTML contains a `<video>` element for the uploaded URL.

Rules and rendering:

- GitHub, Attaching files: <https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files>
- GitHub, Basic writing and formatting syntax: <https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax>
- GitHub, Classifying your repository with topics: <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics>
- GitHub, Customizing your repository's social media preview: <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview>
- VS Code, Extension Manifest (fields and Marketplace Presentation Tips): <https://code.visualstudio.com/api/references/extension-manifest>
- VS Code source, the details page and its content policy: <https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/extensions/browser/extensionEditor.ts>
- VS Code source, the README sanitizer: <https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/markdown/browser/markdownDocumentRenderer.ts>, <https://github.com/microsoft/vscode/blob/main/src/vs/base/browser/markdownRenderer.ts> and <https://github.com/microsoft/vscode/blob/main/src/vs/base/browser/domSanitize.ts>
- VS Code source, the Extensions view list: <https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/extensions/browser/extensionsList.ts> and <https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/extensions/browser/media/extension.css>
- VS Code source, the category list: <https://github.com/microsoft/vscode/blob/main/src/vs/platform/extensions/common/extensions.ts>
- vsce 4.0.0 as installed in this repository, `out/package.js` (`MarkdownProcessor`, `TrustedSVGSources`) and `out/main.js` (the `package` flags); upstream source at <https://github.com/microsoft/vscode-vsce/blob/main/src/package.ts> and <https://github.com/microsoft/vscode-vsce/blob/main/src/main.ts>
- Anthropic Trademark Guidelines: <https://www.anthropic.com/legal/trademark-guidelines>
- Claude Agent SDK overview, Branding guidelines: <https://code.claude.com/docs/en/agent-sdk/overview>

Hero Synergy:

- The live listing (v0.1.1) through the same gallery query, and `packages/vscode/package.json` on `main`.
- The Work ticket command: `packages/core/src/claude/actions.ts` on `main`.
- The trailer: `/tmp/hero-synergy-30s.mp4` in the devcontainer, read with `ffprobe`, with frames at 0:16, 0:18 and 0:22 taken from a 720p test encode.
