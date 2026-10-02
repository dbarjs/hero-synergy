# Which VS Code versions do Cursor, Windsurf and VSCodium ship?

Research for the ticket "Which VS Code versions do Cursor, Windsurf and VSCodium ship?" ([#12](https://github.com/dbarjs/hero-synergy/issues/12)). Everything below was read on 2026-10-02 unless a different date is given.

## Answer

| Editor | Current stable release | Underlying VS Code version | Behind VS Code 1.140 |
| --- | --- | --- | --- |
| VS Code | 1.140.0 (2026-09-30) | 1.140.0 | |
| Cursor | 3.23.12 (built 2026-10-01) | 1.128.0 | 12 weekly releases, 86 days |
| Windsurf, now named Devin Desktop | 3.10.48 (2026-09-29) | 1.126.0 | 14 weekly releases, 100 days |
| VSCodium | 1.135.06055 (2026-09-09) | 1.135.0 | 5 weekly releases, 37 days |

Days are counted from the day VS Code released the underlying version.

**Recommended floor:** `"engines": { "vscode": "^1.105.0" }` with `"@types/vscode": "~1.105.0"`.

- Every API the Cockpit relies on is older than that: the newest required one (`TerminalOptions.isTransient`) landed in 1.65, and terminal shell integration, if it is used at all, in 1.93.
- The slowest fork today is on 1.126.0, so 1.105 leaves 21 versions of headroom and still installs on every Cursor release since 2.1 (2025-11-21), every Windsurf release since 1.12.25 (2025-10-23) and every VSCodium release since 1.105.0 (2025-10-10).
- What sets the floor is Node.js, not the API: VS Code 1.100 runs extensions on Node 20.19.0, below the `>=22.18` the seed sets for the packages the extension bundles. 1.104 is the first release on Node 22.18, and 1.105 (Node 22.19.0) is the first one that forks actually shipped.
- The hard limits are 1.93 below (API) and 1.126 above (Devin Desktop). If a Node 24 extension host is wanted instead, the alternative is `^1.125.0` with `@types/vscode` `~1.125.0`; it drops fork builds older than July 2026.

## Details

### Current releases

**VS Code.** The update service returns `productVersion` 1.140.0, and the `microsoft/vscode` release 1.140.0 was published on 2026-09-30. Since 1.111 (2026-03-09) VS Code ships a stable release every week ("the first of our weekly Stable releases"), so a gap of N minor versions now means roughly N weeks, not N months.

**Cursor.** Cursor's update API returns 3.23.12 for the stable track. The `product.json` in that build's server archive reads `"version": "3.23.12"`, `"vscodeVersion": "1.128.0"`, `"date": "2026-10-01T04:41:16.627Z"`. The download page still listed 3.22 as the newest version; 3.22.12 (built 2026-09-26) is also on 1.128.0.

Cursor's own code compares an extension's `engines.vscode` with `vscodeVersion`, and `vscode.version` returns it too (seen in the minified server bundle of 3.0.16: `isExtensionCompatible` passes `productService.vscodeVersion` to the engine check, and the API object is built with `version: e.vscodeVersion, cursorVersion: e.version`). So `vscodeVersion` is the number that `engines.vscode` is checked against.

A Cursor staff member wrote on 2026-06-05 that this number "is the declared API compatibility version. It doesn't always line up one-to-one with the underlying editor internals, which can sit on an older base", and that Cursor updates "the runtime (Electron, Node.js, Chromium) and security patches independently". Treat the declared version as a statement about the extension API, not about editor behaviour.

**Windsurf (Devin Desktop).** Windsurf was renamed Devin Desktop on 2026-06-02 (release 3.0.12: "Windsurf is now Devin Desktop"); `windsurf.com/changelog` redirects to `docs.devin.ai/desktop/changelog`. The update service returns `windsurfVersion` 3.10.48 and `productVersion` 1.126.0. The `product.json` in that archive reads `"nameShort": "Devin"`, `"version": "1.126.0"`, `"windsurfVersion": "3.10.48"`, and its `package.json` pins Electron 42.2.0.

**VSCodium.** The latest release is 1.135.06055, published 2026-09-09. Its notes begin "update vscode to 1.135.0", and `upstream/stable.json` at that tag pins `"tag": "1.135.0"`.

### How far each fork lags

Dates of VS Code releases come from the `microsoft/vscode` release list.

**Cursor**, from the `product.json` of sampled builds (each is the last patch of its line, so a base may have arrived a few days earlier than the build date shown):

| Cursor build | Built | `vscodeVersion` | VS Code stable that day |
| --- | --- | --- | --- |
| 1.7.54 | 2025-10-21 | 1.99.3 | 1.105 |
| 2.0.77 | 2025-11-13 | 1.99.3 | 1.106 |
| 2.1.50 | 2025-12-06 | 1.105.1 | 1.106 |
| 2.6.22 | 2026-03-27 | 1.105.1 | 1.113 |
| 3.0.16 | 2026-04-09 | 1.105.1 | 1.115 |
| 3.8.24 | 2026-06-24 | 1.105.1 | 1.125 (1.126 came out later that day) |
| 3.10.20 | 2026-07-07 | 1.125.0 | 1.127 |
| 3.11.25 | 2026-07-15 | 1.125.0 | 1.128 (1.129 came out later that day) |
| 3.12.30 | 2026-07-21 | 1.128.0 | 1.129 |
| 3.22.12 | 2026-09-26 | 1.128.0 | 1.139 |
| 3.23.12 | 2026-10-01 | 1.128.0 | 1.140 |

Cursor moved its declared version three times in the past year: to 1.105.1 in 2.1 (changelog of 2025-11-21: "VS Code Extension API upgraded to v1.105.1"), to 1.125.0 by 3.10, and to 1.128.0 by 3.12. Each move landed 2 to 6 weeks behind the VS Code release it adopted. Between moves it stood still, and the gap to upstream grew to about 7.5 months on 1.99.3 (1.99.0 dates from 2025-04-04) and about 8.5 months on 1.105.1, by which time VS Code was at 1.126, 21 versions ahead. Cursor staff: "There's no fixed schedule or public roadmap for syncing Cursor with newer upstream VS Code releases."

**Windsurf**, from the base updates its changelog announces:

| Release | Date | Base announced | VS Code release it adopted |
| --- | --- | --- | --- |
| 1.9.4 | 2025-06-03 | "Merged upstream changes from VS Code 1.99.3" | 1.99.0, 2025-04-04 |
| 1.12.25 | 2025-10-23 | "Updated Code OSS to version 1.105.0 (Electron: 37.6.0, ...)" | 1.105.0, 14 days earlier |
| 1.9566.9 | 2026-02-25 | "Merged changes from VS Code 1.108" | 1.108.0, 48 days earlier |
| 3.6.21 | 2026-07-29 | "Updated the base IDE to VS Code 1.126" | 1.126.0, 35 days earlier |

Windsurf rebases every 4 to 5 months onto a release that is 2 to 7 weeks old, then drifts. Its longest gaps in the past year: about 6.5 months on 1.99.x (until 2025-10-23) and about 6.5 months on 1.108 (until 2026-07-29, when VS Code was at 1.130, 22 versions ahead).

**VSCodium** packages an upstream tag, so it only lags by build time and release frequency. Until VS Code went weekly it published each monthly release within 0 to 14 days (1.104.0 on the same day, 1.105.0 after 1 day, 1.106 after 9, 1.107 after 14, 1.108 after 7, 1.109 after 6, 1.110 after 2). Since March 2026 it has published only some of the weekly releases: 1.112 (2026-03-20), 1.116 (04-27), 1.121 (05-22), 1.126 (07-07) and 1.135 (09-09), each 2 to 14 days after the matching VS Code release. Just before a new VSCodium release the gap has reached 10 versions (2026-09-08: VSCodium on 1.126, VS Code on 1.136).

**Summary.** Over the past year no current fork release has been further behind than about 8.5 months (Cursor, June 2026). The lowest VS Code version any of the three shipped as a current release in that period was 1.99.3 (Cursor until 2.1 in November 2025, Windsurf until October 2025). Since Cursor 2.1 in late November 2025 it has been 1.105 or higher, and today it is 1.126.

### When the Cockpit's APIs landed

"Landed" means the first `microsoft/vscode` release tag whose stable `vscode.d.ts` contains the declaration; I compared the file at every tag from 1.0.0 to 1.140.0 (the 1.110 tag has no `.0` suffix and was not fetched). Release notes are cited where they announce the API.

| API | Used for | First stable in | Evidence |
| --- | --- | --- | --- |
| `workspace.createFileSystemWatcher` | watching the status event file | 1.0 | `vscode.d.ts` at tag 1.0.0 |
| `RelativePattern` | scoping a watcher to one folder | 1.17 | `vscode.d.ts` |
| Watching a path outside the workspace with `RelativePattern` | a status event file kept outside the repo | 1.64 | 1.64 release notes |
| `TerminalOptions.name` | naming a session's terminal after its ticket | 1.9 | `vscode.d.ts` |
| `TerminalOptions.env` | `HERO_SYNERGY_TICKET`, `HERO_SYNERGY_EVENTS` | 1.18 | `vscode.d.ts` |
| `WebviewView`, `window.registerWebviewViewProvider` | the Cockpit view | 1.50 | `vscode.d.ts`; 1.50 release notes, "Webview Views" |
| `TerminalOptions.iconPath` | icon per ticket type | 1.58 | `vscode.d.ts`; 1.58 release notes |
| `TerminalOptions.color` | tab colour | 1.60 | `vscode.d.ts` |
| `TerminalOptions.location`, `TerminalLocation`, `TerminalEditorLocationOptions` | a session as an editor tab | 1.64 | `vscode.d.ts`; 1.64 release notes, "vscode.TerminalLocation" |
| `TerminalOptions.isTransient` | not restoring a session's terminal on reload | 1.65 | `vscode.d.ts` |
| `Terminal.shellIntegration`, `window.onDidChangeTerminalShellIntegration`, `onDidStartTerminalShellExecution`, `onDidEndTerminalShellExecution` | reading commands and exit codes | 1.93 | `vscode.d.ts`; 1.93 release notes, "Terminal shell integration API" |

Notes:

- Since 1.64 a watcher created with only a glob string receives events from inside the workspace only. To watch a status event file outside the workspace folders, pass a `RelativePattern` with the folder's `Uri`.
- `TerminalOptions.iconPath` has had the type `IconPath` since 1.96; before that it was the same union written inline.
- The only `TerminalOptions` field added after 1.65 is `shellIntegrationNonce` (1.104), which the Cockpit does not need.
- The stable API has barely moved lately: `vscode.d.ts` is byte-identical from 1.125.0 to 1.133.0, and 1.126.0 differs from 1.140.0 in 10 lines.

### Node.js in the extension host

The extension declares `"extensionKind": ["workspace"]`, so it runs in Electron's Node locally and in the VS Code server's Node in dev containers, SSH and WSL. Both come from the VS Code build: `.npmrc` at the release tag pins Electron, `remote/.npmrc` pins the server's Node, and Electron's `DEPS` file names the Node it embeds. The two matched at the six tags where I checked `DEPS` (1.100, 1.104, 1.105, 1.126, 1.128, 1.140); the Node column below is the `remote/.npmrc` value.

| VS Code | Electron | Node.js |
| --- | --- | --- |
| 1.93 | 30.4.0 | 20.15.1 |
| 1.100 | 34.5.1 | 20.19.0 |
| 1.101 | 35.5.1 | 22.15.1 |
| 1.103 | 37.2.3 | 22.17.0 |
| 1.104 | 37.3.1 | 22.18.0 |
| 1.105 | 37.6.0 | 22.19.0 |
| 1.122 | 39.8.8 | 22.22.1 |
| 1.123 to 1.127 | 42.3.0 | 24.15.0 |
| 1.128 | 42.5.0 | 24.17.0 |
| 1.135 | 42.8.1 | 24.18.1 |
| 1.140 | 43.7.3 | 24.21.0 |

Forks choose their own runtime, so these numbers are a lower bound, not a promise. Cursor 3.23.12 declares VS Code 1.128.0 but its server bundles Node 24.18.1 (upstream 1.128 has 24.17.0). Devin Desktop 3.10.48 pins Electron 42.2.0 (Node 24.15.0) where upstream 1.126 has 42.3.0. Windsurf's 1.105.0 base used Electron 37.6.0, the same as upstream.

### Pinning `@types/vscode`

What vsce 4.0.0 enforces (`validateVSCodeTypesCompatibility` in `src/validation.ts`, called from `validateManifestForPackaging` whenever `devDependencies` has `@types/vscode`):

- It reads the two strings from `package.json`, strips any leading range characters, and compares major and minor only. Patch is ignored, "since we don't have control over the patch version (it's auto-incremented by DefinitelyTyped)".
- If the types' major.minor is greater than the engine's, packaging fails: "@types/vscode ... greater than engines.vscode ... Either upgrade engines.vscode or use an older @types/vscode version".
- `engines.vscode` must be `*` or a version with an optional `^` or `>=` prefix. The VS Code docs: `^1.8.0` "means that your extension is compatible with VS Code 1.8.0 and onwards".

What it does not catch: vsce checks the manifest string, not what is installed. `"@types/vscode": "^1.105.0"` passes the check, yet pnpm would install 1.140.0 and the code would type-check against APIs the floor does not have. So pin with a tilde or an exact version at the floor's minor: `~1.105.0`. The seed's `~1.100.0` already follows that pattern.

`@types/vscode` is no longer published for every VS Code release. The registry has every minor up to 1.110.0, then only 1.115.0, 1.116.0, 1.118.0, 1.120.0, 1.125.0, 1.134.0, 1.136.0, 1.137.0, 1.138.0 and 1.140.0: a version seems to appear only when `vscode.d.ts` changes (1.125.0 to 1.133.0 share one file, and the next types version is 1.134.0). For a floor without its own types, pin the newest version at or below it. A floor of `^1.126.0`, for example, needs `~1.125.0`, because `~1.126.0` resolves to nothing.

### Choosing the floor

| Candidate | APIs | Node.js at the floor | Installs on | Verdict |
| --- | --- | --- | --- | --- |
| `^1.93.0` | all, including shell integration | 20.15.1 | everything | Lowest the APIs allow. Node 20 is below the seed's `>=22.18`. |
| `^1.100.0` (seed placeholder) | all | 20.19.0 | everything | Same Node problem, and no fork release ever sat on 1.100. |
| `^1.104.0` | all | 22.18.0 | everything from the past year except 1.99.3-based builds | Lowest that meets `>=22.18`. No fork shipped it, so it cannot be tested on a real fork build. |
| **`^1.105.0`** | all | 22.19.0 | Cursor 2.1 and later, Windsurf 1.12.25 and later, VSCodium 1.105.0 and later | **Recommended.** |
| `^1.125.0` | all | 24.15.0 | Cursor 3.10 and later, Devin Desktop 3.6.21 and later, VSCodium 1.126 and later | Works for current releases. Choose it only to get Node 24. |
| `^1.126.0` | all | 24.15.0 | as above | Highest that still installs on Devin Desktop 3.10.48. Needs `@types/vscode` `~1.125.0`. |

Reasoning for `^1.105.0`:

1. **The APIs do not constrain the choice.** Everything needed is in 1.65, or 1.93 with shell integration, far below any fork.
2. **Node.js does.** The extension bundles `@hero-synergy/core`, which the seed publishes with `"engines": { "node": ">=22.18" }`. At 1.100 the extension host runs Node 20.19.0, so core code that is valid under its own engine range could fail inside VS Code. From 1.104 the host has Node 22.18 or newer, and one Node baseline covers core, the CLI and the extension. (`effect` 4.0.0 declares no Node engine and `@effect/platform-node` 4.0.0 declares `>=18`, so the dependencies do not push it higher.)
3. **1.105 is a version forks really shipped.** Cursor declared 1.105.1 from 2.1 to 3.8 and Windsurf was based on 1.105.0 from October 2025 to February 2026, so the floor can be tested on a real fork build. `@types/vscode` 1.105.0 exists.
4. **It has slack for stragglers.** The slowest current fork is 21 versions above it. A user who has not updated a fork since late 2025 can still install the extension. Forks never move their base backwards, so the floor only needs revisiting when the Cockpit wants a newer API.
5. **Going higher buys nothing today.** `^1.125.0` adds no API the Cockpit needs. Its only gain is Node 24, and it shuts out fork builds from before July 2026.

### Not verified

- **Cursor's exact switch dates.** I sampled eleven builds. The move from 1.105.1 to 1.125.0 happened between 3.8.24 (built 2026-06-24) and 3.10.20 (2026-07-07); I did not inspect 3.9. Cursor's changelog pages that I could open do not mention the 1.125 or 1.128 moves; the evidence is `product.json` alone.
- **Windsurf's bases between announcements.** The lag table trusts the changelog. I only opened one archive (3.10.48), so a base update the changelog did not announce would be missing.
- **Behaviour, as opposed to declarations.** Nothing here was run inside Cursor, Devin Desktop or VSCodium. The API versions are what each build declares; Cursor staff say editor internals "can sit on an older base". Whether a terminal in the editor area, a terminal icon or a webview view behaves identically in each fork needs a test in the real editors.
- **Desktop Node versions in forks.** Cursor's Node 24.18.1 was read from its Linux server archive, not from the desktop app. Devin Desktop's Node is inferred from the Electron version in its `package.json`.
- **Other platforms.** All archives inspected were Linux x64. I assumed macOS and Windows builds of the same release share the base version.
- **Which registry each fork installs from.** `product.json` points Cursor at `marketplace.cursorapi.com` and Devin Desktop at `marketplace.windsurf.com`. Whether those mirror Open VSX was not checked; it is outside this ticket.
- **The Cursor download page** listed 3.22 as newest while the update API returned 3.23.12. I did not find out whether 3.23 is a staged rollout. Both are on 1.128.0.

## Differences from the seed

- **`"engines": { "vscode": "^1.100.0" }` and `"@types/vscode": "~1.100.0"`** (Appendix A.2). The seed marks these as a placeholder. VS Code 1.100 runs extensions on Node 20.19.0, which is below the `>=22.18` the seed's Stack table sets for the published packages the extension bundles. Recommended: `^1.105.0` and `~1.105.0`.
- **"Windsurf"** (Open VSX section and "Not yet specified"). The product has been called Devin Desktop since 2026-06-02; its `product.json` says `"nameShort": "Devin"` and `"applicationName": "devin-desktop"`. The version field is still named `windsurfVersion` and the download host is still `windsurf-stable.codeium.com`.
- **"Forks such as Cursor lag behind VS Code"** holds, with one change of scale the seed does not mention: VS Code has released weekly since 1.111, so version-number gaps look larger than they are. Cursor's 12-version gap is 12 weeks.
- Nothing else in the seed is contradicted. Its statement that "VS Code runs extensions on its own bundled Node, so extension code can't assume Node 26 APIs" is confirmed: the newest VS Code bundles Node 24.21.0.

## Sources

All read on 2026-10-02.

VS Code:

- Update service, current stable: <https://update.code.visualstudio.com/api/update/linux-x64/stable/latest>
- Release list and dates: <https://github.com/microsoft/vscode/releases>
- 1.140 release notes: <https://code.visualstudio.com/updates/v1_140>
- 1.111 release notes, weekly stable releases: <https://code.visualstudio.com/updates/v1_111>
- 1.50 release notes, webview views: <https://code.visualstudio.com/updates/v1_50#_webview-views>
- 1.58 release notes, terminal `iconPath`: <https://code.visualstudio.com/updates/v1_58>
- 1.64 release notes, `TerminalLocation` and file watching outside the workspace: <https://code.visualstudio.com/updates/v1_64>
- 1.93 release notes, terminal shell integration API: <https://code.visualstudio.com/updates/v1_93#_terminal-shell-integration-api>
- `vscode.d.ts` at each tag: `https://github.com/microsoft/vscode/blob/<tag>/src/vscode-dts/vscode.d.ts` (from 1.63.0) and `https://github.com/microsoft/vscode/blob/<tag>/src/vs/vscode.d.ts` (up to 1.62.0), for example <https://github.com/microsoft/vscode/blob/1.105.0/src/vscode-dts/vscode.d.ts>
- Current API reference: <https://code.visualstudio.com/api/references/vscode-api#TerminalOptions>
- Electron and server Node pins at each tag: `https://github.com/microsoft/vscode/blob/<tag>/.npmrc` and `https://github.com/microsoft/vscode/blob/<tag>/remote/.npmrc`, for example <https://github.com/microsoft/vscode/blob/1.105.0/remote/.npmrc>
- Node version embedded in an Electron release: `https://github.com/electron/electron/blob/v<version>/DEPS`, for example <https://github.com/electron/electron/blob/v37.6.0/DEPS>
- `engines.vscode` semantics: <https://code.visualstudio.com/api/working-with-extensions/publishing-extension#visual-studio-code-compatibility>

Cursor:

- Update API, stable track: <https://api2.cursor.sh/updates/api/download/stable/linux-x64/cursor>
- Download links for older lines: `https://api2.cursor.sh/updates/download/golden/linux-x64/cursor/<major.minor>`, as listed on <https://cursor.com/download>
- `product.json` inside each build: the AppImage the links above redirect to, or the server archive at `https://cursor.blob.core.windows.net/remote-releases/<commit>/vscode-reh-linux-x64.tar.gz`, where `<commit>` is the `commit` field of `product.json` (the download URL's commit with its last character replaced by `0`)
- 2.1 changelog, "VS Code Extension API upgraded to v1.105.1": <https://cursor.com/changelog/2-1>
- Changelog index: <https://cursor.com/changelog>
- Cursor staff on rebase cadence, 2026-06-05: <https://forum.cursor.com/t/how-often-is-the-underlying-vs-code-extension-api-updated-in-cursor/162486>

Windsurf (Devin Desktop):

- Update service: <https://windsurf-stable.codeium.com/api/update/linux-x64/stable/latest>
- Changelog: <https://docs.devin.ai/desktop/changelog> (<https://windsurf.com/changelog> redirects here)
- `product.json` and `package.json` inside <https://windsurf-stable.codeiumdata.com/linux-x64/stable/fcf7ba39e6150055fad817f8716385b4d320d46d/Devin-linux-x64-3.10.48.tar.gz>

VSCodium:

- Releases: <https://github.com/VSCodium/vscodium/releases>
- Upstream pin at the latest release: <https://github.com/VSCodium/vscodium/blob/1.135.06055/upstream/stable.json>

vsce and types:

- `validateEngineCompatibility` and `validateVSCodeTypesCompatibility`: <https://github.com/microsoft/vscode-vsce/blob/v4.0.0/src/validation.ts>
- Call site in `validateManifestForPackaging`: <https://github.com/microsoft/vscode-vsce/blob/v4.0.0/src/package.ts>
- Range parsing: <https://github.com/microsoft/vscode-vsce/blob/v4.0.0/src/packageSpec.ts>
- vsce 4.0.0 release (2026-09-14); the three files above are unchanged on `main` at commit `0765451`: <https://github.com/microsoft/vscode-vsce/releases/tag/v4.0.0>
- Published `@types/vscode` versions and dates (`npm view @types/vscode versions time`): <https://www.npmjs.com/package/@types/vscode?activeTab=versions>
- Node engines of `effect` 4.0.0 and `@effect/platform-node` 4.0.0 (`npm view <package>@4.0.0 engines`): <https://www.npmjs.com/package/effect>, <https://www.npmjs.com/package/@effect/platform-node>
