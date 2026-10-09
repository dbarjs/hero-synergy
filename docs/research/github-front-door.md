# What do the GitHub repository page, its link preview and a profile pin accept?

Research for [#113 What do the GitHub repository page, its link preview and a profile pin accept?](https://github.com/dbarjs/hero-synergy/issues/113), on the map [#22 The front door: READMEs, Marketplace listing and repository cards](https://github.com/dbarjs/hero-synergy/issues/22), done on 2026-10-09.

**Sources read.** GitHub's documentation, read from the source files of [`github/docs`](https://github.com/github/docs) on `main`; GitHub's changelog and blog; GitHub's REST OpenAPI description ([`github/rest-api-description`][openapi], `main`) and an introspection of the GraphQL schema; `gh` 2.100.0 and its source ([`cli/cli`](https://github.com/cli/cli), `trunk`); [`github/explore`](https://github.com/github/explore) for curated topics; and the platforms' own documentation: X's Cards pages (no longer online, read from the Internet Archive's January 2026 copies), Slack, Discord, LinkedIn, Apple's TN3156, the Open Graph protocol and WebKit. Every claim links its source, or says **observed**: seen in a read-only response between 11:50 and 12:45 UTC. The observations were `gh api markdown` renders with this repository as context; signed-out fetches of github.com pages (this repository, `dbarjs`'s profile, other repositories and their READMEs, topic pages, repository search); the CSS and scripts those pages load; the Open Graph images GitHub serves; REST and GraphQL reads of this repository; and `ffprobe` on `/tmp/hero-synergy-30s.mp4`. Nothing was written to GitHub.

## Answer

**README.** GitHub keeps `<picture>` with `prefers-color-scheme` sources, `align`, `width` and `height`, `<details>` and `<kbd>`. It removes `<video>` whatever its source, along with `style`, `class`, `srcset` density lists and inline `<svg>`, and prints `<iframe>` and `<script>` as visible text. Mermaid renders, in the browser after the page loads. Images by relative path work in PNG, GIF, WebP and SVG; only GIFs get GitHub's pause button. Repository images have no size limit beyond Git's (a warning at 50 MiB, refusal at 100 MiB), and the README text is cut after 500 KiB.

**Video.** One route plays: a video uploaded to GitHub, its `https://github.com/user-attachments/assets/<uuid>` URL alone on a line. GitHub draws a bordered, foldable box titled with the uploaded file's name, around a `<video controls muted>` player with no autoplay, loop or poster. Sound stays off until the reader unmutes. A committed MP4 and a release asset only ever become links. Video uploads are capped at 10 MB when the repository's owner is on the free plan and 100 MB on a paid plan; the trailer is 24.5 MB.

**About.** The About box and the page title show the whole description. Repository search cuts it after 140 characters, a profile pin after 200, and the link preview's description after 200 including the appended " - dbarjs/hero-synergy". The website appears only in the About box. A repository takes up to 20 topics of lowercase letters, digits and hyphens, at most 50 characters each. Signed out, the home page draws Releases and Packages and no Deployments section. This repository has 10 deployments to `marketplace`, none with a URL.

