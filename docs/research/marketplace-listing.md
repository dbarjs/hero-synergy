# What the VS Code Marketplace page and the Extensions view accept

Research for [#114 What do the VS Code Marketplace page and the Extensions view accept?](https://github.com/dbarjs/hero-synergy/issues/114), on the map [#22 The front door: READMEs, Marketplace listing and repository cards](https://github.com/dbarjs/hero-synergy/issues/22).

Checked on **2026-10-09**, read-only and signed out of every registry. Nothing was published, logged in to or changed. Experiments ran in a scratch directory with copies of the manifest and README. The live listing `dbarjs.hero-synergy` moved from 0.1.1 to 0.1.2 during the research (12:06 UTC); its README asset did not change.

## Question

What does the VS Code Marketplace draw on an extension's page and in its search? What does VS Code's Extensions view draw from the same package? Which rules does `vsce` enforce on the way?

## Sources read

- **vsce 4.0.0**, the version `packages/vscode` uses, from `node_modules/.pnpm/@vscode+vsce@4.0.0_supports-color@8.1.1/node_modules/@vscode/vsce/out/` (`package.js`, `validation.js`, `main.js`, `util.js`). It matches upstream [`microsoft/vscode-vsce` at `04811a9`](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts) (`main` on 2026-10-09; the latest release is v4.0.0). Line numbers below are from that upstream `src/package.ts`.

- **VS Code 1.141.0**, the latest release, at commit [`2a59476`](https://github.com/microsoft/vscode/tree/2a59476c9bfcb90b3ddc372c36762471b7dfad1c): the extension editor, the Extensions list, the markdown document renderer and DOM sanitizer, the gallery service, the webview host and the publisher-trust dialog.

- **Microsoft's docs**, from [`microsoft/vscode-docs` at `bd9fee5`](https://github.com/microsoft/vscode-docs/tree/bd9fee5536c665bfa77cfb39c9d0f593e1f3316b): `api/references/extension-manifest.md` (approved 2026-10-07), `api/working-with-extensions/publishing-extension.md`, `api/extension-guides/webview.md`, `docs/configure/extensions/extension-marketplace.md` and `extension-runtime-security.md`. Also the [Visual Studio Code brand guidelines](https://code.visualstudio.com/brand).

- **The live Marketplace**: the item page and search page for `dbarjs.hero-synergy`, the public gallery API (`/_apis/public/gallery/extensionquery`), the listing READMEs of the 999 most-installed VS Code extensions, 80 of their item pages, and the page's own script bundle (static version `M280_20261006.4`). Pages were rendered in Playwright's Chromium 1243 where behavior needed a browser.

- **Open VSX**, from [`eclipse-openvsx/openvsx` at `d86a6f0`](https://github.com/eclipse-openvsx/openvsx/tree/d86a6f09a55ba24c9fb0a0d4cd78b7384ebf8871): the web UI's README renderer and detail page, the server's `ExtensionProcessor` and `ExtensionValidator`, and the `ovsx` CLI. The web UI resolves DOMPurify 3.4.16 and markdown-it-anchor 9.2.0 (`webui/yarn.lock`). `https://open-vsx.org/api/version` reports `v1.2.0`.

- **Anthropic**: the [Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines), Claude Code's [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance) page and the Agent SDK's [Branding guidelines](https://code.claude.com/docs/en/agent-sdk/overview#branding-guidelines).

- **Marketplace team statements**: [microsoft/vscode-discussions#426](https://github.com/microsoft/vscode-discussions/discussions/426), [microsoft/vsmarketplace#569](https://github.com/microsoft/vsmarketplace/issues/569) and [microsoft/vsmarketplace#1541](https://github.com/microsoft/vsmarketplace/issues/1541).

## Answer

- **vsce ignores `repository.directory`.** A relative path in `packages/vscode/README.md` is rewritten against the repository root: `media/shot.png` becomes `https://github.com/dbarjs/hero-synergy/raw/HEAD/media/shot.png`, which returns 404. Relative links only work if `--baseContentUrl` and `--baseImagesUrl` end in `/packages/vscode`. Absolute URLs need no rewriting.

- **Images:** vsce accepts only `https:` images. SVG files must come from one of 32 trusted badge hosts or be a GitHub Actions badge. Inline `<svg>` and `data:` URIs fail packaging. **GIF, animated WebP and APNG all pass** and play as plain `<img>` on the Marketplace, in the Extensions view and on Open VSX.

- **HTML:** the three renderers differ. The subset all three keep is Markdown tables, `align`, `<img width height>`, `<details>`/`<summary>`, `<br>`, `<sub>` and `<sup>`.
  - The Marketplace drops `<picture>`, `srcset` and `<kbd>`. The Extensions view drops `<picture>`, `srcset`, `media` and nearly all `style`. Neither honors `#gh-dark-mode-only`, and neither renders GitHub alerts (`> [!NOTE]`).
  - **A README `<video>` can't be kept silent on the Marketplace:** `muted` and `playsinline` are stripped and the page forces `controls` on. A visitor who lands on the page directly sees a paused player. One who clicks through from Marketplace search sees an `autoplay` video start **unmuted**, with sound if the file has any. In the Extensions view a muted video autoplays silently.

- **Description cut-offs:** shown in full in the Marketplace banner and the VS Code editor header. Marketplace search tiles show about the first 78 characters ("Unofficial cockpit for mattpocock/skills: wayfinder maps, frontier tickets and…"). The Extensions view list shows about the first 37 at the default 300 px sidebar ("Unofficial cockpit for mattpocock/ski…").

- **Categories:** `AI` and `Chat` are valid. The manifest reference lists 17 categories without them and is out of date. VS Code 1.141's schema and its user docs list 20 including both, and the live Marketplace offers 22. vsce validates none of them.

- **Keywords:** at most 30. The Marketplace enforces this at publish ("You exceeded the number of allowed tags of 30"); vsce does not check the count (35 keywords packaged without complaint). Each keyword becomes a tag verbatim, spaces kept. vsce adds automatic tags on top of the keywords.

- **Package size:** `"files": ["media"]` ships everything under `media/`. Images add about 98% of their size to the VSIX. No renderer reads README images from the VSIX, so README media belongs outside the packaged files. A `!` exclusion in `files` breaks packaging: it pulls in every file.

- **Verified publisher:** needs an HTTPS domain that is not a subdomain, registered at least 6 months, plus 6 months with an extension on the Marketplace. The first release was 2026-10-09 10:47 UTC, so the earliest date is **2027-04-09**. Until then: no blue check anywhere, and VS Code's first-install dialog says "dbarjs is **not** verified".

- **Open VSX** gets the same `extension/readme.md` and renders a superset of it. It keeps `<picture>`, `<video muted>`, `<kbd>` and `style`, renders GitHub alerts, and turns prose quotes and dashes typographic. A README written to the Marketplace subset needs no second version.

- **Naming:**
  - Microsoft allows "[Name] for Visual Studio Code", never "Visual Studio Code [Name]". Spell it "Visual Studio Code" on first mention, imply no endorsement, and don't use the VS Code icon.
  - Anthropic allows saying "accurately, in plain text" that a product runs Claude Code. It forbids "Claude Code" or "Anthropic" in a product, feature or company name or logo, and anything that suggests Anthropic built, endorses or partners with it.

## Header and search

### What each manifest field feeds

| Field | Marketplace item page | Marketplace search tile | VS Code Extensions view | Rules on the way |
| --- | --- | --- | --- | --- |
| `displayName` | Banner title | Tile title, one line | List row name (one line, ellipsis); editor header title | Must be unique in the Marketplace |
| `description` | Under the title, full text, wraps at 608 px | 3-line clamp in a 160 px box; full text only in the tooltip | List row: one line, ellipsis; editor header: full text | No length check in vsce; Open VSX allows 2,048 characters |
| `icon` | Banner | Tile | List row (36 px) and editor header | PNG of at least 128 × 128; vsce rejects SVG |
| `galleryBanner` | Banner background; `theme` sets the text color | Not used | Not used | `theme` is `dark` or `light` |
| `categories` | Breadcrumb (first category) and the sidebar "Categories" | Category filter | Editor sidebar "Categories", each a `@category:` search | Not validated by vsce |
| `keywords` | Sidebar "Tags" | Search matches tags | Not shown; `tag:` filter in search | At most 30, checked at publish |
| `preview` | Orange "Preview" badge beside the title | Not shown | "Preview" label in the editor header only | `GalleryFlags` gets `Preview` |
| `pricing` | "Free" or "Free Trial" in the banner | "FREE" on the tile | Not shown | `Free` or `Trial` only |
| `qna` | "Q & A" tab, a custom link, or nothing | Not used | Not used | `marketplace` (default), a URL, or `false` |
| `badges` | Sidebar, under Project Details | Not used | Not shown | HTTPS; SVG only from trusted hosts |
| `sponsor` | Sponsor link | Not used | Sponsor link in the editor header | `http` or `https` URL |
| `homepage` | Resources: "Homepage" | Not used | Not shown | None |
| `bugs` | Resources: "Issues" | Not used | Resources: "Issues" | None |
| `repository` | Resources: "Repository"; Project Details from GitHub | Not used | Resources: "Repository" | Drives vsce's link rewriting |

The evidence for each row:

- **How the fields reach the gallery.** vsce copies the manifest into `extension.vsixmanifest`. `preview` becomes `<GalleryFlags>Public Preview</GalleryFlags>`. `pricing` defaults to `Free`. `qna` becomes `EnableMarketplaceQnA` or `CustomerQnALink`. `categories` are joined with commas. `galleryBanner`, `badges` and `sponsor.url` are passed through ([`package.ts` L467-L565](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts#L467-L565)). The links map to vsixmanifest properties ([L1525-L1600](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts#L1525-L1600)):
  - `repository` → `Links.Source`, `Links.Getstarted` and `Links.GitHub`
  - `bugs` → `Links.Support`
  - `homepage` → `Links.Learn`
  - `galleryBanner` → `Branding.Color` and `Branding.Theme`
  - `sponsor` → `Microsoft.VisualStudio.Code.SponsorLink`

  The live gallery record for `dbarjs.hero-synergy` carries exactly these properties: `Branding.Color = #0F0B30`, `Branding.Theme = dark`, `Links.Support = https://github.com/dbarjs/hero-synergy/issues`, `Links.Learn = https://github.com/dbarjs/hero-synergy#readme`.

- **What the live item page shows.** Rendered at 1280 px, it shows:
  - **Banner:** the banner in Midnight with white text, the icon, "Hero Synergy", the publisher "dbarjs" (no check), installs, rating, "Free", the description, then an "Installation" box with `ext install dbarjs.hero-synergy`.
  - **Tabs:** Overview, Version History, Q & A, Rating & Review.
  - **Breadcrumb:** "Visual Studio Code > Other > Hero Synergy".
  - **Sidebar:** Categories (Other); Tags (agent, claude code, mattpocock, skills, wayfinder); "Works with: Universal"; Resources (Issues, Repository, Homepage, License, Changelog); Project Details (`dbarjs/hero-synergy`, pull requests, last commit, open issues, pulled from GitHub); More Info (Version, Released on, Last updated, Publisher, Unique Identifier, Report a concern).

- **The manifest reference agrees.** `bugs`, `homepage`, `repository` and `license` are "displayed under the **Resources** section", as Issues, Homepage, Repository and License ([`extension-manifest.md` L128-L150](https://github.com/microsoft/vscode-docs/blob/bd9fee5536c665bfa77cfb39c9d0f593e1f3316b/api/references/extension-manifest.md#L128-L150)). The `galleryBanner` `theme` "refers to the font to be used in the banner" ([L116](https://github.com/microsoft/vscode-docs/blob/bd9fee5536c665bfa77cfb39c9d0f593e1f3316b/api/references/extension-manifest.md#L116)).

- **The page adds two things on its own.**
  - **Support link:** the page's script asks `https://api.github.com/repos/<owner>/<repo>/contents/SUPPORT.md` and, when the repository root has a `SUPPORT.md`, adds a **"Support"** link under Resources (function `isSuportFileExist` in the page bundle `vss-bundle-view`, seen on `ms-python.isort`, whose Resources start with "Support").
  - **Badges:** the same bundle reads `<Badges>` from the VSIX manifest (`fetchBadgesFromVSIXManifest`) and draws them in a `ux-section-badges` block inside Project Details.

- **`preview` shows only in headers.** `ms-python.isort` carries the `preview` flag. Its item page shows an orange "Preview" badge beside the title; its search tile shows nothing. VS Code shows the label in the editor header ([`extensionEditor.ts` L288-L290, L553](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/extensionEditor.ts#L288-L290)), never in the list row ([`extensionsList.ts`](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/extensionsList.ts) has no preview element).

- **VS Code ignores `galleryBanner`.** `galleryBanner` appears in VS Code only in the manifest schema ([`extensionsRegistry.ts` L211-L225](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/services/extensions/common/extensionsRegistry.ts#L211-L225)). A code search of `microsoft/vscode` for `galleryBanner` returns that file alone, and one for `Branding.Color` returns nothing.

- **The Extensions view editor sidebar** shows Installation, Marketplace (identifier, version, published, last released), Categories and Resources: Repository, Issues, License, the publisher and Marketplace ([`extensionEditor.ts` L1072-L1140](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/extensionEditor.ts#L1072-L1140)). It shows no tags and no homepage. The banner title, the "Preview" label, the sponsor widget and the description sit in the header ([L276-L329](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/extensionEditor.ts#L276-L329), [L550-L556](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/extensionEditor.ts#L550-L556)).

- **Field rules vsce enforces.** `pricing` other than `Free` or `Trial` fails with `Pricing can only be "Free" or "Trial"` (lab, and [L1350-L1352](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts#L1350-L1352)). An SVG icon fails with `SVGs can't be used as icons: media/icon.svg` (lab, [L1394-L1396](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts#L1394-L1396)). A `sponsor.url` that is not `http`/`https` fails ([L1440-L1453](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts#L1440-L1453)). `displayName` and `name` "must be unique to the Marketplace" ([`extension-manifest.md` L18, L23](https://github.com/microsoft/vscode-docs/blob/bd9fee5536c665bfa77cfb39c9d0f593e1f3316b/api/references/extension-manifest.md#L18-L23)).

### Where the description is cut

- **Marketplace item page:** the full text. The banner's `.ux-item-shortdesc` is `max-width: 608px; line-height: 1.5; overflow: hidden` with no line clamp (item page CSS), so it wraps.

- **Marketplace search tile:** the tile's `.description` is 160 px wide with `-webkit-line-clamp: 3` and `max-height: 54px` (computed styles in Chromium). Hero Synergy's description needs 80 px of height and gets 48. The tile shows "Unofficial cockpit for mattpocock/skills: wayfinder maps, frontier tickets and…", about 78 characters. The full text is in the `title` tooltip. "Claude Code" is never visible.

- **VS Code editor header:** the full text, set as `textContent` ([`extensionEditor.ts` L556](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/extensionEditor.ts#L556)) with no clipping rule ([`extensionEditor.css` L179-L181](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/media/extensionEditor.css#L179-L181)).

- **VS Code Extensions list row:** one line. The row's description element is `.description.ellipsis` ([`extensionsList.ts` L88](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/extensionsList.ts#L88)), styled `overflow: hidden; white-space: nowrap; text-overflow: ellipsis` ([`extension.css` L216-L220](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/media/extension.css#L216-L220)); the name gets the same treatment (L74-L80).
  - The default sidebar is 300 px, or a quarter of the window when narrower ([`layout.ts` L2879, L3125](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/browser/layout.ts#L2879)).
  - That leaves about 224 px of text: 300 px minus the 16 px row padding, the 36 px icon, its 16 px margin and the 8 px description padding ([`extension.css` L14-L21, L167-L171](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/media/extension.css#L14-L21), [`extensionsWidgets.css` L6-L13](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/media/extensionsWidgets.css#L6-L13)).
  - At 13 px in VS Code's default font stack that fits 37 to 38 characters: "Unofficial cockpit for mattpocock/ski…". This is computed from the CSS and font metrics on Linux, not measured in a running VS Code.

### Categories

- **Three lists exist, and the docs disagree with themselves.**
  - **The manifest reference** allows 17: `Programming Languages, Snippets, Linters, Themes, Debuggers, Formatters, Keymaps, SCM Providers, Other, Extension Packs, Language Packs, Data Science, Machine Learning, Visualization, Notebooks, Education, Testing` ([`extension-manifest.md` L25, L154](https://github.com/microsoft/vscode-docs/blob/bd9fee5536c665bfa77cfb39c9d0f593e1f3316b/api/references/extension-manifest.md#L25)).
  - **VS Code 1.141's manifest schema** has 20, adding `AI`, `Azure` and `Chat` ([`extensions.ts` L321-L342](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/platform/extensions/common/extensions.ts#L321-L342), used as the `categories` enum in [`extensionsRegistry.ts` L195-L210](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/services/extensions/common/extensionsRegistry.ts#L195-L210)). Microsoft's user docs give the same 20 ([`extension-marketplace.md` L233](https://github.com/microsoft/vscode-docs/blob/bd9fee5536c665bfa77cfb39c9d0f593e1f3316b/docs/configure/extensions/extension-marketplace.md#L233)).
  - **The live Marketplace's VS Code tab** embeds 22 in its page data: `AI, Azure, Chat, Data Science, Databases, Debuggers, Education, Extension Packs, Formatters, Keymaps, Language Model Tools, Language Packs, Linters, Machine Learning, Notebooks, Programming Languages, SCM Providers, Snippets, Testing, Themes, Visualization, Other` (`vscode-tab-data` on `https://marketplace.visualstudio.com/vscode`). The gallery's `/_apis/public/gallery/categories` endpoint also lists `AI`, `Chat`, `Databases` and `Language Model Tools`.

- **Which is authoritative:** the live Marketplace decides where an extension is filed and what can be browsed. VS Code's schema decides what the editor accepts in `package.json` without a warning. `Databases` and `Language Model Tools` are on the Marketplace but not in VS Code's enum. `AI` and `Chat` are on both, so they are safe.

- **vsce does not validate categories.** `"categories": ["AI", "Chat", "Not A Category"]` packaged without a warning into `<Categories>AI,Chat,Not A Category</Categories>` (lab). What the Marketplace server does with an unknown category is not verified.

- **In use:** Anthropic's `anthropic.claude-code` ("Claude Code for VS Code") is filed under `AI` and `Chat`; `GitHub.copilot-chat` under `Programming Languages, Machine Learning, AI, Chat` (gallery API). `Chat` belongs to extensions with chat participants: vsce tags those `chat-participant` ([`package.ts` L662-L743](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts#L662-L743)). Hero Synergy contributes none.

- **The first category heads the breadcrumb** ("Visual Studio Code > Other > Hero Synergy"; `ms-python.isort` lists `Programming Languages, Formatters` and its breadcrumb shows `Programming Languages`).

### Keywords and tags

- **How keywords become tags.** vsce joins the keywords into `<Tags>`, after case-sensitive de-duplication, followed by automatic tags ([`package.ts` L662-L743](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts#L662-L743)):
  - `__web_extension` for web-capable extensions
  - `__sponsor_extension` when `sponsor.url` is set
  - language ids and aliases, `__ext_*` file extensions, `theme`, `snippet`, `keybindings`, `json`, `chat-participant`, `tools`, `mcp`
  - words from a built-in list (`git`, `node`, `terminal`, `python` and more) found as whole words in the `description`

  The lab packaged `"claude code"` and `"Claude Code"` as two tags. The live record shows the five keywords verbatim, spaces kept: `agent, claude code, mattpocock, skills, wayfinder`. Today's description adds no automatic tag: "terminals" does not match `terminal` as a whole word.

- **The limit is 30, enforced by the Marketplace at publish.** "The Visual Studio Marketplace does not allow an extension package to have more than 30 `keywords`"; the error is "You exceeded the number of allowed tags of 30" ([`publishing-extension.md` L621-L623](https://github.com/microsoft/vscode-docs/blob/bd9fee5536c665bfa77cfb39c9d0f593e1f3316b/api/working-with-extensions/publishing-extension.md#L621-L623); also "limited to 30 keywords" in [`extension-manifest.md` L26](https://github.com/microsoft/vscode-docs/blob/bd9fee5536c665bfa77cfb39c9d0f593e1f3316b/api/references/extension-manifest.md#L26)). vsce has no count check: 35 keywords packaged into 37 tags (lab).

- **The limit has moved before.** In January 2023 the Marketplace PM announced and briefly enforced a limit of **10**, which "is counting automatic tags too". It was switched off with the advice "keep `keywords`/`tags` under 10" and a promise to "restrict only keywords" ([vscode-discussions#426](https://github.com/microsoft/vscode-discussions/discussions/426), [vsmarketplace#569](https://github.com/microsoft/vsmarketplace/issues/569)). In November 2024 the Marketplace team said it had "removed the limit on tags" (vsmarketplace#569). Today's docs say 30.

- **The gallery stores every packaged tag.** `GitHub.copilot-chat` declares 21 keywords and ships 30 `<Tags>`; the gallery returns all 30.

- **Tags are matched in search and filtered on.** Keywords "make it easier to find the extension" and display name and description "are also used for text search in VS Code" ([`extension-manifest.md` L26, L109](https://github.com/microsoft/vscode-docs/blob/bd9fee5536c665bfa77cfb39c9d0f593e1f3316b/api/references/extension-manifest.md#L109)). VS Code's search box supports `tag:` and `category:` filters ([`extension-marketplace.md` L225-L239](https://github.com/microsoft/vscode-docs/blob/bd9fee5536c665bfa77cfb39c9d0f593e1f3316b/docs/configure/extensions/extension-marketplace.md#L225-L239)). VS Code drops tags that start with `_` ([`extensionsWorkbenchService.ts` L538-L544](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts#L538-L544)) and does not draw them.

## README

### How vsce rewrites links and images

- **The base URLs come from `repository.url` alone.** vsce takes `owner/repo` from `repository.url` and builds `content = https://github.com/<owner>/<repo>/blob/<branch>` and `images = https://github.com/<owner>/<repo>/raw/<branch>`, with `<branch>` defaulting to `HEAD` ([`package.ts` L965-L1009](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts#L965-L1009)). **`repository.directory` is never read**: a search of vsce 4.0.0's `out/package.js` for `directory` finds no use of it, and upstream `main` is identical.

- **The docs claim a `main` default; the code uses `HEAD`.** The docs say vsce adjusts relative links "using the `main` branch by default" ([`publishing-extension.md` L418](https://github.com/microsoft/vscode-docs/blob/bd9fee5536c665bfa77cfb39c9d0f593e1f3316b/api/working-with-extensions/publishing-extension.md#L418)). GitHub resolves `HEAD` to the default branch, `main` here.

- **What gets rewritten:**
  - Markdown links and images `[t](x)` / `![t](x)` with a relative `x`, joined to the content or image base after `path.posix.normalize` ([L803-L833](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts#L803-L833)).
  - The `src` of `<img>` and `<video>` tags, only when it matches `[/.\w\s#-]+` ([L835-L851](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts#L835-L851)).
  - `#123` and `owner/repo#123` after whitespace become issue links, **including inside fenced code blocks** ([L853-L889](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts#L853-L889)).
  - The same processing runs on `CHANGELOG.md` ([L1035](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts#L1035)).

- **What is never rewritten:** `<a href>`, `<source src>`, `<picture>` `srcset`, reference-style links (`[t][ref]` with `[ref]: x`), and `../` segments, which are joined as text, not resolved.

- **The options.** `--githubBranch <ref>` replaces `HEAD`. `--baseContentUrl <url>` prefixes relative links. `--baseImagesUrl <url>` prefixes relative images. **When only `--baseContentUrl` is given, images use it too** ([L771-L774](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts#L771-L774)). `--no-rewrite-relative-links` turns off rewriting, the image checks and issue linking together. `--no-gitHubIssueLinking` turns off issue linking only (`vsce package --help`, `out/main.js` L113-L122).

**Lab.** A minimal extension, scratch copy only, with `name`, `publisher: dbarjs`, `version`, `engines`, `license`, a LICENSE and `"repository": {"url": "git+https://github.com/dbarjs/hero-synergy.git", "directory": "packages/vscode"}`. Packaged with `vsce package --no-dependencies`; the README read back from `extension/readme.md` inside the VSIX.

- Default options:
  - `![shot](media/shot.png)` → `![shot](https://github.com/dbarjs/hero-synergy/raw/HEAD/media/shot.png)` (**404**; the same path with `/packages/vscode` redirects to the file)
  - `![loop](./media/loop.gif)` → `https://github.com/dbarjs/hero-synergy/raw/HEAD/media/loop.gif`
  - `[Changelog](CHANGELOG.md)` → `https://github.com/dbarjs/hero-synergy/blob/HEAD/CHANGELOG.md`
  - `![brand](../../docs/media/cockpit.png)` → `https://github.com/dbarjs/hero-synergy/raw/HEAD/../../docs/media/cockpit.png`
  - `<p align="center"><img src="media/shot.png" width="600">` → `src` rewritten to the `raw/HEAD` URL, the rest untouched
  - `<video src="media/loop.mp4" autoplay loop muted playsinline>` → `src` rewritten
  - `<video><source src="media/loop.mp4">` → **not rewritten**
  - `<picture><source srcset="media/dark.png">` → **`srcset` not rewritten**; the fallback `<img src>` is rewritten
  - `<a href="CHANGELOG.md">` → **not rewritten**
  - `[cl]: CHANGELOG.md` → **not rewritten**
  - `see #12 and dbarjs/hero-synergy#34` → `[#12](https://github.com/dbarjs/hero-synergy/issues/12)` and `[dbarjs/hero-synergy#34](…/issues/34)`
  - In a ` ```sh ` block: `echo #7` → `` echo [#7](https://github.com/dbarjs/hero-synergy/issues/7) `` (the code block is corrupted); `claude -n "#42 …"` is left alone because `#` follows a quote, not whitespace

- `--githubBranch main`: `…/raw/main/media/shot.png`, still without `packages/vscode`.

- `--baseContentUrl https://github.com/dbarjs/hero-synergy/blob/main/packages/vscode --baseImagesUrl https://raw.githubusercontent.com/dbarjs/hero-synergy/main/packages/vscode`: correct URLs, such as `https://raw.githubusercontent.com/dbarjs/hero-synergy/main/packages/vscode/media/shot.png` and `https://github.com/dbarjs/hero-synergy/blob/main/packages/vscode/CHANGELOG.md`. `<source src>`, `srcset`, `<a href>` and reference links were still untouched.

- `--baseContentUrl` alone: `![shot](https://github.com/dbarjs/hero-synergy/blob/main/packages/vscode/media/shot.png)`. A `blob/` URL answers `200 text/html`, a page and not an image, so every image breaks.

- `--no-gitHubIssueLinking`: `#12` and `#7` stay as written.

### Image rules

- **What vsce checks.** vsce renders the README with `marked`, parses the result and checks every `<img>` ([`package.ts` L892-L955](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts#L892-L955)):
  - it has a `src`
  - the `src` parses as an absolute URL
  - it is not an SVG `data:` URL
  - the protocol is `https:`
  - a path ending in `.svg` comes from a trusted host

  Any `<svg>` element fails the package. Microsoft's docs state the same four rules ([`publishing-extension.md` L50-L58](https://github.com/microsoft/vscode-docs/blob/bd9fee5536c665bfa77cfb39c9d0f593e1f3316b/api/working-with-extensions/publishing-extension.md#L50-L58)).

- **The trusted SVG hosts** (32), matched exactly on the host: `api.travis-ci.com, app.fossa.io, badge.buildkite.com, badge.fury.io, badgen.net, badges.frapsoft.com, badges.gitter.im, cdn.travis-ci.com, ci.appveyor.com, circleci.com, cla.opensource.microsoft.com, codacy.com, codeclimate.com, codecov.io, coveralls.io, david-dm.org, deepscan.io, dev.azure.com, docs.rs, flat.badgen.net, gitlab.com, godoc.org, goreportcard.com, img.shields.io, isitmaintained.com, marketplace.visualstudio.com, nodesecurity.io, opencollective.com, snyk.io, travis-ci.com, visualstudio.com, vsmarketplacebadges.dev` ([L318-L355](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts#L318-L355)). GitHub Actions badges matching `https://github.com/<o>/<r>/(actions/)workflows/…badge.svg` are also trusted ([L365-L371](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts#L365-L371)). The docs' list is the same ([`extension-manifest.md` L162-L204](https://github.com/microsoft/vscode-docs/blob/bd9fee5536c665bfa77cfb39c9d0f593e1f3316b/api/references/extension-manifest.md#L162-L204)). `raw.githubusercontent.com` and `github.com/<o>/<r>/raw/…` are **not** on the list.

- **Lab errors**, verbatim:
  - `![seal](media/icon.svg)` → `SVGs are restricted in README.md; please use other file image formats, such as PNG: https://github.com/dbarjs/hero-synergy/raw/HEAD/media/icon.svg`
  - `![seal](https://raw.githubusercontent.com/dbarjs/hero-synergy/main/packages/vscode/media/icon.svg)` → `SVGs are restricted in README.md; please use other file image formats, such as PNG: …`
  - `![shot](http://example.com/shot.png)` → `Images in README.md must come from an HTTPS source: http://example.com/shot.png`
  - `<img src="data:image/png;base64,…">` → `Images in README.md must come from an HTTPS source: data:image/png;base64,…`
  - `<svg …><circle …/></svg>` → `SVG tags are not allowed in README.md.`
  - `![shot][s]` with `[s]: media/shot.png` → `Invalid image source in README.md: media/shot.png`
  - `<img alt="no source">` → `Images in README.md must have a source.`
  - Manifest badge with a `raw.githubusercontent.com` SVG → `Badge SVGs are restricted. Please use other file image formats, such as PNG: …`

- **Lab passes:**
  - `img.shields.io` badges, with and without `.svg`
  - a GitHub Actions `badge.svg`
  - `vsmarketplacebadges.dev`
  - **an SVG inside `<picture><source srcset>`**, because only `<img>` is checked
  - a `<video poster="http://…svg">`, because only `<img>` is checked
  - **with `--no-rewrite-relative-links`, an `http:` image and a relative SVG** both packaged, because that flag also skips the image checks

  Whether the Marketplace server catches those at publish is not verified.

- **GIF, animated WebP and APNG pass vsce.** A relative `.gif`, `.webp`, `.apng` and an APNG named `.png` all packaged (lab); vsce only looks at the `.svg` extension and the protocol.
  - **All three render** as `<img>` on the Marketplace (`<img>` is kept, below), in VS Code (the README webview's CSP is `img-src https: data:`, [`extensionEditor.ts` L791](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/extensionEditor.ts#L791)) and on Open VSX.
  - **All three animate in current browsers** ([MDN image types](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types): APNG from Chrome 59, Firefox 3, Safari 8, and older PNG decoders show its first frame; GIF and WebP everywhere).
  - **In use:** of the 999 most-installed listings, 416 use GIFs, 8 use WebP and none uses APNG.

- **Sizes for the same 3-second 640 × 360 15 fps test clip** (`ffmpeg testsrc2`): APNG 1,290,358 bytes; GIF 718,761; animated WebP (q 75) 409,248; H.264 MP4 210,735. A synthetic pattern, but the order is typical.

- **How GitHub serves each type.** `raw.githubusercontent.com` returns `image/gif`, `image/webp`, `image/png`, and `application/octet-stream` for `.mp4`. Every response carries `cache-control: max-age=300` and `x-content-type-options: nosniff` (response headers). The Marketplace emits the original image URL with no proxy (rendered HTML), so a reader's browser fetches it from GitHub at view time: an image behind a `main` URL changes whenever `main` does.

### What HTML survives

**Method:**

- **The Marketplace** renders the README on its server into the item page. The sanitizer is not public, so its rules were inferred by comparing the packaged READMEs of 80 live listings, chosen for the most distinct raw HTML, with their rendered pages. Plus targeted pages: `vitest.explorer` and `yoavbls.pretty-ts-errors` for `<picture>`; `Bito.Bito`, `yy0931.vscode-sqlite3-editor` and `donjayamanne.python-environment-manager` for `<video>`; `asvetliakov.vscode-neovim` for alerts; `redhat.vscode-yaml` for `<kbd>`.
- **The Extensions view** is read from source. The extension editor renders the README with `renderMarkdownDocument`, which sanitizes with `allowedMarkdownHtmlTags` and `allowedMarkdownHtmlAttributes` plus `name, id, class, role, tabindex, placeholder` ([`markdownDocumentRenderer.ts` L165-L190](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/markdown/browser/markdownDocumentRenderer.ts#L165-L190)). It allows the links `http`, `https` and `mailto` ([`extensionEditor.ts` L760-L781](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/extensionEditor.ts#L760-L781)) and media from `http`/`https` only, with no relative paths ([`domSanitize.ts` L312-L323](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/base/browser/domSanitize.ts#L312-L323)).
  - **Allowed tags:** `basicMarkupHtmlTags` + `input`. They include `details, summary, img, video, source, table…, div, span, p, br, hr, sub, sup, kbd, figure, figcaption`; `picture`, `svg`, `style`, `iframe` and `audio` are absent ([`domSanitize.ts` L15-L83](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/base/browser/domSanitize.ts#L15-L83), [`markdownRenderer.ts` L681-L684](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/base/browser/markdownRenderer.ts#L681-L684)).
  - **Allowed attributes:** `align, autoplay, alt, colspan, controls, draggable, height, href, loop, muted, playsinline, poster, rowspan, src, target, title, type, width, start, checked, disabled, value`, plus `style` only on `<span>` with color values ([`markdownRenderer.ts` L686-L742](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/base/browser/markdownRenderer.ts#L686-L742)).
- **Open VSX** renders with markdown-it (`html: true, linkify: true, typographer: true`), the `@mdit/plugin-alert` and `markdown-it-anchor` plugins, then `DOMPurify.sanitize` with its defaults ([`sanitized-markdown.tsx` L165-L198](https://github.com/eclipse-openvsx/openvsx/blob/d86a6f09a55ba24c9fb0a0d4cd78b7384ebf8871/webui/src/components/sanitized-markdown.tsx#L165-L198)). DOMPurify 3.4.16's default lists include `details` (L34), `kbd` (L64), `picture` (L82), `style` (L102), `video` (L121) and `svg` ([`tags.ts`](https://github.com/cure53/DOMPurify/blob/3.4.16/src/tags.ts)), and `align`, `controls`, `muted`, `srcset` and `style` ([`attrs.ts`](https://github.com/cure53/DOMPurify/blob/3.4.16/src/attrs.ts)).

| Construct | Marketplace page | Extensions view | Open VSX |
| --- | --- | --- | --- |
| Markdown tables | Kept | Kept | Kept |
| HTML `<table>`, `colspan`, `rowspan` | Kept, with `align`, `width`, `border`, `valign` | Kept; `border` and `valign` dropped | Kept |
| `align` on `p`, `div`, `h1`–`h6`, `img`, `td` | Kept | Kept | Kept |
| `<img width height>` | Kept | Kept | Kept |
| `<details>`, `<summary>` | Kept, with `open` | Kept; `open` dropped, so it starts closed | Kept |
| `<picture>` + `<source srcset media>` | `<picture>` and `srcset` dropped; `<source media>` left inert; the fallback `<img>` shows | `<picture>`, `srcset` and `media` dropped; the fallback `<img>` shows | Kept; the browser picks by `prefers-color-scheme` |
| `#gh-dark-mode-only`, `#gh-light-mode-only` | No effect: both images show | No effect: both show | No effect: both show |
| `<video src autoplay loop muted playsinline controls>` | Kept without `muted`, `playsinline` and `controls`; the page script re-adds `controls`; `autoplay` plays unmuted after a click on the Marketplace, not on a direct visit | Kept whole; muted autoplay allowed | Kept whole |
| `<kbd>` | Dropped, text kept | Kept | Kept, styled |
| `style` attribute | Kept on many elements (re-serialized) | Dropped, except restricted colors on `<span>` | Kept |
| `<style>` element | Kept and re-serialized; applies to the whole page | Dropped | In DOMPurify's default list |
| Inline `<svg>` | Fails vsce packaging | Fails vsce packaging | Fails vsce packaging |
| GitHub alerts (`> [!NOTE]`) | Plain blockquote reading "[!TIP] …" | Plain blockquote (no alert extension) | Rendered as alert boxes |
| Relative URL left in HTML | Broken: resolves against marketplace.visualstudio.com | Removed by the sanitizer | Broken |
| `#heading` links | Work; ids like `id=requirements` | Work; GitHub-style ids | Work when the heading has no punctuation |

Evidence, row by row:

- **`<picture>`.** `vitest.explorer`'s README has `<picture><source media="(prefers-color-scheme: dark)" srcset="./img/cover-light.png">…<img … src="…cover-dark.png"></picture>`. The page serves `<source media="(prefers-color-scheme: dark)">` with no `<picture>` and no `srcset`, then the `<img>`. The comparison shows `picture` dropped on 3 of 3 pages and `srcset` on every `<source>` and `<img>` that had one.

- **`#gh-dark-mode-only`.** `yoavbls.pretty-ts-errors` serves `…tanner-dark.png#gh-dark-mode-only` on the white page, and no CSS on the item page mentions `gh-dark-mode-only` or `prefers-color-scheme`. VS Code's and Open VSX's README styles have no such rule either ([`markdownDocumentRenderer.ts` L18-L158](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/markdown/browser/markdownDocumentRenderer.ts#L18-L158), [`sanitized-markdown.tsx` L20-L163](https://github.com/eclipse-openvsx/openvsx/blob/d86a6f09a55ba24c9fb0a0d4cd78b7384ebf8871/webui/src/components/sanitized-markdown.tsx#L20-L163)).

- **`<kbd>`.** It was dropped on 14 of 14 pages. `redhat.vscode-yaml`'s `(<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd>)` renders as `(Ctrl + Shift + O)`.

- **`<style>`.** `Bito.Bito`'s `<style>h1 {text-align: left; …}` is served re-serialized as `<style>h1 {text-align:left; …}`. A `<style>` block is not scoped to the README, so its rules hit the Marketplace's own elements.

- **GitHub alerts.** `asvetliakov.vscode-neovim`'s `> [!TIP]` renders as `<blockquote><p>[!TIP] The previously used module…`. VS Code's renderer loads only `markedHighlight` and `markedGfmHeadingIdPlugin` ([`markdownDocumentRenderer.ts` L230-L249](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/markdown/browser/markdownDocumentRenderer.ts#L230-L249)).

- **Kept on the Marketplace across the 80 pages:** `a, b, br, center, code, details, summary, div, em, h1–h6, hr, i, img, li, p, pre, small, source, strong, sub, sup, table, thead, tbody, tr, th, td, ul, video`. Attributes: `align`, `width`, `height`, `alt`, `title`, `target`, `class`, `style`, `colspan`, `rowspan`, `valign`, `border`, `details[open]`, `source[media|src|type]`, `video[autoplay|loop|width|style]`. Dropped: `img[srcset]`, `source[srcset]`, `source[width]`, `img[draggable]`, `video[muted]`, `video[playsinline]`.

- **Links.** Marketplace links get `target=_blank rel="noreferrer noopener nofollow"` (rendered HTML). In VS Code a click opens only `http`, `https` and `mailto` links ([`extensionEditor.ts` L736-L750](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/extensionEditor.ts#L736-L750)).

- **Heading ids on Open VSX.** markdown-it-anchor 9.2.0's default slug is `encodeURIComponent(String(s).trim().toLowerCase().replace(/\s+/g, "-"))` (`dist/markdownItAnchor.js`), so punctuation stays in the id. GitHub-style renderers strip it, so `#whats-new` would miss "What's new" on Open VSX.

- **Size.** A README of 137,073 characters was served whole: `IsMDPruned: false` on every long listing tested, in the item page's `jiContent` data. Length is not a practical limit.

### Video

- **On the Marketplace a README video can't be kept silent, and whether it autoplays depends on how the visitor arrived.**
  - **What the server keeps:** `<video>` with `src`, `autoplay`, `loop`, `width`, `title` and `style`, and `<source src type>`. It **strips `muted`, `playsinline` and `controls`**: `Bito.Bito`'s `<video autoplay loop muted playsinline width="100%">` is served as `<video autoplay="" loop="" width="100%" style="…">`.
  - **What the page script adds:** every `<video>` in `.markdown` without `controls` gets `setAttribute("controls","")` (function in the `vss-bundle-view` bundle). The DOM after load shows `autoplay loop width style controls`.
  - **The test:** Chromium with `--autoplay-policy=document-user-activation-required`, which models Chrome's published rules ("Muted autoplay is always allowed"; sound needs the user to have "interacted with the domain"; muted autoplay needs the `muted` attribute, [Chrome's autoplay policy](https://developer.chrome.com/blog/autoplay)), loaded three live listings directly: `Bito.Bito`, `yy0931.vscode-sqlite3-editor` and `donjayamanne.python-environment-manager`. Every video reported `paused: true, muted: false, readyState: 4` after 3 seconds: the MP4s loaded and did not play. A local page with the same markup confirmed it: the stripped form stayed paused with and without an audio track, and the authored form with `muted playsinline` played.
  - **The click-through test:** the same browser opened Marketplace search, clicked the `Bito.Bito` tile, then the `donjayamanne.python-environment-manager` tile. On both item pages every `autoplay` video was **playing**: `paused: false, muted: false`, at 0.6 to 5 seconds after 4 seconds. A click on the Marketplace counts as interaction with the domain, so the stripped `muted` lets the video autoplay **with its sound**.
  - **Net effect:** a visitor who arrives from outside sees a paused player with controls. A visitor who arrives from Marketplace search gets an `autoplay` video playing, unmuted. The README cannot prevent the sound, because `muted` never reaches the page. Only a file with no audio track stays silent.

- **The Extensions view autoplays a muted video.**
  - **What's allowed:** VS Code keeps `muted`, `autoplay`, `loop`, `playsinline`, `controls` and `poster`, and the README's CSP allows `media-src https:` ([`extensionEditor.ts` L791](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/extensionEditor.ts#L791)).
  - **The autoplay policy:** windows run with `autoplayPolicy: 'user-gesture-required'` ([`windows.ts` L156](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/platform/windows/electron-main/windows.ts#L156)), and webview frames carry `allow="…autoplay…"` ([`webviewElement.ts` L420-L424](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/webview/browser/webviewElement.ts#L420-L424), [`pre/index.html` L1034-L1038](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/webview/browser/pre/index.html#L1034-L1038)).
  - **The test:** Chromium with `--autoplay-policy=user-gesture-required` played the `muted` videos and left the unmuted ones paused.
  - **Codecs:** webviews play H.264 and VP8 video, but not AAC audio ([`webview.md` L580-L596](https://github.com/microsoft/vscode-docs/blob/bd9fee5536c665bfa77cfb39c9d0f593e1f3316b/api/extension-guides/webview.md#L580-L596)). A typical MP4 plays silent.

- **Hosting:** `raw.githubusercontent.com` serves `.mp4` as `application/octet-stream`; Chromium still loaded and decoded it (`readyState: 4`, no error).

### Theming and sizing

- **Marketplace: light only, column at most 711 CSS px.**
  - **Colors:** `.markdown { color: #222 }`, white and `#f8f8f8` table rows, and no `prefers-color-scheme` rule anywhere on the item page (item page CSS).
  - **Sizing:** `.markdown img` and `.markdown video` are `max-width: 100%`; tables are `display: block; overflow: auto`. The README column is 711 CSS px wide at every viewport from 1280 to 2560 px wide, and 569 px at 1024 (`.markdown` content width measured in Chromium).

- **Extensions view: the editor's own background, up to 882 px.**
  - **Colors:** the README renders in a webview whose body is `background-color: transparent; color: var(--vscode-editor-foreground)`, so it sits on the editor background of the active theme ([`pre/index.html` L100-L135](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/webview/browser/pre/index.html#L100-L135)).
  - **Sizing:** the README styles are `body { padding: 10px 20px; max-width: 882px; margin: 0 auto }` and `img { max-width: 100%; max-height: 100% }` ([`markdownDocumentRenderer.ts` L18-L33](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/markdown/browser/markdownDocumentRenderer.ts#L18-L33)).
  - **Theme hooks the README can't reach:** the body gets `vscode-light`, `vscode-dark`, `vscode-high-contrast` or `vscode-high-contrast-light` ([`pre/index.html` L480-L505](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/webview/browser/pre/index.html#L480-L505)). A README cannot use them: `<style>` and `style` are stripped and `<picture>` is gone. The README is re-rendered on a theme change only to recolor code blocks ([`extensionEditor.ts` L728-L734](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/extensionEditor.ts#L728-L734)).

- **Open VSX: `img { max-width: 100% }`, beside a sidebar of at least 290 px** ([`sanitized-markdown.tsx` L51-L53](https://github.com/eclipse-openvsx/openvsx/blob/d86a6f09a55ba24c9fb0a0d4cd78b7384ebf8871/webui/src/components/sanitized-markdown.tsx#L51-L53), [`extension-detail-overview.tsx` L332-L353](https://github.com/eclipse-openvsx/openvsx/blob/d86a6f09a55ba24c9fb0a0d4cd78b7384ebf8871/webui/src/pages/extension-detail/extension-detail-overview.tsx#L332-L353)).

- **Consequence: one image per slot.** Each image must read on a white page and on any dark or light editor background, with no way to swap it per theme. An opaque image, such as a screenshot or the Seal on its tile, works everywhere. A transparent image drawn for one theme disappears on the other.

### Where the Extensions view gets the README

- **An installed extension** shows the local `extension/readme.md`, the vsce-processed file ([`extensionsWorkbenchService.ts` L464-L492](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts#L464-L492)).

- **An extension not installed, or another version,** shows the Marketplace's `Microsoft.VisualStudio.Services.Content.Details` asset, the same file ([`extensionEditor.ts` L509-L542](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/extensionEditor.ts#L509-L542), [`extensionGalleryService.ts` L520](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/platform/extensionManagement/common/extensionGalleryService.ts#L520)).

- **For 0.1.1 that asset is byte-identical to `packages/vscode/README.md`,** because every link in it is already absolute.

## Package size

- **`files` ships whole directories.** With `files` and no `.vscodeignore`, vsce turns each entry into a negated ignore pattern, `!media` → `!media` and `!media/**`, then ignores everything else ([`package.ts` L1767-L1800](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts#L1767-L1800)). Every file under `packages/vscode/media/` is packaged; `README.md` and `package.json` always are.

- **The published 0.1.1 VSIX is 394,676 bytes, 17 entries.** The biggest are:
  - `dist/extension.cjs`: 655,608 bytes, stored as 162,942
  - `dist/webview/main.js`: 198,431, stored as 75,257
  - `codicon.ttf`: 149,508, stored as 73,371
  - `media/icon.png`: 62,475, stored as 57,306 (PNG barely compresses)

  `media/icon.svg` (2,609 bytes) ships too, though the manifest never references it; `docs/brand.md` keeps it as the source of the PNG. A lab copy of `packages/vscode` with the built `dist/` packaged to the same 394,676 bytes.

- **README media ships at almost full size.** Adding `media/readme/` with `loop.gif`, `loop.webp`, `loop.mp4` and `shot.png` (1,368,119 bytes) grew the VSIX to 1,741,376 bytes: **+1,346,700, 98% of the media's size**. Every installation downloads that, and nothing reads it:
  - The Marketplace and VS Code render README images from their `https` URLs.
  - VS Code's sanitizer drops relative media paths ([`domSanitize.ts` L312-L323](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/base/browser/domSanitize.ts#L312-L323)).
  - Open VSX renders the same rewritten README.

  So README media should live outside the packaged `files`.

- **A `!` entry in `files` packages everything.** `"files": ["dist", "claude-plugin", "media", "!media/readme", …]` still packaged `media/readme/*` **and also `src/secret-source.ts` and `tsconfig.json`**, which were in no pattern (lab, `vsce ls`). vsce prefixes each entry with `!`, so `!media/readme` becomes `!!media/readme`, a negation that re-includes every path. Listing files explicitly works: `"files": ["dist", "claude-plugin", "media/icon.png", "media/hero-synergy.svg", …]` packaged 16 files, 384.6 KB, no README media.

- **Limits.**
  - **Microsoft documents no VSIX size limit for VS Code extensions.** A 2025 request to document one was closed with a referral to `VSMarketplace@microsoft.com` ([vsmarketplace#1541](https://github.com/microsoft/vsmarketplace/issues/1541)).
  - **Open VSX's limit is 262,144,000 bytes** (250 MiB; `"maxExtensionSize":262144000` from `https://open-vsx.org/api/version`).
  - **vsce warns at more than 5,000 files or 100 JavaScript files** ([`package.ts` L2130-L2140](https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts#L2130-L2140)). Its file tree marks any file above 85% of the package in red and above 20% in yellow (`out/util.js` L272-L273, L355-L373).
  - **VS Code shows the installed size** under "Installation" ([`extensionEditor.ts` L1185-L1200](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/extensionEditor.ts#L1185-L1200)).

## Verified publisher

- **The prerequisites** ([`publishing-extension.md` L428-L481](https://github.com/microsoft/vscode-docs/blob/bd9fee5536c665bfa77cfb39c9d0f593e1f3316b/api/working-with-extensions/publishing-extension.md#L428-L481)):
  - "a publisher must have one or more extensions on the VS Marketplace for a minimum of 6 months, and the registration of the domain must also be at least 6 months old"
  - the domain must allow a DNS TXT record, must not be a subdomain ("{subdomain}.github.io" is the docs' own example), must use HTTPS, and must answer a `HEAD` request with HTTP 200

- **The process.** Enter the domain under the publisher's Details tab at `marketplace.visualstudio.com/manage`, then Save, Verify, add the TXT record and Verify again. A review follows "within 5 business days", covering "domain, website and extensions prerequisites for track record, content eligibility, legitimacy, trust and positive reputation".

- **What revokes the badge:** "Any changes to the publisher display name will revoke the verified badge", as will Terms of Use violations.

- **For `dbarjs`.**
  - **The track-record clock started at the first release,** 2026-10-09 10:47:38 UTC (gallery `releaseDate`; "Released on 10/9/2026" on the page), so the earliest application date is **2027-04-09**.
  - **A domain is needed:** Hero Synergy has none of its own; any domain Eduardo controls that was registered at least six months before the application works.
  - **Today's record:** the publisher's display name is `dbarjs`, with `"domain": null, "isDomainVerified": false`. Its `"flags": "verified"` is not the badge: GitHub, GitKraken and Anthropic carry the same flag together with `isDomainVerified: true` (gallery API).

- **What shows without the badge.**
  - **Marketplace:** the publisher name alone. With the badge, a blue check and a domain link sit beside it, as "Microsoft ✓ microsoft.com" on `ms-python.isort`, and the domain also shows on search tiles.
  - **VS Code:** the name alone. The list row gets a check icon only when `publisherDomain.verified`; the editor header adds the check, the domain and a hover "This publisher has verified ownership of …" ([`extensionsWidgets.ts` L331-L381](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts#L331-L381), fed by `publisher.isDomainVerified`, [`extensionGalleryService.ts` L547](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/platform/extensionManagement/common/extensionGalleryService.ts#L547)).

- **The trust dialog appears either way.** On the first install from a publisher (since VS Code 1.97), VS Code asks "Do you trust the publisher "dbarjs"?" ([`extension-runtime-security.md` L18-L29](https://github.com/microsoft/vscode-docs/blob/bd9fee5536c665bfa77cfb39c9d0f593e1f3316b/docs/configure/extensions/extension-runtime-security.md#L18-L29); [`extensionManagementService.ts` L820-L930](https://github.com/microsoft/vscode/blob/2a59476c9bfcb90b3ddc372c36762471b7dfad1c/src/vs/workbench/services/extensionManagement/common/extensionManagementService.ts#L820-L930)). For an unverified publisher it says "The extension Hero Synergy is published by dbarjs. This is the first extension you're installing from this publisher.", then "dbarjs is **not** verified." and "Visual Studio Code has no control over the behavior of third-party extensions…", with the buttons "Trust Publisher & Install" and "Learn More". For a verified publisher the second line reads "… has verified ownership of <domain>." **Verification changes that one line; it does not remove the dialog.**

## Open VSX

- **Same file.** `ovsx publish --packagePath <file>.vsix`, the repo's `publish:open-vsx` script, uploads the VSIX untouched ([`cli/src/publish.ts` L71-L77](https://github.com/eclipse-openvsx/openvsx/blob/d86a6f09a55ba24c9fb0a0d4cd78b7384ebf8871/cli/src/publish.ts#L71-L77)). The server takes the README from the VSIX manifest's `Microsoft.VisualStudio.Services.Content.Details` asset, the vsce-processed `extension/readme.md` ([`ExtensionProcessor.java` L486-L551](https://github.com/eclipse-openvsx/openvsx/blob/d86a6f09a55ba24c9fb0a0d4cd78b7384ebf8871/server/src/main/java/org/eclipse/openvsx/ExtensionProcessor.java#L486-L551)). When `ovsx` packages a folder itself, it calls vsce's `createVSIX` with the same `baseContentUrl` and `baseImagesUrl` options ([`publish.ts` L270-L287](https://github.com/eclipse-openvsx/openvsx/blob/d86a6f09a55ba24c9fb0a0d4cd78b7384ebf8871/cli/src/publish.ts#L270-L287)).

- **Metadata comes from the same vsixmanifest** ([`ExtensionProcessor.java` L303-L342](https://github.com/eclipse-openvsx/openvsx/blob/d86a6f09a55ba24c9fb0a0d4cd78b7384ebf8871/server/src/main/java/org/eclipse/openvsx/ExtensionProcessor.java#L303-L342)): display name, description, categories, tags, `GalleryFlags` (Preview), `Links.Learn` (homepage), `Links.Source` (repository), `Links.Support` (bugs), `Branding.Color`/`Theme` and the sponsor link. `license`, `markdown` and `qna` come from `package.json`.

- **What it validates** ([`ExtensionValidator.java` L40-L158](https://github.com/eclipse-openvsx/openvsx/blob/d86a6f09a55ba24c9fb0a0d4cd78b7384ebf8871/server/src/main/java/org/eclipse/openvsx/ExtensionValidator.java#L40-L158)):
  - display name up to 255 characters; description up to 2,048
  - each category and keyword up to 255 characters
  - no control or format characters
  - absolute URLs, with `git+` allowed
  - `galleryBanner.color` up to 16 characters; `theme` must be `dark` or `light`
  - `qna` must be `marketplace`, `false` or a URL

  **No category whitelist and no keyword count:** it keeps the first 30 declared tags after case-insensitive de-duplication and silently drops the rest; internal `__` tags are capped at 100 ([L56-L84, L378-L401](https://github.com/eclipse-openvsx/openvsx/blob/d86a6f09a55ba24c9fb0a0d4cd78b7384ebf8871/server/src/main/java/org/eclipse/openvsx/ExtensionProcessor.java#L56-L84)).

- **What the page draws differently:**
  - **Header:** a band in `galleryBanner.color` with text color chosen by contrast, a "Preview" badge, and the description ([`extension-detail.tsx` L200-L266, L331-L367](https://github.com/eclipse-openvsx/openvsx/blob/d86a6f09a55ba24c9fb0a0d4cd78b7384ebf8871/webui/src/pages/extension-detail/extension-detail.tsx#L331-L367)).
  - **Sidebar:** Categories, Tags without the `__` ones, "Works With", and Resources: Homepage, Repository, Bugs, and "Q'n'A" only when `qna` is a URL ([`extension-detail-overview.tsx` L245-L266, L314-L396](https://github.com/eclipse-openvsx/openvsx/blob/d86a6f09a55ba24c9fb0a0d4cd78b7384ebf8871/webui/src/pages/extension-detail/extension-detail-overview.tsx#L314-L396)).
  - **Warning until ownership is granted:** while the namespace has no verified owner, a warning icon sits beside it and a banner says "This version of the "Hero Synergy" extension was published by <user>. That user account is not a verified publisher of the namespace "dbarjs"…" ([`extension-detail.tsx` L86-L135](https://github.com/eclipse-openvsx/openvsx/blob/d86a6f09a55ba24c9fb0a0d4cd78b7384ebf8871/webui/src/pages/extension-detail/extension-detail.tsx#L86-L135)). The claim process is in `docs/research/name-availability.md` on `research/name-availability`.

- **README rendering is a superset of the other two:**
  - It keeps `<picture>` with `srcset`, `<video muted playsinline controls>`, `<kbd>`, `style` and `<details open>`.
  - It renders `> [!NOTE]` alerts.
  - `linkify` turns bare URLs into links.
  - **`typographer` changes prose:** straight quotes become curly and `--` becomes "–", but not inside code spans.
  - **Heading ids keep punctuation** (above).

- **Size limit:** 250 MiB. Not live yet: `https://open-vsx.org/api/dbarjs/hero-synergy` returns 404.

- **One README serves both:** written to the Marketplace and VS Code subset, it renders correctly on Open VSX with no second version. Avoid alerts, which render only there, and keep anchor-target headings free of punctuation.

## Naming

### Microsoft: "Visual Studio Code" and "VS Code"

From the [Visual Studio Code brand guidelines](https://code.visualstudio.com/brand), "Brand name":

- **OK:** "Please use "Visual Studio Code" on the first instance."; "Note proper capitalization and spacing (please do not say "vscode", "VSCode", "VSC", or "Code")."

- **Not OK:** "Using the product name — Visual Studio Code or VS Code — on your website, product, service, or in your domain names."; "Naming your products, applications, or projects anything that implies an endorsement from Microsoft or the Visual Studio Code team."

- **For extensions** ("Do you make content (extensions, training material, etc) for Visual Studio Code?"): "Correct: [My Extension Name] for Visual Studio Code"; "Incorrect: Visual Studio Code [My Extension Name]".

- **Icon, not OK:** "Using the icon to identify or promote your own product, service, application, VS Code extension…", "Integrating the VS Code icon into your logo", and modifying the icon. **OK:** using it in documentation about VS Code.

- **The Marketplace itself uses the pattern:** its share subject for this listing reads "Check out - Hero Synergy for Visual Studio Code" (`EmailShareSubject` in the item page data).

- **The Marketplace "stops extension authors from stealing the names of official publishers … and popular extensions"** ([`extension-runtime-security.md` L60](https://github.com/microsoft/vscode-docs/blob/bd9fee5536c665bfa77cfb39c9d0f593e1f3316b/docs/configure/extensions/extension-runtime-security.md#L60)).

- **For Hero Synergy:**
  - `displayName` "Hero Synergy" needs no product name.
  - The description and README use "VS Code" from the first mention. The guideline asks for "Visual Studio Code" first: the README's opening sentence, "An unofficial VS Code cockpit…", is a first instance.

### Anthropic: "Claude" and "Claude Code"

- **Claude Code's [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance) page, "Using the Claude Code name and logo"**: "You can accurately say, in plain text, that your product has Claude Code preinstalled or that it runs Claude Code. But you can't use the Claude Code or Anthropic names or logos as part of your own product, feature, or company name, in your own logo, or in a way that suggests Anthropic built, endorses, or is partnered with your product. Any other use of Anthropic's names or logos is governed by our Trademark Guidelines and requires our written permission." This is the rule closest to Hero Synergy, which launches the user's own `claude` binary.

- **The [Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)**: "You may only use our trademarks as specifically permitted by us and only in materials we approve beforehand"; "You may not use our trademarks in a manner that implies Anthropic's sponsorship or endorsement, or a relationship or affiliation with Anthropic"; "No alterations of our trademarks… are permitted"; "Do not use a trademark symbol with the trademarks."

- **The Agent SDK's [Branding guidelines](https://code.claude.com/docs/en/agent-sdk/overview#branding-guidelines)** cover "partners integrating the Claude Agent SDK", which Hero Synergy is not:
  - **Allowed:** "Claude Agent", "Claude" inside a menu labeled "Agents", "{YourAgentName} Powered by Claude".
  - **Not permitted:** ""Claude Code" or "Claude Code Agent"" and "Claude Code-branded ASCII art or visual elements that mimic Claude Code".
  - "Your product should maintain its own branding and not appear to be Claude Code or any Anthropic product."

- **Anthropic's own extension** is `anthropic.claude-code`, "Claude Code for VS Code", from a verified publisher (gallery API). A third-party listing must not be mistakable for it.

- **For Hero Synergy:**
  - "Hero Synergy" uses neither name.
  - "named Claude Code sessions in VS Code terminals" is a plain-text statement that it runs Claude Code.
  - The README's "not affiliated with or endorsed by Matt Pocock or Anthropic" line matches the endorsement rule.
  - What stays off-limits: "Claude" or "Claude Code" in the display name, in a feature or command name, or in the logo; Anthropic or Claude marks in images; anything styled like Claude Code.

## Recommendations for this repo

**For [#117 What does Hero Synergy say about itself?](https://github.com/dbarjs/hero-synergy/issues/117):**

- **Write the description to three lengths:**
  - about 37 characters for the VS Code list row
  - about 78 for the Marketplace search tile
  - full text for both headers

  Today's description shows "Unofficial cockpit for mattpocock/ski…" in VS Code and never reaches "Claude Code" on a tile. Put what Hero Synergy is in the first 35 characters.

- **Pick `AI` as the category.** It is valid in VS Code's schema and on the Marketplace, it heads the breadcrumb, and Anthropic's own extension uses it. Leave out `Chat`, which Hero Synergy contributes nothing to. Treat the manifest reference's 17-item list as stale.

- **Keep keywords at 10 or fewer:** under the published limit of 30, and inside the 10 the Marketplace once enforced. Make each keyword a phrase someone types. Check the packaged `<Tags>` after any description change, since words such as `terminal`, `git` or `node` add tags. vsce de-duplicates keywords case-sensitively, so avoid near-duplicates.

- **`preview: true` shows only as a "Preview" badge in the Marketplace and VS Code headers,** never on tiles or list rows. It is a header-only honesty signal for a 0.x release.

- **Naming:** spell "Visual Studio Code" on its first mention in the README and the description, or leave the product unnamed in the description, since the listing already sits in the VS Code Marketplace. Keep "unofficial" and plain-text mentions of Claude Code. Never name a feature, command or image after Claude Code.

**For [#118 Cut the trailer for the web](https://github.com/dbarjs/hero-synergy/issues/118):**

- **Don't count on a `<video>` in the listing README to play:**
  - **Marketplace:** strips `muted` and forces `controls` on. With `autoplay`, a visitor who clicked through from Marketplace search hears the trailer's stereo sound at once; a direct visitor sees a paused player.
  - **VS Code:** a muted H.264 or VP8 video autoplays, but AAC audio stays silent.
  - **Open VSX:** keeps everything.

  If the trailer appears on the listing, embed it **without `autoplay`**, as a click-to-play video with a meaningful first frame. Whether the Marketplace keeps `poster` is not verified. Any listing video that autoplays must be a cut with **no audio track**: `muted` is stripped, so visitors from Marketplace search would hear it. Otherwise use a still that links to the video on GitHub.

- **Hosting:** `raw.githubusercontent.com` serves MP4 as `application/octet-stream`, and Chromium plays it. Keep the file outside `packages/vscode/media`.

**For [#116](https://github.com/dbarjs/hero-synergy/issues/116), the loop of the real UI:**

- **GIF, animated WebP and APNG all pass vsce and play on all three surfaces.** Prefer **animated WebP**: in the lab it was 43% smaller than GIF and 68% smaller than APNG for the same clip. Use GIF only if WebP shows artifacts. If APNG is used, name it `.png` so GitHub serves `image/png`. A silent MP4 in `<video>` is smaller still (211 KB in the lab), but it plays for only some Marketplace visitors: a direct visitor gets a paused player. An animated image plays for everyone.

- **Size for the widest column:** 711 CSS px on the Marketplace, up to 882 in VS Code. Export at about 1,400 to 1,800 px wide for 2× displays and let `max-width: 100%` scale it down, or about 900 px if file size matters more than sharpness.

- **Give every frame an opaque background,** because nothing can swap images by theme. Record one loop that reads on white and on dark editor backgrounds.

**For [#119](https://github.com/dbarjs/hero-synergy/issues/119), the READMEs and where media lives:**

- **Write the listing README to the common subset:** Markdown, Markdown tables, `<p align="center">`, `<img width>`, `<details>`/`<summary>`, `<br>`.
  - **Not:** `<picture>`/`srcset`, `#gh-dark-mode-only`, `<kbd>` (use code spans), `style`/`<style>`, inline `<svg>`, SVG images other than trusted badges, `> [!NOTE]` alerts, `data:` images, or `http:` URLs.
  - **The root README on GitHub** can keep `<picture>` and SVG.

- **Use absolute `https://` URLs for every link and image** in `packages/vscode/README.md`, as `docs/brand.md` already asks. vsce rewrites relative paths against the repository root and ignores `repository.directory`, and it never rewrites `<a href>`, `<source src>`, `srcset` or reference links.
  - **If relative Markdown paths are kept** for GitHub's sake, the package script must pass `--baseContentUrl https://github.com/dbarjs/hero-synergy/blob/<ref>/packages/vscode` and `--baseImagesUrl https://raw.githubusercontent.com/dbarjs/hero-synergy/<ref>/packages/vscode`, both.

- **Keep README media out of the VSIX.** Either put it outside `packages/vscode`, for example `docs/media/`, or list the packaged media file by file: `"files": ["media/icon.png", "media/hero-synergy.svg", …]`. **Never use a `!` entry in `files`**: vsce then packages the whole folder, `src/` included.

- **Pin media URLs to the release** rather than `main`, so the page for version X shows version X's Cockpit, as the map's honesty note asks. Use the `v<version>` tag or the release commit. `main` URLs change as soon as `main` does (5-minute cache).

- **Watch for ` #<digits>` in the README and CHANGELOG:** vsce turns it into an issue link even inside code blocks. The current `claude -n "#<number> <title>"` is safe; ` #42` in a code sample is not. Avoid it, or add `--no-gitHubIssueLinking`.

- **Headings used as anchor targets:** keep them free of punctuation so `#anchor` links work on Open VSX too.

- **Support link:** a `SUPPORT.md` at the repository root adds a "Support" link to the Marketplace page's Resources. That bears on the map's open question about community files.

- **Optional:** `"qna": false` removes the Marketplace's Q & A tab and leaves Issues as the one place for questions.

**For [#121](https://github.com/dbarjs/hero-synergy/issues/121), shipping through a release:**

- **Pin with `$GITHUB_SHA`:** `release.yml` packages on `$GITHUB_SHA` and only creates the `v<version>` tag after the registry step. A URL pinned to `$GITHUB_SHA` resolves the moment the extension is published; a tag URL 404s until the GitHub-release step runs. If base URLs are used, pass `$GITHUB_SHA` in CI and keep a local fallback.

- **Before publishing, check the built VSIX:**
  - unzip it and resolve every URL in `extension/readme.md` and `extension/changelog.md` (200 with an image content type for images)
  - run `vsce ls` to confirm no README media is packaged
  - count `<Tags>` in `extension.vsixmanifest`

  vsce checks none of the count, the URLs or the categories.

- **Verified publisher:** fix the publisher display name before applying for verification (changing it later revokes the badge), and apply no earlier than 2027-04-09, with a domain at least six months old.

## Not verified

- **What the Marketplace server enforces at publish**, which needs a publish:
  - whether it rejects `http:` or SVG images that vsce let through under `--no-rewrite-relative-links`
  - whether automatic tags count toward the 30
  - whether unknown categories are rejected or dropped
  - any length limit on `displayName` or `description`
  - any VSIX size limit

- **The Marketplace's HTML rules are inferred, not read.** They come from 80 live pages plus targeted ones on 2026-10-09; the sanitizer is not public and can change without notice. `poster` on `<video>`, `<audio>`, `<figure>`, `<abbr>` and `<dl>` were not seen in any sample.

- **The `badges` rendering is read from the page's script,** not seen on a live page with manifest badges.

- **The Extensions view behavior is read from VS Code 1.141.0's source,** not observed in a running VS Code. The muted-autoplay result comes from Chromium with VS Code's `user-gesture-required` policy, and the Marketplace autoplay results, direct visit and click-through from search, from Chromium with `document-user-activation-required`, which models Chrome's published rules. Chrome's Media Engagement Index, for frequent visitors, was not tested; nor were Safari and Firefox. Whether VS Code would autoplay an unmuted video after the click that opens the extension editor is not verified.

- **The list-row cut-off (37 to 38 characters) is computed** from CSS and Linux font metrics at the default 300 px sidebar. Other fonts and sidebar widths change it.

- **How keywords weigh in search ranking,** beyond the docs saying they help people find the extension.

- **Open VSX was read from `main` at `d86a6f0`;** open-vsx.org reports v1.2.0 and may differ.

- **Anthropic publishes no guideline aimed at third-party tools that launch the Claude Code CLI.** The Legal and compliance paragraph, which permits plain-text statements, and the Trademark Guidelines are the closest. Whether a `claude code` keyword counts as "plain text" use is a reading of that paragraph, not a stated rule.

- **No trademark search was done** for "Hero Synergy".

## Sources

vsce and the lab:

- vsce 4.0.0, local: `node_modules/.pnpm/@vscode+vsce@4.0.0_supports-color@8.1.1/node_modules/@vscode/vsce/out/package.js` (trusted hosts L186-L231, manifest processor L302-L432, tags L434-L534, README rewriting and checks L536-L738, manifest validation L1001-L1104, vsixmanifest L1156-L1226, `files` handling L1343-L1380, packaging warnings L1600-L1677), `out/validation.js`, `out/main.js` L104-L135, `out/util.js` L251-L360
- vsce upstream: <https://github.com/microsoft/vscode-vsce/blob/04811a94ac8d7cc4d2c2b61c568b065467d39025/src/package.ts>
- Lab: `vsce package --no-dependencies` on scratch extensions; `vsce ls`; `ffmpeg 7.1.5` for test media; Playwright 1.63 with Chromium 1243 for page rendering, autoplay, column widths and font metrics

VS Code 1.141.0 (`2a59476`):

- `src/vs/workbench/contrib/extensions/browser/extensionEditor.ts`, `extensionsList.ts`, `extensionsWidgets.ts`, `extensionsWorkbenchService.ts`, `media/extension.css`, `media/extensionsWidgets.css`, `media/extensionEditor.css`
- `src/vs/workbench/contrib/markdown/browser/markdownDocumentRenderer.ts`, `src/vs/base/browser/markdownRenderer.ts`, `src/vs/base/browser/domSanitize.ts`
- `src/vs/platform/extensions/common/extensions.ts`, `src/vs/workbench/services/extensions/common/extensionsRegistry.ts`, `src/vs/platform/extensionManagement/common/extensionGalleryService.ts`
- `src/vs/workbench/services/extensionManagement/common/extensionManagementService.ts`, `src/vs/platform/windows/electron-main/windows.ts`, `src/vs/workbench/contrib/webview/browser/webviewElement.ts`, `src/vs/workbench/contrib/webview/browser/pre/index.html`, `src/vs/workbench/browser/layout.ts`

Microsoft docs (`microsoft/vscode-docs` at `bd9fee5`) and pages:

- <https://code.visualstudio.com/api/references/extension-manifest>
- <https://code.visualstudio.com/api/working-with-extensions/publishing-extension>
- <https://code.visualstudio.com/api/extension-guides/webview>
- <https://code.visualstudio.com/docs/configure/extensions/extension-marketplace>
- <https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security>
- <https://code.visualstudio.com/brand>

Marketplace (all read on 2026-10-09):

- <https://marketplace.visualstudio.com/items?itemName=dbarjs.hero-synergy> and its search page
- `POST https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery` for `dbarjs.hero-synergy`, `anthropic.claude-code`, `GitHub.copilot-chat`, `eamodio.gitlens`, `ms-python.isort` and the 999 most-installed VS Code extensions
- `https://marketplace.visualstudio.com/_apis/public/gallery/categories`, `https://marketplace.visualstudio.com/vscode`
- Item pages compared: `vitest.explorer`, `yoavbls.pretty-ts-errors`, `Bito.Bito`, `yy0931.vscode-sqlite3-editor`, `donjayamanne.python-environment-manager`, `PKief.material-icon-theme`, `charliermarsh.ruff`, `asvetliakov.vscode-neovim`, `alefragnani.Bookmarks`, `redhat.vscode-yaml`, `ms-python.isort`, and 80 more chosen by HTML variety
- Page bundle `vss-bundle-view` at static version `M280_20261006.4` (video `controls`, `SUPPORT.md` lookup, badges)
- <https://github.com/microsoft/vscode-discussions/discussions/426>, <https://github.com/microsoft/vsmarketplace/issues/569>, <https://github.com/microsoft/vsmarketplace/issues/1541>

Open VSX (`eclipse-openvsx/openvsx` at `d86a6f0`):

- `webui/src/components/sanitized-markdown.tsx`, `webui/src/pages/extension-detail/extension-detail.tsx`, `webui/src/pages/extension-detail/extension-detail-overview.tsx`, `webui/yarn.lock`
- `server/src/main/java/org/eclipse/openvsx/ExtensionProcessor.java`, `server/src/main/java/org/eclipse/openvsx/ExtensionValidator.java`
- `cli/src/publish.ts`
- DOMPurify 3.4.16 `src/tags.ts` and `src/attrs.ts`; markdown-it-anchor 9.2.0 `dist/markdownItAnchor.js`
- <https://open-vsx.org/api/version>, <https://open-vsx.org/api/dbarjs/hero-synergy>

Other:

- MDN, image file types: <https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types>
- Anthropic: <https://www.anthropic.com/legal/trademark-guidelines>, <https://code.claude.com/docs/en/legal-and-compliance>, <https://code.claude.com/docs/en/agent-sdk/overview>
- GitHub raw hosting headers: `curl -D -` on `raw.githubusercontent.com` URLs for `.gif`, `.webp`, `.png` and `.mp4`
