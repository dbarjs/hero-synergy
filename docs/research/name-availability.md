# Are the hero-synergy names free on npm, the Marketplace and Open VSX?

Research for the ticket [Are the hero-synergy names free on npm, the Marketplace and Open VSX?](https://github.com/dbarjs/hero-synergy/issues/8).

Checked on **2026-10-02, 19:26 to 19:50 UTC**, read-only and signed out of every registry. Nothing was registered, claimed or published. Every status below is what the registry itself answered at that time; names can be taken at any moment after it.

## Answer

| Name | Status | Evidence |
| --- | --- | --- |
| npm organization `hero-synergy` (scope `@hero-synergy`) | **Taken: the organization exists**, with 0 public packages. Created 2026-10-02T18:05:04Z, 61 seconds before the `dbarjs/hero-synergy` GitHub repository (18:06:05Z). Almost certainly Eduardo's, but **the owner is not publicly visible**. | `https://www.npmjs.com/org/hero-synergy` renders an organization page with "Packages 0"; `GET https://registry.npmjs.org/-/org/hero-synergy/package` returns `200 {}` (an unknown scope returns `404 {"error":"Scope not found"}`). |
| npm packages `@hero-synergy/core`, `@hero-synergy/cli` | **Not published.** Only members of the organization can publish them. | `npm view` gives `E404`; the registry returns `404 {"error":"Not found"}`. |
| npm unscoped package `hero-synergy` | **Free.** No package, and no existing package differs from it only by punctuation. | `npm view hero-synergy` gives `E404`; `https://registry.npmjs.org/hero-synergy` returns 404; so do `herosynergy`, `hero_synergy` and `hero.synergy`. |
| Marketplace publisher ID `hero-synergy` | **No public trace**, so probably free. Not provable while signed out. | `https://marketplace.visualstudio.com/publishers/hero-synergy` returns 404 (a known publisher, `redhat`, returns 200). |
| Marketplace publisher ID `dbarjs` | **No public trace**, so probably free. Not provable while signed out. | `https://marketplace.visualstudio.com/publishers/dbarjs` returns 404; gallery searches for `dbarjs` return 0 extensions. |
| Marketplace extension named `hero-synergy` / "Hero Synergy" | **None exists** under any publisher. | Gallery query for `hero-synergy.hero-synergy` and `dbarjs.hero-synergy`: 0 results; text search `hero-synergy`: 0 results; none of the 9 results for `synergy` is a hero-synergy. |
| Open VSX namespace `hero-synergy` | **Free.** | `https://open-vsx.org/api/hero-synergy` returns `404 {"error":"Namespace not found: hero-synergy"}`. |
| Open VSX namespace `dbarjs` | **Free.** | `https://open-vsx.org/api/dbarjs` returns `404 {"error":"Namespace not found: dbarjs"}`. |

In one line: the npm organization is already registered (by whom is the one thing Eduardo must confirm), and every other name is unclaimed as far as the public record shows.

## npm

### What exists

- **The organization `hero-synergy` exists.** The page `https://www.npmjs.com/org/hero-synergy` shows the heading `hero-synergy` and "Packages 0". `https://www.npmjs.com/~hero-synergy` redirects to that organization page, so the name is an organization and not a user account. The page's embedded data gives `scope.type: "org"` and `created: 2026-10-02T18:05:04.493Z`.
- **Registry behaviour agrees.** `GET https://registry.npmjs.org/-/org/<scope>/package` answered `404 {"error":"Scope not found"}` for two made-up scopes and for `herosynergy` and `hero-synergi`, and `200 {}` for `hero-synergy`. `GET /-/org/<scope>/user` answered `{"<name>":"owner"}` for user scopes (`dbarjs`, `hero`, `synergy`, `sindresorhus`) and `{}` for organizations (`villajs`, `zofetch`, `vuejs`, and `hero-synergy`). These endpoints are the ones `npm access` and `npm org` call; their signed-out behaviour is observed, not documented.
- **The owner is hidden.** npm shows organization members only to signed-in members. Eduardo's public profile `https://www.npmjs.com/~dbarjs` lists "0 Organizations", but that tab is empty for signed-out viewers in general: it also shows 0 for `yyx990803`, and for `dbarjs` himself despite his packages under `@villajs` and `@zofetch`. So the profile neither confirms nor rules out his ownership.
- **Timing points at Eduardo.** The organization was created at 18:05:04Z and the GitHub repository `dbarjs/hero-synergy` at 18:06:05Z the same day. That is circumstantial evidence, not proof.
- **Nothing is published in the scope.** `@hero-synergy/core` and `@hero-synergy/cli` both return 404.
- **The unscoped name `hero-synergy` is free.** The registry has no document for it (a plain 404, with no unpublished-package record). The names that would collide with it under npm's punctuation rule (`herosynergy`, `hero_synergy`, `hero.synergy`) and `hero-synergy-cli` are also 404, and a registry search for `herosynergy` returns 0 packages.
- **Eduardo's npm user is `dbarjs`** (10 public packages, linked to GitHub `@dbarjs`), so the personal scope `@dbarjs` is his fallback.

### Rules for claiming

- **Organizations.** Any npm user can create one from the website (profile menu, "Add an Organization"). The organization name becomes its scope, and the "Unlimited public packages" plan is free. ([Creating an organization](https://docs.npmjs.com/creating-an-organization), [About organization scopes and packages](https://docs.npmjs.com/about-organization-scopes-and-packages))
- **Scopes.** A user or organization is granted the scope matching its name, and a scope lets its owner reuse a package name someone else has without conflict. Scoped packages are private by default, so the first publish needs `--access public`. ([About scopes](https://docs.npmjs.com/about-scopes))
- **First come, first served, for active use.** npm follows GitHub's username policy. Registering an organization or publishing a package only to reserve the name is squatting: an organization counts as squatted when no package is published in it "within a reasonable time", and a package counts as squatted when it has no genuine function. npm does not hand names over on request; a trademark report is the only route it acts on. ([Username Policy](https://docs.npmjs.com/policies/disputes))
  - For hero-synergy this cuts both ways. If the organization is not Eduardo's, there is no practical way to obtain it. If it is his, an empty organization should get its first package soon, and an unscoped `hero-synergy` placeholder published only to hold the name is what the policy forbids. A real package (the CLI, or a thin `npx hero-synergy` wrapper that works) is fine.
- **Unscoped names: the similarity rule.** The guidelines ask that an unscoped name not be spelled like another package's name and not confuse people about authorship ([Package name guidelines](https://docs.npmjs.com/package-name-guidelines)). The registry enforces one part mechanically: for a brand-new package it strips punctuation (`.`, `-`, `_`) from the name and refuses the publish if the result equals an existing package's stripped name, suggesting a scope instead ([New Package Moniker rules](https://blog.npmjs.org/post/168978377570/new-package-moniker-rules), 2017-12-26). npm also says it can detect and block typosquats, without publishing the criteria ([Threats and mitigations](https://docs.npmjs.com/threats-and-mitigations)). `hero-synergy` strips to `herosynergy`, which no package uses. Scoped names are not subject to the punctuation rule.
- **Names are not reusable versions.** Once `name@version` is published it can never be published again, even after an unpublish, and a fully unpublished package cannot be republished for 24 hours. ([npm Unpublish Policy](https://docs.npmjs.com/policies/unpublish))

## VS Code Marketplace

### What exists

- **Publisher pages.** `https://marketplace.visualstudio.com/publishers/hero-synergy` and `.../publishers/dbarjs` both return the Marketplace's 404 page, the same as a made-up ID. `.../publishers/redhat` returns 200.
- **Gallery queries** (the public `extensionquery` endpoint the Extensions view uses): 0 extensions for `hero-synergy.hero-synergy`, for `dbarjs.hero-synergy`, for the text `hero-synergy`, and for `publisher:"hero-synergy"` and `publisher:"dbarjs"`. The item page `items?itemName=hero-synergy.hero-synergy` is a 404. The same query finds `redhat.java`, so the query works.
- **Limit of this evidence.** A publisher that exists but has no public extension may have no public page and cannot appear in gallery results. The publisher lookup API (`/_apis/gallery/publishers/<id>`) redirects to sign-in. So "no public trace" is the strongest statement available signed out. The definitive check is the "Create publisher" form at <https://marketplace.visualstudio.com/manage>, which rejects a taken ID.
- **Eduardo has no visible Marketplace presence**: no publisher page for `dbarjs` and no extension matching `dbarjs`. Whether his Microsoft account already owns a publisher under another ID is not visible.

### Rules for claiming

- **Creating a publisher.** Sign in at <https://marketplace.visualstudio.com/manage>, choose "Create publisher", and give an **ID** and a **Name**. Both must be unique in the Marketplace. The ID appears in extension URLs and is the `publisher` field of `package.json`; the Name is the display name shown with the extensions. ([Publishing Extensions: Create a publisher](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#create-a-publisher))
- **The ID is permanent.** The docs state: "ID cannot be changed once created." The display name can be changed, but changing it revokes a verified badge. The extension ID is `<publisher>.<name>`, so a different publisher means a different extension ID. Whether Marketplace support can move an existing extension between publishers was not researched.
- **Allowed characters.** The Marketplace docs do not list them. `vsce` validates both the publisher ID and the extension name against `/^[a-z0-9][a-z0-9\-]*$/i`: letters, digits and hyphens, starting with a letter or digit ([`src/validation.ts`](https://github.com/microsoft/vscode-vsce/blob/main/src/validation.ts)). Both `hero-synergy` and `dbarjs` pass. Microsoft's Azure DevOps publishing guide gives `mycompany-myteam` as an example ID and limits the publisher *name* to 16 characters when it uses multibyte characters ([Package and publish extensions](https://learn.microsoft.com/en-us/azure/devops/extend/publish/overview?view=azure-devops#create-a-publisher)). No maximum length for the ID is documented.
- **Extension name and display name.** The docs say both the `name` and the `displayName` must be unique in the Marketplace, with the error `The extension 'name' already exists in the Marketplace` ([Publishing Extensions, "Common questions"](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#common-questions), [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)). The gallery still holds older extensions that share a `name` across publishers (three `static-site-hero`), so how strictly this is enforced today is unclear. It does not matter here: neither `hero-synergy` nor "Hero Synergy" is in use.
- **A removed extension's name is gone for good.** Unpublishing keeps the name; removing an extension reserves its name permanently, even for the original publisher. Never "remove" `hero-synergy` to start over.
- **Verified publisher.** Needs a domain, and both the domain registration and the publisher's first extension must be at least 6 months old. Not reachable for v0.1.0.
- **Authentication.** Global Azure DevOps PATs retire on 2026-12-01; the docs recommend Entra ID with a managed identity, which matches the seed.

## Open VSX

### What exists

- **Namespace `hero-synergy`: not found.** `https://open-vsx.org/api/hero-synergy` and `.../api/hero-synergy/details` return 404 "Namespace not found". The server's `getNamespace` throws not-found only when the namespace row is missing, so an empty namespace would answer 200, not 404 ([`LocalRegistryService.java`](https://github.com/eclipse-openvsx/openvsx/blob/main/server/src/main/java/org/eclipse/openvsx/LocalRegistryService.java)).
- **Namespace `dbarjs`: not found** either.
- **No hero-synergy extension**: `https://open-vsx.org/api/hero-synergy/hero-synergy` is a 404, and the search API returns nothing named hero-synergy.
- **Nearest neighbour**: the namespace `hero-sync` exists (one extension, "Hero Sync", unverified). It is unrelated.
- **No ownership claim on record**: a search of `EclipseFdn/open-vsx.org` issues for `hero-synergy` returns 0.

### Rules for claiming

- **The namespace is the `publisher` field.** One `package.json` serves both registries, so the Marketplace publisher ID and the Open VSX namespace are the same string. Choosing the publisher ID chooses both.
- **Valid names** match `[\w\-\+\$~]+`, at most 255 characters ([Namespace Access](https://github.com/eclipse-openvsx/openvsx/wiki/Namespace-Access), [`ExtensionValidator.java`](https://github.com/eclipse-openvsx/openvsx/blob/main/server/src/main/java/org/eclipse/openvsx/ExtensionValidator.java)).
- **Creating it** takes four steps: an Eclipse account whose GitHub username field matches the GitHub account used to log in to open-vsx.org; the Publisher Agreement, signed from the open-vsx.org profile page; an access token; then `npx ovsx create-namespace <name> -p <token>` ([Publishing Extensions](https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions)).
- **Creating is not owning.** The creator becomes a *contributor*. The namespace has no owner, and its extensions show as unverified with a warning, until someone is granted ownership.
- **Claiming ownership is a public, human-reviewed request**: an issue in [EclipseFdn/open-vsx.org](https://github.com/EclipseFdn/open-vsx.org/issues/new/choose) using the "Claim namespace ownership" template. The [template](https://github.com/EclipseFdn/open-vsx.org/blob/main/.github/ISSUE_TEMPLATE/claim-namespace-ownership.yml) asks that the requesting GitHub ID have at least 12 months of public history (`dbarjs` dates from 2013) and offers four kinds of evidence:
  1. The namespace is also a Marketplace publisher with a published extension whose repository is owned by the requesting GitHub ID.
  2. The namespace is a Marketplace publisher with no extension (or none with a GitHub repository): grant the Open VSX administrator temporary reader access to the publisher, or prove a matching domain by DNS TXT record or email.
  3. The namespace is not a Marketplace publisher: it must match the requesting GitHub ID, or a domain proved as above.
  4. Anything else, which the template says takes longest.
- **What that means for each candidate.**
  - `dbarjs` matches Eduardo's GitHub ID, so it qualifies under option 3 with no Marketplace dependency.
  - `hero-synergy` matches no GitHub account (`github.com/hero-synergy` does not exist) and no known domain. Its quick routes are options 1 and 2, and both need the Marketplace publisher `hero-synergy` to exist first.
- **Similarity check.** Namespace creation is refused when the name is within a Levenshtein distance of 20% of the longer name's length from an existing namespace the user is not a member of ([`LocalRegistryService.createNamespace`](https://github.com/eclipse-openvsx/openvsx/blob/main/server/src/main/java/org/eclipse/openvsx/LocalRegistryService.java), [`NamespaceJooqRepository.java`](https://github.com/eclipse-openvsx/openvsx/blob/main/server/src/main/java/org/eclipse/openvsx/repositories/NamespaceJooqRepository.java); open-vsx.org sets `similarity.enabled: true`, `similarity-threshold: 0.2` in its [`application.yml`](https://github.com/EclipseFdn/open-vsx.org/blob/main/configuration/application.yml)). For `hero-synergy` (12 characters) that is a distance of 2 or less. `hero-sync` is at distance 4, so it does not trip the check.
- **Trusted publishing needs ownership.** Registering a trusted publisher requires being an *owner* of the namespace (contributor is not enough), a signed Publisher Agreement, and the extension already existing with an active version. The `publisher` field must match the namespace's case exactly, so keep it lowercase. ([Trusted Publishing](https://github.com/eclipse-openvsx/openvsx/wiki/Trusted-Publishing)) `https://open-vsx.org/api/version` reports a `trustedPublishingAudience`, so the feature is live on open-vsx.org.

## Not verified

- **Who owns the npm organization `hero-synergy`.** Only a signed-in member can see the member list. Eduardo can settle it in seconds: `npm org ls hero-synergy` while logged in as `dbarjs`, or his organizations list on npmjs.com.
- **Whether the Marketplace publisher IDs are truly unregistered.** A publisher with no public extension leaves no public trace. Only the "Create publisher" form, signed in, is definitive.
- **Whether Eduardo's Microsoft account already owns a Marketplace publisher** under some other ID.
- **Whether npm would accept an unscoped `hero-synergy` publish.** The punctuation rule is satisfied, but npm's wider typosquat detection is not public; only a real publish proves it.
- **Whether Open VSX's deployed server matches the `main` branch** read here (it reports `v1.2.0`), and whether some namespace this research did not find sits within distance 2 of `hero-synergy`. Open VSX has no public list of namespaces.
- **Trademarks.** No trademark search was done for "Hero Synergy". All three registries act on trademark complaints.

## Differences from the seed

Nothing here contradicts `docs/seed.md`. Four points sharpen it:

1. **The npm organization already exists.** The seed decides the organization is `hero-synergy` and its one-time setup starts at "publish `0.0.0`", with no step to create the organization. It was created on 2026-10-02 at 18:05Z. If that was Eduardo, the seed is simply silent about a step already done. If it was not, the `@hero-synergy` scope is unavailable and the `[E]` decision cannot hold.
2. **Open VSX is not independent of the Marketplace for `hero-synergy`.** The seed treats each registry as its own switch and says to create the namespace "and claim ownership". Claiming is a reviewed GitHub issue, and for a namespace that is not the requester's GitHub ID the quick evidence routes need the Marketplace publisher of the same name to exist first. Trusted publishing in turn needs that ownership. So with publisher `hero-synergy` the order is Marketplace publisher, then Open VSX claim, then trusted publisher; with publisher `dbarjs` the claim stands alone.
3. **The publisher ID cannot be changed after creation**, and it names the Open VSX namespace too. The seed lists the choice as open but does not say it is irreversible.
4. **The seed's reference manifest already answers its own open question.** Appendix A.2 sets `"publisher": "hero-synergy"` while "Not yet specified" leaves `hero-synergy` versus `dbarjs` open. Treat the appendix value as a placeholder until the ticket "Which publisher ID and npm names?" is resolved.

## Sources

Registry state (queried 2026-10-02, signed out):

- npm registry: <https://registry.npmjs.org/hero-synergy>, <https://registry.npmjs.org/@hero-synergy%2fcore>, <https://registry.npmjs.org/@hero-synergy%2fcli>, <https://registry.npmjs.org/-/org/hero-synergy/package>, <https://registry.npmjs.org/-/org/hero-synergy/user>, <https://registry.npmjs.org/-/v1/search?text=herosynergy>
- npm website: <https://www.npmjs.com/org/hero-synergy>, <https://www.npmjs.com/~hero-synergy>, <https://www.npmjs.com/package/hero-synergy>, <https://www.npmjs.com/~dbarjs?activeTab=orgs>
- npm CLI 11.19.0: `npm view hero-synergy`, `npm view @hero-synergy/core`, `npm view @hero-synergy/cli`
- VS Code Marketplace: <https://marketplace.visualstudio.com/publishers/hero-synergy>, <https://marketplace.visualstudio.com/publishers/dbarjs>, <https://marketplace.visualstudio.com/items?itemName=hero-synergy.hero-synergy>, and `POST https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery`
- Open VSX: <https://open-vsx.org/api/hero-synergy>, <https://open-vsx.org/api/dbarjs>, <https://open-vsx.org/api/hero-synergy/hero-synergy>, <https://open-vsx.org/api/-/search?query=hero-synergy>, <https://open-vsx.org/api/hero-sync>, <https://open-vsx.org/api/version>
- GitHub: `gh api repos/dbarjs/hero-synergy` (created 2026-10-02T18:06:05Z), `gh api users/hero-synergy` (404), `gh api users/dbarjs` (created 2013-07-22)

Rules:

- npm, Creating an organization: <https://docs.npmjs.com/creating-an-organization>
- npm, About organization scopes and packages: <https://docs.npmjs.com/about-organization-scopes-and-packages>
- npm, About scopes: <https://docs.npmjs.com/about-scopes>
- npm, Package name guidelines: <https://docs.npmjs.com/package-name-guidelines>
- npm, Username Policy (disputes and squatting): <https://docs.npmjs.com/policies/disputes>
- npm, Unpublish Policy: <https://docs.npmjs.com/policies/unpublish>
- npm, Threats and mitigations: <https://docs.npmjs.com/threats-and-mitigations>
- npm blog, New Package Moniker rules (2017-12-26): <https://blog.npmjs.org/post/168978377570/new-package-moniker-rules>
- VS Code, Publishing Extensions: <https://code.visualstudio.com/api/working-with-extensions/publishing-extension>
- VS Code, Extension Manifest: <https://code.visualstudio.com/api/references/extension-manifest>
- vsce, name validation: <https://github.com/microsoft/vscode-vsce/blob/main/src/validation.ts>
- Microsoft Learn, Package and publish extensions (Create a publisher): <https://learn.microsoft.com/en-us/azure/devops/extend/publish/overview?view=azure-devops>
- Open VSX wiki, Publishing Extensions: <https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions>
- Open VSX wiki, Namespace Access: <https://github.com/eclipse-openvsx/openvsx/wiki/Namespace-Access>
- Open VSX wiki, Trusted Publishing: <https://github.com/eclipse-openvsx/openvsx/wiki/Trusted-Publishing>
- Open VSX, namespace claim template: <https://github.com/EclipseFdn/open-vsx.org/blob/main/.github/ISSUE_TEMPLATE/claim-namespace-ownership.yml>
- Open VSX server source: <https://github.com/eclipse-openvsx/openvsx/tree/main/server/src/main/java/org/eclipse/openvsx>
- open-vsx.org deployment configuration: <https://github.com/EclipseFdn/open-vsx.org/blob/main/configuration/application.yml>