**Link preview.** With no custom image, GitHub generates a 1200 × 600 PNG card (name, description, owner's avatar, live counts, language bar) and declares `summary_large_image`. A custom image must be a PNG, JPG or GIF under 1 MB; 1280 × 640 is recommended, and GitHub does not resize it. X takes 2:1 images from 300 × 157 to 4096 × 4096 under 5 MB, LinkedIn wants 1.91:1 and at least 1200 × 627, Apple at least 900 px wide, and Discord draws a large image under the text. None of them documents a crop.

**Pin.** Six pins at most, and `dbarjs/hero-synergy` is already the first of six. A card shows the name, "Public", the description up to 200 characters, the primary language, and stars and forks only when above zero.

**Who sets what.** `gh`, REST and GraphQL can set the description, the website and the topics. Only the browser sets the social preview, the profile pins and the home-page sections. A video upload goes through the browser or `gh … --attach` (gh 2.99 or later), which posts the body it uploads into.

## README

### What the sanitizer keeps

Observed with `gh api markdown -f mode=gfm -f context=dbarjs/hero-synergy` ([Render a Markdown document][rest-markdown]). For the video player, `<picture>` and relative images, the API's output matched the live repository pages of nvim-mini/mini.completion, microsoft/griffel and sindresorhus/awesome, apart from the path rewriting described below. GitHub only describes this step as "aggressively removing things that could harm you and your kin—such as `script` tags, inline-styles, and `class` or `id` attributes" ([github/markup][markup]); it publishes no list, so the table is the evidence.

| You write                                                                                                                                                                                                                             | GitHub renders                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<picture>` with `<source media="(prefers-color-scheme: dark)" srcset="…">`                                                                                                                                                           | Kept, wrapped in a `<themed-picture>` element. On `<source>`, `type`, `width` and `height` are kept, `sizes` is dropped, and `srcset` keeps only its first URL: a `2x` candidate is dropped. |
| `align` on `<p>`, `<div>`, `<h1>` to `<h6>`, `<img>`, `<th>`                                                                                                                                                                          | Kept. GitHub's CSS pads an image aligned left or right by 20 px on the side facing the text.                                                                                                 |
| `width` and `height` on `<img>`, also in percent                                                                                                                                                                                      | Kept. GitHub adds `max-width: 100%`, and with `height` also `height: auto; max-height: <height>px`.                                                                                          |
| `srcset`, `loading`, `decoding`, `style`, `class`                                                                                                                                                                                     | Removed. `id` and `<a name>` are kept with a `user-content-` prefix.                                                                                                                         |
| `<details>`, `<details open>`, `<summary>`                                                                                                                                                                                            | Kept; Markdown inside works after a blank line ([Collapsed sections][details]).                                                                                                              |
| `<kbd>`, `<sup>`, `<sub>`, `<ins>`, `<del>`, `<s>`, `<mark>`, `<q>`, `<var>`, `<samp>`, `<tt>`, `<ruby>`, `<b>`, `<i>`, `<em>`, `<strong>`, `<dl>`, `<blockquote>`, `<br>`, `<hr>`, tables with `align`, `width`, `valign`, `colspan` | Kept.                                                                                                                                                                                        |
| `<abbr>`, `<small>`, `<big>`, `<center>`, `<font>`, `<u>`, `<cite>`, `<time>`, `<bdo>`, `<figure>`, `<figcaption>`, `<caption>`                                                                                                       | Tag removed, text kept.                                                                                                                                                                      |
| `<video>` with a raw URL, a relative path, a `<source>` child or a `user-attachments` URL; `<audio>`; inline `<svg>`; `<object>`; `<embed>`; `<input>`                                                                                | Removed with their content.                                                                                                                                                                  |
| `<iframe>`, `<script>`                                                                                                                                                                                                                | Printed as literal text: GFM's tagfilter turns their `<` into `&lt;` ([GFM spec][gfm-tagfilter]).                                                                                            |
| `<a target="_blank">`                                                                                                                                                                                                                 | `target` removed; links to other sites get `rel="nofollow"`.                                                                                                                                 |
| An image outside `<picture>`                                                                                                                                                                                                          | Wrapped in a link to the image file.                                                                                                                                                         |

Two layout traps, both observed:

- `<a href="…"><picture>` on one line at the start of a paragraph tears the picture apart: the `<source>` elements land outside it. Give `<picture>` and its children their own lines inside a block element such as `<p align="center">`; a link around the picture works there.
- `![alt](https://github.com/user-attachments/assets/<uuid>)` pointing at a video renders an `<img>` of the MP4, not a player.

Alerts (`> [!NOTE]`) and footnotes are rendered on the server; math is wrapped in a `<math-renderer>` element for the browser (observed).

### Light and dark images

`<picture>` with `prefers-color-scheme` sources is GitHub's documented way to show one image in light mode and another in dark mode, with the `<img>` as the fallback ([Quickstart for writing on GitHub][quickstart], [changelog, 2022-08-15][cl-picture]). The `<themed-picture>` wrapper is a GitHub script ([observed chunk][themed-picture-js]) that reads the page's `data-color-mode`:

- `auto`, which every signed-out visitor gets (observed on the page's `<html>`): the `media` queries stay as written, so the operating system decides. A signed-in theme that "follows your system settings" ([Managing your theme settings][theme]) presumably sets the same; not observed.
- `light` or `dark`, a signed-in user's chosen GitHub theme: the script makes the matching `<source>` always apply and sets the other's `media` to `not all`, so the picture follows GitHub's theme rather than the operating system's.
- It recognises only the exact strings `(prefers-color-scheme: light)` and `(prefers-color-scheme: dark)`, with one space after the colon.

The older `#gh-dark-mode-only` and `#gh-light-mode-only` URL fragments ([changelog, 2022-05-19][cl-fragment]) still work on github.com: GitHub's global stylesheet hides the link around such an image by matching its `href` (observed). They depend on that stylesheet, so every other Markdown renderer shows both images.

The README sits on the page background, and images get none of their own: GitHub's CSS gives `.markdown-body img` only `box-sizing: content-box; max-width: 100%` (observed). The backgrounds are the `--bgColor-default` token of the theme stylesheets the repository page loads (observed); the contrast ratios are computed with the WCAG formula.

| Theme              | Background | Against the Seal's Midnight `#0F0B30` | Against its Indigo `#30258C` |
| ------------------ | ---------- | ------------------------------------- | ---------------------------- |
| Light              | `#ffffff`  | 18.9 : 1                              | 11.9 : 1                     |
| Dark               | `#0d1117`  | 1.0 : 1                               | 1.6 : 1                      |
| Dark dimmed        | `#212830`  | 1.3 : 1                               | 1.3 : 1                      |
| Dark high contrast | `#010409`  | 1.1 : 1                               | 1.7 : 1                      |

On the light theme the Seal reads as a dark rounded tile. On the dark themes the tile's Midnight corner melts into the page, and the lavender ring and the gold needle carry the mark.

### Images by relative path

On the repository page GitHub rewrites a relative `src` or `srcset` to `/<owner>/<repo>/raw/<branch>/<path>` and links the image to its `/blob/` page (observed on sindresorhus/awesome and microsoft/griffel). Relative links follow the branch being viewed ([About READMEs][readmes]). `raw.githubusercontent.com` serves `.svg` as `image/svg+xml` and `.webp` as `image/webp`, under `Content-Security-Policy: default-src 'none'; sandbox`, with a 5-minute cache (observed).

| Format        | Behaviour                                                                                                                                                                                                                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PNG, JPEG     | A plain `<img>`.                                                                                                                                                                                                                                                                                                                                                                      |
| GIF           | Marked `data-animated-image`, which GitHub's script wraps in an `<animated-image>` player with play and pause (observed). Autoplay follows each reader's "Autoplay animated images" setting, by default synced with the system's reduced-motion preference ([Managing accessibility settings][a11y], [changelog, 2022-05-19][cl-anim]); signed-out pages use the system's (observed). |
| Animated WebP | A plain `<img>`, not marked (observed), so it always plays and has no pause button.                                                                                                                                                                                                                                                                                                   |
| SVG           | Shown through `<img>`, so it runs no script and loads no external font or image. `packages/vscode/media/icon.svg` is only paths and gradients and renders whole.                                                                                                                                                                                                                      |

Size limits: none specific to images in a repository. Git warns above 50 MiB, GitHub refuses files above 100 MiB, and a file added in the browser can be at most 25 MiB ([About large files on GitHub][large]). The README text is cut after 500 KiB ([About READMEs][readmes]). An image uploaded as an attachment is capped at 10 MB ([Attaching files][attach]).

GitHub shows the first README it finds in `.github/`, then at the root, then in `docs/` ([About READMEs][readmes]). This repository has only the root `README.md`.

### Mermaid

A `mermaid` code fence renders on GitHub ([Creating diagrams][diagrams]). The server sends a placeholder: a `<section data-type="mermaid">` holding the source in a hidden `<pre>` and a spinner (observed). In the browser, GitHub injects an iframe from `viewscreen.githubusercontent.com` that runs Mermaid.js ([GitHub blog, 2022-02-14][blog-mermaid]), and the page's CSP allows that frame host (observed). The diagram therefore exists only where GitHub's scripts run: not in the API's HTML and not in other renderers.

## Video

### Every route

| Route                                                                                                     | In the repository README                         | Evidence                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A video uploaded to GitHub, its `https://github.com/user-attachments/assets/<uuid>` URL alone on its line | Plays                                            | Observed on nvim-mini/mini.completion's README and through the Markdown API, also with an asset uploaded in another repository and with the line inside `<div align="center">` or `<details>`. "The reference must be the only content in its paragraph" ([Attaching files with GitHub CLI][attach-cli]). |
| The same URL inside a sentence                                                                            | A link                                           | Observed; the same doc says so.                                                                                                                                                                                                                                                                           |
| The same URL in image syntax `![](…)`                                                                     | An `<img>` of the MP4, no player                 | Observed.                                                                                                                                                                                                                                                                                                 |
| A `<video>` tag                                                                                           | Removed                                          | Observed with four variants.                                                                                                                                                                                                                                                                              |
| A committed `.mp4`, by relative path, raw URL or `/blob/` page                                            | A link; the `/blob/` page offers only "View raw" | Observed: `raw.githubusercontent.com` serves MP4 as `application/octet-stream` with `nosniff`, and a 2.0 MB MP4's blob page says "we can't show files that are this big right now".                                                                                                                       |
| A release asset                                                                                           | A link that downloads                            | Observed. Each release asset must be under 2 GiB, up to 1,000 per release ([About releases][releases]).                                                                                                                                                                                                   |
| A video hosted elsewhere                                                                                  | Not supported                                    | "GitHub does not support externally hosted videos" ([About anonymized URLs][anon]).                                                                                                                                                                                                                       |

The repository page's `Content-Security-Policy` allows media only from `github.com`, `user-images`, `secured-user-images` and `private-user-images.githubusercontent.com`, GitHub's user-asset bucket, `gist.github.com` and `github.githubassets.com` (observed). Nothing but an uploaded asset can play there, even in principle.

### What GitHub draws

Observed markup for an uploaded video, the mini.completion demo:

- A `<details open>` box with a border. Its `<summary>` shows a camera icon and the uploaded file's name, `demo-completion.mp4`, and folds the box.
- Inside, a `<video controls muted>` no wider than the column (Primer's `width-fit`, `max-width: 100%`) and between 200 and 640 px tall (`max-height: 640px; min-height: 200px`), without `autoplay`, `loop`, `poster` or `playsinline`.
- Its `src` is a signed `private-user-images.githubusercontent.com/…/<id>-<uuid>.mp4?jwt=…` URL valid for 300 seconds: the token's `exp` minus `nbf`, and `X-Amz-Expires=300`. One such URL served the file at 11:58 and answered 404 at about 12:28; every page load mints a new one.
- Signed out, the page carries the player, and its signed URL answered `206 Partial Content` with `video/mp4` and byte ranges (observed). "For public repositories, uploaded files can be accessed without authentication" ([Attaching files][attach]). A signed-out request for the bare `user-attachments/assets/<uuid>` URL itself answered 404 (observed), so the README is what to share, not the asset link.

### Upload limits

| What                                                        | Limit                                                                          | Source                                                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Video, in a repository owned by an account on the free plan | 10 MB                                                                          | [Attaching files][attach]                                                                                                |
| Video, in a repository owned by an account on a paid plan   | 100 MB                                                                         | [Attaching files][attach]; `gh` itself checks 100 MiB and leaves the plan to the server ([`userasset.go`][gh-userasset]) |
| Images and GIFs                                             | 10 MB                                                                          | [Attaching files][attach]; `gh` checks 10 MiB                                                                            |
| Video formats                                               | `.mp4`, `.mov`, `.webm`, with H.264 recommended for the widest browser support | [Attaching files][attach]                                                                                                |
| Length                                                      | None documented                                                                | [Attaching files][attach], [changelog, 2026-09-01][cl-attach]                                                            |

The limit follows the plan of the account that owns the repository, here `dbarjs`. This session cannot see that plan: the token has no `user` scope, and `gh api user` returns `"plan": null` (observed).

### Sound, mobile and the app

- **Sound.** The player starts muted and never autoplays, so the trailer is silent until the reader presses play and unmutes (observed `controls` and `muted`). None of the 123 scripts the repository page loads sets `muted` or `autoplay`, apart from React's own DOM code (observed).
- **Mobile browsers** get the same HTML. Without `playsinline`, WebKit plays a `<video>` fullscreen on iPhone ([WebKit, 2016-07-25][webkit]). Android was not tested.
- **GitHub Mobile.** Videos can be uploaded from the iOS and Android apps ([changelog, 2021-05-13][cl-video]), and on iOS a tapped github.com link opens in the app when it is installed ([GitHub Mobile][mobile]). Whether the app's README view plays the video was not observed.

### An upload that is never posted

GitHub says the file "is uploaded immediately to GitHub and the text field is updated to show the anonymized URL" ([Attaching files][attach]). `gh` likewise uploads to `https://uploads.github.com/user-attachments/assets` before it posts anything ([`client.go`][gh-client], [`host.go`][gh-host]). No GitHub source says how long an asset that nobody posts is kept, and testing it means uploading, so it is not verified. Posting the upload, as [#120 Upload the trailer and the card, fill in the About box, pin the repository](https://github.com/dbarjs/hero-synergy/issues/120) plans, sidesteps the question.

### The trailer against these limits

`ffprobe` on `/tmp/hero-synergy-30s.mp4` (observed): H.264 High, yuv420p, 1920 × 1080, 60 fps, 6.32 Mb/s; AAC-LC stereo, 48 kHz, 200 kb/s; 30.000 s; 24,510,960 bytes. Its `moov` box precedes `mdat`, so playback starts before the download ends. That is 2.45 times the free plan's 10 MB. Fitting 10,000,000 bytes, the safe reading of "10MB", into 30 seconds leaves 2.67 Mb/s for everything: with 128 kb/s of audio and a few percent of container overhead, about 2.4 Mb/s of video. On a paid plan the current file fits as it is.

## About

### Description

GitHub documents no length limit. Third-party clients quote the API's refusal as "description is too long (maximum is 350 characters)" ([corvene's test fixture][lead-corvene], [better-gh's settings form][lead-better-gh]); testing it means writing, so it is not verified. The longest description observed has 328 characters (x1xhlol/system-prompts-and-models-of-ai-tools).

Where it appears, with this repository's name in the strings:

| Place                                                   | What appears                                           | Cut                                                                                                                     | Evidence                                                                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| About box                                               | The description                                        | None: 328 characters shown whole                                                                                        | Observed                                                                                                                        |
| Page `<title>`, so the browser tab and search engines   | `GitHub - dbarjs/hero-synergy: <description> · GitHub` | None by GitHub                                                                                                          | Observed                                                                                                                        |
| `og:title`, `twitter:title`                             | `GitHub - dbarjs/hero-synergy: <description>`          | None by GitHub. X shows at most 70 characters ([X markup][x-markup]); Discord 70 bytes and 3 lines ([Discord][discord]) | Observed                                                                                                                        |
| `og:description`, `twitter:description`, `og:image:alt` | `<description> - dbarjs/hero-synergy`                  | 200 characters, ending in `...`                                                                                         | Observed: a 328-character description became its first 197 characters and `...`                                                 |
| `<meta name="description">`                             | `<description> - dbarjs/hero-synergy`                  | None                                                                                                                    | Observed                                                                                                                        |
| Generated social card                                   | Under the name                                         | About four lines: 155 characters fitted under a name wrapped onto two lines                                             | Observed                                                                                                                        |
| Repository search results                               | The description                                        | Up to 140 characters whole; a longer one becomes its first 137 and `…`                                                  | Observed on five repositories: 140 whole; 141, 213, 223 and 328 cut                                                             |
| Profile pin                                             | The description                                        | Up to 200 characters whole; a longer one becomes its first 197 and `…`                                                  | Observed on three profiles. Identical to GraphQL `shortDescriptionHTML`, whose `limit` defaults to 200 ([Repository][gql-repo]) |

With no description, as today, the title is `GitHub - dbarjs/hero-synergy · GitHub` and the descriptions read "Contribute to dbarjs/hero-synergy development by creating an account on GitHub." (observed).

A plain repository search matches the name, the description and the topics; the README only with `in:readme` ([Searching for repositories][search]).

### Website

The website appears only in the About box: a bold link that hides the scheme, opens a new tab and carries `rel="noopener noreferrer nofollow"` (observed on mattpocock/ts-reset). It is not on the pin, in search results, on the generated card or in the link preview (observed).

### Topics

- **Rules.** At most 20 per repository, each made of lowercase letters, numbers and hyphens, 50 characters or fewer ([Classifying your repository with topics][topics]). REST saves names in lowercase ([Replace all repository topics][rest-topics]); GraphQL's `updateTopics` answers with `invalidTopicNames` (introspection).
- **Suggestions.** GitHub suggests topics for public repositories, and an admin accepts or declines them ([topics][topics]; mutations `acceptTopicSuggestion` and `declineTopicSuggestion`).
- **Topic pages.** `github.com/topics/<name>` lists every public repository with the topic, by default with the most stars first; fewest stars, most or fewest forks, and recently or least recently updated are the other orders (observed on `vscode-extension`). A curated topic, kept in [`github/explore`](https://github.com/github/explore), adds a display name, a description, related topics, aliases and followers ([explore API doc][explore-api]). An alias page carries its curated topic's description and follower count but lists only the repositories tagged with the alias: `vscode` shows `visual-studio-code`'s description and 5.5k followers over 22,756 repositories, while `visual-studio-code` lists 4,956 (observed). `topic:<name>` finds them in search ([Searching for repositories][search]).
- **Where they show.** In the About box and in search results; not on the pin or in the link preview (observed).

Counts on 2026-10-09, signed out (observed). "Curated" means a file exists in `github/explore/topics/`.

| Topic                | Public repositories | Curated                                                               |
| -------------------- | ------------------- | --------------------------------------------------------------------- |
| `typescript`         | 474,252             | Yes                                                                   |
| `ai-agents`          | 111,179             | No                                                                    |
| `claude-code`        | 88,161              | Yes; aliases `claude-cli`, `anthropic-claude-code`, `claude-code-cli` |
| `developer-tools`    | 77,562              | No                                                                    |
| `claude`             | 57,874              | Yes                                                                   |
| `terminal`           | 32,263              | Yes                                                                   |
| `agent-skills`       | 30,568              | Yes; aliases `agent-skill`, `ai-agent-skills`                         |
| `anthropic`          | 25,997              | No                                                                    |
| `vscode`             | 22,756              | Alias of `visual-studio-code` (4,956)                                 |
| `vscode-extension`   | 15,757              | Yes                                                                   |
| `claude-code-skills` | 2,085               | No                                                                    |
| `github-issues`      | 751                 | No                                                                    |
| `wayfinder`          | 28                  | No                                                                    |
| `mattpocock`         | 7                   | No                                                                    |

### "Include in the home page"

GitHub's documentation does not describe these checkboxes (the `github/docs` source was searched), and neither REST ([Update a repository][rest-update]) nor GraphQL (`UpdateRepositoryInput`, `Repository`) has a field for them: the OpenAPI description and the introspected schema were searched. What the signed-out page draws is decided in its payload, `sidebarAbout.sections` (observed):

```json
{
  "releases": { "releaseCount": 3, "tagCount": 3 },
  "sponsors": false,
  "deployments": false,
  "packages": true,
  "usedBy": false,
  "contributors": true,
  "languages": true,
  "cta": false,
  "suggestedWorkflows": false
}
```

- **Releases** are drawn: three releases, `v0.1.0` to `v0.1.2`, each with its VSIX (REST, observed).
- **Packages** are drawn, although nothing is published to GitHub Packages.
- **Deployments** are not drawn for a signed-out visitor. The flag was `false` on all 15 public repositories checked, this one included, among them repositories with environments such as github/explore (`github-pages`), so anonymous visitors appear never to get the section. What a signed-in visitor sees was not observed; GitHub's docs put "Deployments" in "the right-hand sidebar of the home page of your repository" ([Viewing deployment history][deploy-history]).

### The `marketplace` environment today

Observed through REST and GraphQL:

- 10 deployments, all to `marketplace`, created by GitHub Actions between 2026-10-07 21:22 and 2026-10-09 11:58 UTC: seven from `main`, two from `temp/marketplace-identity` and one from `temp/verify-marketplace`.
- The latest is `ACTIVE`, with status `success` and a log URL. `environment_url` is empty on every status read, so nothing links to the Marketplace. `production_environment` is false; the environment has no protection rules and is not pinned.
- The cause: `.github/workflows/release.yml` and `backfill.yml` name the environment, `environment: marketplace`, and nothing more. The job syntax also takes `url`, which becomes the deployment's `environment_url` ([workflow syntax][env-syntax]), and `deployment: false`, which keeps the environment's secrets and variables but creates no deployment ([Using environments without deployments][no-deploy]).

## Link preview

### What GitHub sends

Observed on this repository's page today, with no description and no custom image:

```html
<title>GitHub - dbarjs/hero-synergy · GitHub</title>
<meta
  name="description"
  content="Contribute to dbarjs/hero-synergy development by creating an account on GitHub."
/>
<meta name="twitter:card" content="summary_large_image" />
<meta property="og:title" content="GitHub - dbarjs/hero-synergy" />
<meta property="og:image" content="https://opengraph.githubassets.com/<hash>/dbarjs/hero-synergy" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="600" />
```

The matching `twitter:*` tags, `og:url`, `og:site_name` "GitHub" and `og:type` "object" come with them. With a description and a custom image (mattpocock/ts-reset), the title becomes `GitHub - <owner>/<repo>: <description>`, the descriptions `<description> - <owner>/<repo>`, `og:image` points at `repository-images.githubusercontent.com/<repository id>/<uuid>`, and the width and height tags disappear (observed).

**When no image is set**, GitHub generates the card: "Until you add an image, repository links expand to show basic information about the repository and the owner's avatar" ([Customizing your repository's social media preview][social]; the generator is described in the [GitHub blog, 2021-06-22][blog-og]). Today's card for this repository is a 1200 × 600 PNG of 105,655 bytes (observed). It shows `dbarjs/hero-synergy` in large type wrapped onto two lines, the owner's avatar at the top right, "3 Contributors, 14 Issues, 0 Stars, 0 Forks", the GitHub mark, and the language bar (TypeScript, Vue, JavaScript) as a 24 px strip along the bottom. A description, once set, prints under the name. All content sits inside x 80–1119 and y 80–523: GitHub's own margin is 80 px. The counts are live; the third contributor is a commit email not linked to any account (REST `contributors?anon=1`).

### A custom social preview

- **Format.** PNG, JPG or GIF, under 1 MB; at least 640 × 320, and 1280 × 640 "for best display" ([social preview][social]).
- **Transparency.** Transparent PNGs are accepted, but they meet unknown backgrounds, and GitHub recommends a solid one when unsure ([social preview][social]).
- **No resizing.** GitHub does not normalise the file: ts-reset's is served at 1200 × 628 and Biome's at 1920 × 1080, both PNG, from `repository-images.githubusercontent.com`, ts-reset's with a 30-day cache header (observed).
- **No safe area.** GitHub documents no template and no safe area; the Settings page itself was not observed.
- **Repository.** An image can be uploaded to a public repository, or to a private one that had an image before, and "can only be shared from a public repository" ([social preview][social]).

### How each platform shows it

| Platform | Reads                                                                                | Image rules                                                                                                                 | Layout and crop                                                                                                | Text                                                                                                    | Cache                                                            |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| X        | `twitter:*`, falling back to `og:*`                                                  | 2:1; 300 × 157 to 4096 × 4096; under 5 MB; JPG, PNG, WEBP, GIF (first frame only); no SVG; alt text up to 420 characters    | `summary_large_image`: a full-width image                                                                      | Title up to 70 characters, description up to 200                                                        | Not documented                                                   |
| Slack    | oEmbed, X Card and Open Graph tags, fetching as little as it can with Range requests | Not documented                                                                                                              | Not documented                                                                                                 | Readers can turn image and text previews off; "if more than five links are included, they won't expand" | About 30 minutes                                                 |
| Discord  | Open Graph, X Card and oEmbed tags; the first non-empty title and description win    | PNG, GIF, JPG, WEBP, AVIF; measures the image unless `og:image:width` and `og:image:height` are given                       | `summary_large_image`: a large image under the text; otherwise a small one                                     | Title 70 bytes and 3 lines, description 350 bytes and 20 lines, trimmed beyond                          | About 30 minutes; an Embed Debugger exists                       |
| LinkedIn | `og:title`, `og:image`, `og:description`, `og:url`                                   | At least 1200 × 627; 1.91:1 recommended; up to 5 MB; JPG, PNG, GIF up to 300 frames; under 401 px wide shows as a thumbnail | Said of ads: "Square and vertical images might be cropped"                                                     | Not documented                                                                                          | Post Inspector refreshes it; existing posts keep the old preview |
| iMessage | `og:title`, `og:image`, icons, `og:video`                                            | At least 900 px wide; under 150 px may be ignored or shown as an icon; the page up to 1 MB, all its resources up to 10 MB   | Images "may be displayed at varying sizes depending on context and device"; Apple advises against text in them | The title from `og:title`                                                                               | Not documented                                                   |

Sources by row: [X card][x-card] and [X markup][x-markup], both archived, since X's live docs no longer have a Cards section (observed: the old URLs redirect to `docs.x.com/overview`); [Slackbot][slack-robots], [Slack unfurling][slack-unfurl] and [Slack help][slack-help]; [Discord][discord]; [LinkedIn][linkedin] and [LinkedIn Post Inspector][linkedin-inspector]; [Apple TN3156][apple]. The [Open Graph protocol][ogp] itself sets no size, ratio or crop.

For a 1280 × 640 card that means X's 2:1 needs no crop; a 1.91:1 frame keeps the central 1222 × 640 and trims 29 px from each side; a square crop, should any client make one, keeps the central 640 × 640. This is arithmetic on the documented ratios, not a documented safe area.

## Pin

- **How many.** Up to six repositories and gists combined, chosen under "Customize your pins" and reordered by dragging a pin's grabber ([Pinning items to your profile][pin]). Pins replace the "Popular repositories" section, and a public repository can be pinned by its owner or by anyone who contributed to it in the last year ([profile reference][profile-ref]).
- **Order and layout.** The owner's order: GraphQL `pinnedItems` and the profile agree (observed). The cards sit in one column below 768 px and two from 768 px up (Primer's `col-md-6` in GitHub's CSS, observed), so six pins make three rows of two on a desktop, read left to right.
- **What a card shows** (observed on `github.com/dbarjs`): a repository icon; the name in bold, with an `owner/` prefix only for someone else's repository such as `noibe/villa`; a "Public" label; the description; the primary language with its colour; and stars and forks with their counts, each only when above zero. No topics, no website, no image.
- **Description cut.** Up to 200 characters show whole; a longer description becomes its first 197 characters and `…` (observed on the profiles of `Brooooooklyn`, `msitarzewski` and `x1xhlol`). The text equals GraphQL's `shortDescriptionHTML` at its default limit of 200 (observed on descriptions of 200 characters, kept whole, and 205, cut).
- **Today.** `dbarjs/hero-synergy` is pinned, the first of six, and `pinnedItemsRemaining` is 0 (GraphQL, observed). Its card shows the name, "Public" and "TypeScript" over an empty description line.

## Who sets what

| Field                                               | Browser                                                                                                                                          | `gh`                                                                                                                                                                                                                                                                                 | REST                                                                                                                          | GraphQL                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| README content                                      | Edit the file                                                                                                                                    | `git push`, or `gh api` on the contents endpoint                                                                                                                                                                                                                                     | Create or update file contents                                                                                                | `createCommitOnBranch`                                                          |
| Video or image upload                               | Drag it into an issue, pull request or comment box, or into a `.md` file being edited ([basic syntax][basic], [changelog, 2021-05-13][cl-video]) | `--attach` on `gh issue create`, `gh issue edit`, `gh issue comment`, `gh pr create`, `gh pr edit` and `gh pr comment`: gh 2.99 or later, write access, up to 50 files; it posts the body it uploads into ([Attaching files with GitHub CLI][attach-cli], `gh issue comment --help`) | None documented: the OpenAPI description has no such endpoint, and `gh` posts to `uploads.github.com/user-attachments/assets` | None                                                                            |
| Description                                         | About ⚙                                                                                                                                          | `gh repo edit --description`                                                                                                                                                                                                                                                         | `PATCH /repos/{owner}/{repo}`, `description`                                                                                  | `updateRepository`, `description`                                               |
| Website                                             | About ⚙                                                                                                                                          | `gh repo edit --homepage`                                                                                                                                                                                                                                                            | `PATCH /repos/{owner}/{repo}`, `homepage`                                                                                     | `updateRepository`, `homepageUrl`                                               |
| Topics                                              | About ⚙                                                                                                                                          | `gh repo edit --add-topic`, `--remove-topic`                                                                                                                                                                                                                                         | `PUT /repos/{owner}/{repo}/topics`, `names`                                                                                   | `updateTopics`, `topicNames`; `acceptTopicSuggestion`, `declineTopicSuggestion` |
| Home-page sections: Releases, Packages, Deployments | Only here                                                                                                                                        | No                                                                                                                                                                                                                                                                                   | No field                                                                                                                      | No field                                                                        |
| Social preview image                                | Settings → General → Social preview                                                                                                              | No                                                                                                                                                                                                                                                                                   | No endpoint                                                                                                                   | No mutation; `openGraphImageUrl` and `usesCustomOpenGraphImage` to read         |
| Profile pins and their order                        | Profile → Customize your pins                                                                                                                    | No                                                                                                                                                                                                                                                                                   | No endpoint                                                                                                                   | No mutation; `pinnedItems`, `pinnedItemsRemaining` and `itemShowcase` to read   |
| Deployment link, `environment_url`                  | No                                                                                                                                               | Through the workflow's `environment.url`                                                                                                                                                                                                                                             | `POST /repos/{owner}/{repo}/deployments/{deployment_id}/statuses`, `environment_url`                                          | Not checked                                                                     |
| Pinned environments, the deployments page's order   | The pin on the deployments page, up to ten                                                                                                       | No                                                                                                                                                                                                                                                                                   | No endpoint                                                                                                                   | `pinEnvironment`, `reorderEnvironment`                                          |

Evidence: the About ⚙ dialog in [Classifying your repository with topics][topics]; the Social preview settings in [Customizing your repository's social media preview][social]; `gh repo edit --help` (gh 2.100.0, observed); [Update a repository][rest-update]; [Replace all repository topics][rest-topics]; [Create a deployment status][rest-status]; [Viewing deployment history][deploy-history]; [GraphQL mutations][gql-mutations], introspected: no mutation sets a social image, a profile pin or a home-page section, and the only `pin…` mutations are `pinIssue`, `pinIssueComment` and `pinEnvironment`; and the REST OpenAPI description, searched for social, Open Graph, pin, upload and attachment endpoints.

## Recommendations for this repo

### For [#117 What does Hero Synergy say about itself?](https://github.com/dbarjs/hero-synergy/issues/117)

- **Length.** Keep the one line to 140 characters or fewer. It then shows whole in search, on the pin, on the generated card and in the link preview's description, which keeps its " - dbarjs/hero-synergy" suffix up to 178 characters. The hard ceiling is probably 350. The manifest's current line has 127 characters.
- **The first 40 characters.** A link preview's title reads `GitHub - dbarjs/hero-synergy: <one line>`; the prefix takes 30 characters, and X and Discord stop at 70. The meaning has to arrive before that.
- **Website.** The Marketplace listing, `https://marketplace.visualstudio.com/items?itemName=dbarjs.hero-synergy`, is the page a reader needs next, and the About box is the only place the field appears.
- **Topics.** Up to 20. A new repository sorts last on a large topic page, where the most-starred come first, so it is found through small exact topics and `topic:` searches. Pairing the curated topics that name the platform (`vscode-extension`, `claude-code`, `agent-skills`) with small exact ones (`wayfinder` with 28 repositories, `github-issues` with 751, `claude-code-skills` with 2,085) covers both. The counts are in the Topics table above.
- **Search words.** Plain search reads only the name, the description and the topics, so the words people search with belong in those three.

### For [#118 Cut the trailer for the web](https://github.com/dbarjs/hero-synergy/issues/118)

- **README MP4.** Unless Eduardo confirms a paid plan, make it at most 10,000,000 bytes: about 2.4 Mb/s of H.264 video and 128 kb/s of AAC for 30 seconds, keeping `+faststart`. At 60 fps those bits spread over twice the frames that 30 fps would give them. On a paid plan the current 24.5 MB file already fits under 100 MB.
- **File name.** The uploaded name becomes the title bar of the player, so name the file for readers, for example `hero-synergy-trailer.mp4`.
- **Silent first.** The player starts muted, does not autoplay and takes no poster, so every beat must read without sound and the first frame should work as a still.
- **Poster.** GitHub's player cannot use one; it serves the listing and any link to the video.
- **Cards.** 1280 × 640, PNG or JPG under 1,000,000 bytes, on an opaque Midnight background. Keep the words and the Seal inside an 85 px margin, GitHub's own 80 px at 1200 scaled up, which also covers LinkedIn's 1.91:1 trim. Keep the Seal centred in case a client crops square, and the text to a few large words.
- **Banner.** `srcset` density lists are stripped, so export at twice the display size and set the `<img>` `width` to half the file's pixel width.
- **Loops.** A GIF gets GitHub's pause button and respects reduced motion; an animated WebP plays with no control; an MP4 plays only as an uploaded asset, muted, with controls, and without looping.

### For [#119 Prototype the two READMEs and the social card](https://github.com/dbarjs/hero-synergy/issues/119)

- **Trailer.** Embed it as the bare `user-attachments` URL alone in its paragraph. It may sit inside `<div align="center">` or `<details>`; never in a sentence, in `![]()` or in `<video>`.
- **Pictures.** `<picture>` needs the exact `(prefers-color-scheme: dark)` string and its own lines inside a block element. A link around it works inside `<p align="center">`.
- **Dropped markup.** Avoid `style`, `class`, `srcset` lists, inline `<svg>`, `<figure>`, `<small>` and `<center>`, which disappear, and `<iframe>`, which prints as text.
- **The Seal on both themes.** It reads at 18.9:1 on the light theme and fades into GitHub's dark background at 1.0:1, leaving the ring and the needle. `docs/brand.md` forbids recolouring, so a dark-theme variant would be a brand decision; the same file on both themes stays within the rules.
- **Diagram.** Mermaid suits the repository README's "how it works" diagram on GitHub, where it renders client-side.
- **Card.** Without a chosen card, a shared link unfolds into the generated one, with "0 Stars", "0 Forks" and the owner's avatar.
- **Checking drafts.** Look at the branch's GitHub page. The Markdown API shows the sanitizer's verdict, but it neither rewrites relative paths nor runs the scripts that draw Mermaid, GIF players and themed pictures.

### For [#120 Upload the trailer and the card, fill in the About box, pin the repository](https://github.com/dbarjs/hero-synergy/issues/120)

- **Trailer.** Posting it in a comment on #120 works. The session can do it instead with `gh issue comment 120 --repo dbarjs/hero-synergy --attach <file>` (gh 2.100.0 is installed; it needs write access and posts the comment). Afterwards, `gh api markdown -f mode=gfm -f text='<the asset URL>'` should answer with a `<video`.
- **Card.** Settings → General → Social preview. Afterwards GraphQL shows `usesCustomOpenGraphImage: true` and an `openGraphImageUrl` on `repository-images.githubusercontent.com`.
- **About.** The session can run `gh repo edit dbarjs/hero-synergy --description "…" --homepage "…" --add-topic …` and check with `gh api repos/dbarjs/hero-synergy --jq '{description, homepage, topics}'`.
- **Home page.** Releases on: it shows `v0.1.2` and its VSIX. Packages off: nothing is published there. Deployments off: it lists 10 `marketplace` deployments, three of them from temporary branches, with no link, and the website field links the Marketplace better. To keep it instead, give both workflows `environment: { name: marketplace, url: https://marketplace.visualstudio.com/items?itemName=dbarjs.hero-synergy }`; the name the Entra ID credential trusts stays the same. Leave `deployment: false` alone until its effect on the OIDC token is checked.
- **Pin.** Already done: `hero-synergy` is the first of six pins. Its card lacks only the description, which step 3 brings.
- **Browser checks this research could not make.** Where the "Include in the home page" boxes are (the About ⚙ dialog or Settings → General) and how they are set; the Deployments section signed in; pressing play more than five minutes after the page loaded; the trailer on an iPhone (it should go fullscreen), on Android and in GitHub Mobile; and the card in Slack, Discord, LinkedIn's Post Inspector and X.

## Not verified

- The 350-character description limit: only third parties quote the API's error.
- Whether an uploaded file that is never posted is kept, and for how long.
- Whether "10MB" and "100MB" mean 10,000,000 and 100,000,000 bytes or the binary MiB that `gh` uses for its own checks, and which plan `dbarjs` is on.
- Any length limit for uploaded videos; none is documented.
- Whether GitHub refreshes the five-minute signed video URL on a page left open; playback in GitHub Mobile and on Android; fullscreen playback on a current iPhone.
- What a signed-in visitor sees under Deployments, and where the "Include in the home page" checkboxes are and how they default.
- How Slack, Discord and iMessage scale or crop a 2:1 image; how long X caches a card; whether X still shows a card's title and description. Reports since August 2023 say X shows only the image and the domain; no X documentation was found.
- Any GitHub template or safe area for the social preview.
- A length limit for the website field.
- The Mermaid version GitHub runs and its colours on the dark themes.
- Whether `deployment: false` changes the OIDC token the Marketplace credential checks.

## Sources

GitHub documentation, read from [`github/docs`](https://github.com/github/docs) on `main`:

- [About the repository README file][readmes]
- [Basic writing and formatting syntax][basic]
- [Quickstart for writing on GitHub][quickstart]
- [Organizing information with collapsed sections][details]
- [Creating diagrams][diagrams]
- [Attaching files][attach]
- [Attaching files with GitHub CLI][attach-cli]
- [About anonymized URLs][anon]
- [Managing accessibility settings][a11y]
- [Managing your theme settings][theme]
- [About large files on GitHub][large]
- [About releases][releases]
- [Customizing your repository's social media preview][social]
- [Classifying your repository with topics][topics]
- [Searching for repositories][search]
- [Pinning items to your profile][pin]
- [Profile reference: pinning items][profile-ref]
- [Viewing deployment history][deploy-history]
- [Using environments without deployments][no-deploy]
- [Workflow syntax: `jobs.<job_id>.environment`][env-syntax]
- [GitHub Mobile][mobile]

GitHub changelog and blog:

- [Video uploads now generally available, 2021-05-13][cl-video]
- [Specify theme context for images in Markdown, 2022-05-19][cl-fragment]
- [Specify theme context for images in Markdown (GA), 2022-08-15][cl-picture]
- [Option to prevent animated images from playing automatically, 2022-05-19][cl-anim]
- [GitHub CLI: media in issues, pull requests and comments, 2026-09-01][cl-attach]
- [Include diagrams in your Markdown files with Mermaid, 2022-02-14][blog-mermaid]
- [A framework for building Open Graph images, 2021-06-22][blog-og]

GitHub APIs, specifications and code:

- [Render a Markdown document][rest-markdown]
- [Update a repository][rest-update]
- [Replace all repository topics][rest-topics]
- [Create a deployment status][rest-status]
- [GraphQL mutations][gql-mutations], [GraphQL `Repository`][gql-repo] and [GraphQL `User`][gql-user], with a live introspection of `UpdateRepositoryInput`, `UpdateTopicsInput`, `UpdateTopicsPayload`, `PinEnvironmentInput`, `Repository`, `Environment` and `User`
- [REST OpenAPI description][openapi], `descriptions/api.github.com/api.github.com.json`
- [github/markup README][markup]
- [GitHub Flavored Markdown spec: disallowed raw HTML][gfm-tagfilter]
- [github/explore API doc][explore-api], and its `topics/` files for `vscode-extension`, `visual-studio-code`, `agent-skills`, `claude-code`, `claude`, `terminal` and `typescript`
- `gh` source: [`internal/attachments/userasset.go`][gh-userasset], [`internal/attachments/client.go`][gh-client], [`internal/ghinstance/host.go`][gh-host]

Platforms:

- X: [Summary card with large image][x-card] and [Cards markup][x-markup], Internet Archive copies of 2026-01-12 and 2026-01-16
- Slack: [Slackbot][slack-robots], [Unfurling links in messages][slack-unfurl], [Share links and set preview preferences][slack-help]
- [Discord: Link previews][discord]
- LinkedIn: [Make your website shareable][linkedin], [Use Post Inspector to refresh URL][linkedin-inspector]
- [Apple TN3156: Create rich previews for Messages][apple]
- [The Open Graph protocol][ogp]
- [WebKit: New video policies for iOS, 2016-07-25][webkit]

Leads only, used for the 350-character limit and checked against nothing primary: [corvene's test fixture][lead-corvene] and [better-gh's settings form][lead-better-gh].

Observations, all read-only, on 2026-10-09 between 11:50 and 12:45 UTC:

- `gh api markdown -f mode=gfm -f context=dbarjs/hero-synergy` with probes for every element above, and for the real asset `https://github.com/user-attachments/assets/dd3fe2e2-9795-47c1-9479-0b3fa14c6e75` in each placement.
- `gh api repos/dbarjs/hero-synergy`, `…/environments`, `…/deployments` and their statuses, `…/releases`, `…/contributors?anon=1`, `…/languages`; `gh api repos/<owner>/<repo>/readme` as HTML for nvim-mini/mini.completion and sindresorhus/awesome.
- GraphQL: `openGraphImageUrl`, `usesCustomOpenGraphImage`, `repositoryTopics`, `shortDescriptionHTML`, `environments` and `pinnedEnvironments` on repositories; `pinnedItems`, `pinnedItemsRemaining` and `itemShowcase` on `dbarjs`; repository searches for description lengths.
- Signed-out pages: `github.com/dbarjs/hero-synergy`, `github.com/dbarjs`, the profiles of `Brooooooklyn`, `msitarzewski` and `x1xhlol`, `github.com/mattpocock/ts-reset`, `github.com/nvim-mini/mini.completion`, `github.com/sindresorhus/awesome`, `github.com/microsoft/griffel`, `github.com/x1xhlol/system-prompts-and-models-of-ai-tools`, the sidebar payload of 15 repositories, 17 topic pages, the repository search JSON for five repositories, and a committed MP4's blob page and raw file.
- GitHub's assets as served to the repository page: [`global`][css-global], [`primer`][css-primer], [`profile`][css-profile] and the [light][css-light], [dark][css-dark], [dark dimmed][css-dimmed] and [dark high contrast][css-dark-hc] theme stylesheets; the [`themed-picture` chunk][themed-picture-js] and the `behaviors` bundle; the Open Graph images of this repository and of x1xhlol/system-prompts-and-models-of-ai-tools, and the custom images of mattpocock/ts-reset and biomejs/biome.
- `ffprobe` and an MP4 box listing of `/tmp/hero-synergy-30s.mp4`.

[readmes]: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes
[basic]: https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax
[quickstart]: https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/quickstart-for-writing-on-github
[details]: https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-collapsed-sections
[diagrams]: https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams
[attach]: https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files
[attach-cli]: https://docs.github.com/en/github-cli/github-cli/attaching-files-with-github-cli
[anon]: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-anonymized-urls
[a11y]: https://docs.github.com/en/account-and-profile/how-tos/account-settings/managing-accessibility-settings
[theme]: https://docs.github.com/en/get-started/accessibility/managing-your-theme-settings
[large]: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
[releases]: https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
[social]: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview
[topics]: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics
[search]: https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories
[pin]: https://docs.github.com/en/account-and-profile/how-tos/profile-customization/pinning-items-to-your-profile
[profile-ref]: https://docs.github.com/en/account-and-profile/reference/profile-reference#pinning-items-to-your-profile
[deploy-history]: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/view-deployment-history
[no-deploy]: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments#using-environments-without-deployments
[env-syntax]: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idenvironment
[mobile]: https://docs.github.com/en/get-started/using-github/github-mobile
[cl-video]: https://github.blog/changelog/2021-05-13-video-uploads-now-generally-available
[cl-fragment]: https://github.blog/changelog/2022-05-19-specify-theme-context-for-images-in-markdown/
[cl-picture]: https://github.blog/changelog/2022-08-15-specify-theme-context-for-images-in-markdown-ga
[cl-anim]: https://github.blog/changelog/2022-05-19-option-to-prevent-animated-images-from-playing-automatically/
[cl-attach]: https://github.blog/changelog/2026-09-01-github-cli-media-in-issues-pull-requests-and-comments
[blog-mermaid]: https://github.blog/developer-skills/github/include-diagrams-markdown-files-mermaid/
[blog-og]: https://github.blog/open-source/git/framework-building-open-graph-images/
[rest-markdown]: https://docs.github.com/en/rest/markdown/markdown#render-a-markdown-document
[rest-update]: https://docs.github.com/en/rest/repos/repos#update-a-repository
[rest-topics]: https://docs.github.com/en/rest/repos/repos#replace-all-repository-topics
[rest-status]: https://docs.github.com/en/rest/deployments/statuses#create-a-deployment-status
[gql-mutations]: https://docs.github.com/en/graphql/reference/mutations
[gql-repo]: https://docs.github.com/en/graphql/reference/objects#repository
[gql-user]: https://docs.github.com/en/graphql/reference/objects#user
[openapi]: https://github.com/github/rest-api-description
[markup]: https://github.com/github/markup#github-markup
[gfm-tagfilter]: https://github.github.com/gfm/#disallowed-raw-html-extension-
[explore-api]: https://github.com/github/explore/blob/main/docs/API.md
[gh-userasset]: https://github.com/cli/cli/blob/trunk/internal/attachments/userasset.go
[gh-client]: https://github.com/cli/cli/blob/trunk/internal/attachments/client.go
[gh-host]: https://github.com/cli/cli/blob/trunk/internal/ghinstance/host.go
[x-card]: https://web.archive.org/web/20260112050218/https://developer.x.com/en/docs/x-for-websites/cards/overview/summary-card-with-large-image
[x-markup]: https://web.archive.org/web/20260116124848/https://developer.x.com/en/docs/x-for-websites/cards/overview/markup
[slack-robots]: https://api.slack.com/robots
[slack-unfurl]: https://docs.slack.dev/messaging/unfurling-links-in-messages
[slack-help]: https://slack.com/help/articles/204399343-Share-links-and-set-preview-preferences
[discord]: https://docs.discord.com/developers/link-previews/overview
[linkedin]: https://www.linkedin.com/help/linkedin/answer/a521928
[linkedin-inspector]: https://www.linkedin.com/help/linkedin/answer/a6233775
[apple]: https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages
[ogp]: https://ogp.me/
[webkit]: https://webkit.org/blog/6784/new-video-policies-for-ios/
[lead-corvene]: https://github.com/wasi-master/corvene/blob/main/crates/corvene-github/src/api.rs
[lead-better-gh]: https://github.com/arihant2math/better-gh/blob/main/web/src/pages/repo-settings/sections/GeneralSettings.tsx
[themed-picture-js]: https://github.githubassets.com/assets/chunk-lazy-element-themed-picture-75e25bc751677ce0.js
[css-global]: https://github.githubassets.com/assets/global-62747e27e61258dc.css
[css-primer]: https://github.githubassets.com/assets/primer-9be9fe6313f476af.css
[css-profile]: https://github.githubassets.com/assets/profile-981c547bc2099dfa.css
[css-light]: https://github.githubassets.com/assets/light-5c4e9fc574bf49f3.css
[css-dark]: https://github.githubassets.com/assets/dark-afff6c53aef9b9d1.css
[css-dimmed]: https://github.githubassets.com/assets/dark_dimmed-6701f6218c53cf5b.css
[css-dark-hc]: https://github.githubassets.com/assets/dark_high_contrast-c409873d7987dffa.css
