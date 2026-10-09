# Which agent identity can open PRs but never merge?

Research for [#160](https://github.com/dbarjs/hero-synergy/issues/160), part of the map "Only Eduardo merges to main" ([#159](https://github.com/dbarjs/hero-synergy/issues/159)). Researched 2026-10-09 from GitHub's own docs, REST reference, changelog and Terms of Service. A claim with no primary source is marked **unconfirmed**.

## Starting point

- `dbarjs/hero-synergy` is a public repository owned by the personal account `dbarjs`.
- Agent sessions use Eduardo's `gho_` OAuth token (repo scope, admin) from the shared `~/.config/gh` volume.
- Ruleset "Protect main" (id `24813840`) targets `~DEFAULT_BRANCH`. It blocks deletion and non-fast-forward pushes, requires a pull request with `required_approving_review_count: 0` and `require_last_push_approval: false`, and requires the `check`, `vscode (linux)` and `vscode (macos)` checks. `bypass_actors` is empty and the API reports `current_user_can_bypass: "never"` for `dbarjs` (from `gh api repos/dbarjs/hero-synergy/rulesets/24813840`, 2026-10-09).

So today any identity that can open a PR can also merge it once CI is green, because the ruleset requires zero approvals.

## Facts that apply to every option

1. **Pushing a branch and merging a PR need the same permission.** `PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge` is in the **Contents: write** group, the same permission that lets a token push branches. This holds for GitHub App tokens ([permissions for GitHub Apps, "Contents"](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps#repository-permissions-for-contents)) and for fine-grained PATs ([permissions for fine-grained PATs](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)). Token permissions can't separate "push" from "merge", so only the ruleset can block the merge.
2. **Changing rulesets or repo settings needs Administration: write.** `POST/PUT/DELETE /repos/{owner}/{repo}/rulesets` and `PATCH /repos/{owner}/{repo}` are in the **Administration** group ([GitHub Apps](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps#repository-permissions-for-administration), [fine-grained PATs](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)). A credential that lacks Administration can't weaken the ruleset.
3. **A PR author can't approve their own PR.** The docs say: "Pull request authors cannot approve their own pull requests." ([Approving a pull request with required reviews](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/approving-a-pull-request-with-required-reviews))
4. **The ruleset rules that matter:**
   - `required_approving_review_count` sets "the number of approving reviews that are required before a pull request can be merged".
   - `require_last_push_approval` means "the most recent reviewable push must be approved by someone other than the person who pushed it".
   - `dismiss_stale_reviews_on_push` means new reviewable commits dismiss earlier approvals.

   Sources: [REST: repository rules](https://docs.github.com/en/rest/repos/rules) and [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#require-a-pull-request-before-merging). Required approvals come "from people with write permissions in the repository or from a designated code owner" ([same page](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#require-a-pull-request-before-merging)).

5. **Who can be a bypass actor.** Bypass actors are listed by `actor_type`: `Integration`, `OrganizationAdmin`, `RepositoryRole`, `Team`, `DeployKey` or `User`. `bypass_mode` is `always`, `pull_request` ("an actor can only bypass rules on pull requests") or `exempt` ([REST: repository rules](https://docs.github.com/en/rest/repos/rules)). Bypass can go to "Repository admins", "the maintain or write role", teams, GitHub Apps and Dependabot ([Creating rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository#granting-bypass-permissions-for-your-branch-or-tag-ruleset)). Since 2026-05-07, an individual user can also be a bypass actor on a repository ruleset ([changelog](https://github.blog/changelog/2026-05-07-repository-rulesets-user-bypass-and-branch-renaming/)). In "For pull requests only" mode, "the actor can then choose to bypass any branch protections and merge that pull request" ([Creating rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository#granting-bypass-permissions-for-your-branch-or-tag-ruleset)).
6. **A personal-account repo has only one collaborator level.** "Collaborators have a single permission level". Collaborators can "Create, merge, and close pull requests", manage issues and create releases. Only the owner can invite collaborators, manage deploy keys and webhooks, and change visibility and security settings ([Permission levels for a personal account repository](https://docs.github.com/en/account-and-profile/reference/permission-levels-for-a-personal-account-repository)). The same page says the owner can "Merge a pull request on a protected branch, even if there are no approving reviews". Today's ruleset still reports `current_user_can_bypass: "never"` for `dbarjs`, so it is **unconfirmed** whether that owner privilege survives a ruleset with an empty bypass list. In practice, assume it does not.
7. **Workflows still run.** Events caused by a GitHub App installation token or a PAT trigger workflows, unlike `GITHUB_TOKEN` ([Triggering a workflow](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow)). So CI runs on PRs opened by any of the three identities.

## The key question: does admin bypass follow the user's role or the token's permissions?

**Unconfirmed. No primary source answers it.** The ruleset pages ([about](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets), [creating](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository), [available rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)), the [REST rules reference](https://docs.github.com/en/rest/repos/rules) and the [user-bypass changelog](https://github.blog/changelog/2026-05-07-repository-rulesets-user-bypass-and-branch-renaming/) never mention tokens when they describe bypass. They only name actors: roles, users, teams, apps and deploy keys.

What the docs do establish:

- A token "has the same capabilities ... that the owner of the token has, and is further limited by any scopes or permissions granted to the token" ([Managing your personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#about-personal-access-tokens)). This says token permissions limit which endpoints a token can call. It doesn't say whether a ruleset bypass check, inside an endpoint the token may call (merge needs only Contents: write), looks at the user's role or at the token's permissions.
- Bypass actor types include `User` and `RepositoryRole`, and none is token-based ([REST: repository rules](https://docs.github.com/en/rest/repos/rules)). `current_user_can_bypass` is reported per authenticated user.

Reading only the documented model, a fine-grained PAT owned by `dbarjs` acts as `dbarjs`, the repository admin. If "Repository admin" or the user `dbarjs` is on the bypass list, that PAT would bypass too. This reading is an **inference, not documented**.

**Cheap way to settle it (needs Eduardo):** make a fine-grained PAT with Metadata: read, Contents: write and Pull requests: write but no Administration. Temporarily add a bypass actor, then call `GET /repos/dbarjs/hero-synergy/rulesets/24813840` with that PAT and read `current_user_can_bypass`. `GET .../rulesets/{id}` needs only Metadata: read ([permissions for GitHub Apps, "Metadata"](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps#repository-permissions-for-metadata); the fine-grained PAT table lists the same endpoint). This session did not run the test, because it must not change rulesets.

## Option 1: GitHub App, with agents minting installation tokens

- **What stops its merge.** The App has no repository role. It is only a bypass actor if it is added as an `Integration`, so leave it off the list. Set `required_approving_review_count: 1`. The App authors its PRs, so it can't approve them (fact 3). Add `require_last_push_approval: true` (or `dismiss_stale_reviews_on_push: true`) so the App can't push a new commit after Eduardo approves and then merge on the stale approval ([available rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#require-a-pull-request-before-merging)).
- **Can Eduardo still merge?** Yes, by approving and then merging. He isn't the PR author, so his approval counts, and no bypass is needed. If he wants a one-click merge without approving, add `User: dbarjs` with `bypass_mode: pull_request` ([changelog](https://github.blog/changelog/2026-05-07-repository-rulesets-user-bypass-and-branch-renaming/)). Doing so brings back the open question above for any session that still holds Eduardo's own token.
- **Settings.** Grant Contents, Pull requests, Issues and Metadata, and never Administration. A token "cannot receive permissions the app itself wasn't granted", and each mint can be narrowed further with `permissions` and `repositories` ([Generating an installation access token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)).
- **Author.** "API requests made by an app installation are attributed to the app" ([Authenticating as an installation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)). GitHub Apps "indicate that the action was performed by the app" ([Deciding when to build a GitHub App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/deciding-when-to-build-a-github-app)). The `<slug>[bot]` display name is **unconfirmed** in the pages read here.
- **Commit signing.** Locally made commits keep whatever author git is configured with, and the App has no key of its own to sign them. GitHub marks bot commits as verified only when they are created through the API while authenticated as the App, "without custom author, committer, or signature information" ([About commit signature verification](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)). The ruleset doesn't require signed commits, so this is cosmetic unless a "require signed commits" rule is added.
- **Cost.** An installation token "will expire after 1 hour" ([Authenticating as an installation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)). Agents need a small helper that signs a JWT with the App's private key and calls `POST /app/installations/{id}/access_tokens` ([Generating an installation access token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)). Git uses the token as `https://x-access-token:TOKEN@github.com/...` ([same page as above](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)). The private key becomes the long-lived secret in the devcontainer, but what it can do is capped by the App's permissions. Whether `gh` can mint App tokens natively is **unconfirmed**; plan on a helper script.
- **ToS.** Apps "are not tied to a user account and do not consume a seat" ([Deciding when to build a GitHub App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/deciding-when-to-build-a-github-app)). The machine-account limit doesn't apply.
- **What it can still do.**
  - Create tags and refs (`POST .../git/refs` is Contents: write).
  - Edit issues (Issues: write).
  - Dispatch workflows if granted Actions: write.
  - Edit `.github/workflows/*` only if granted Workflows: write ([permissions for GitHub Apps](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps)).
  - Releases run only on pushes to `main` (`.github/workflows/release.yml`), so an App that can't merge can't release.
- **Wayfinder effects.** Sub-issues and blocked-by edges use the Issues endpoints. That those endpoints accept installation tokens, and that `--add-assignee @me` means anything for an App, are both **unconfirmed**. Assign `dbarjs` explicitly instead of `@me`.

## Option 2: machine user added as a collaborator

- **What stops its merge.** A collaborator on a personal repo can merge PRs (fact 6), so `required_approving_review_count: 1` plus `require_last_push_approval: true` is again the gate. The machine user can't approve its own PRs (fact 3). It isn't an admin, so a `RepositoryRole: admin` bypass doesn't reach it.
- **Can Eduardo still merge?** Yes, by approving and merging, the same as option 1.
- **Settings.** Collaborators can't change settings, rulesets or collaborators (fact 6).
- **Author.** PRs and API actions show the machine user. Local commits use whatever author is configured. The machine user can register its own SSH or GPG signing key, so its commits verify on their own. Unlike today, they wouldn't depend on Eduardo's signing agent ([About commit signature verification](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)).
- **Token type.** Fine-grained PATs can't be used "to contribute to repositories where the user is an outside or repository collaborator" ([Managing your personal access tokens, limitations](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#fine-grained-personal-access-tokens-limitations)). The machine user therefore needs a **classic PAT** (`repo` scope, plus `workflow` if it edits workflow files). A classic PAT reaches every repo that account can reach, which is just this one if it is a collaborator nowhere else.
- **Cost.** A classic PAT can be set to never expire. GitHub removes tokens that go unused for a year ([same page](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)). Rotation is manual. It is the simplest drop-in: `gh auth login --with-token` under a separate `GH_CONFIG_DIR`.
- **ToS.** "You may maintain no more than one free machine account in addition to your free Personal Account." A human must set it up and stays "ultimately responsible for the machine's actions" ([GitHub Terms of Service, B.3](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#3-account-requirements)). This uses up Eduardo's one free machine account.
- **What it can still do.** Push tags, create releases, manage issues and comments (fact 6), and trigger workflows.

## Option 3: fine-grained PAT on Eduardo's own account (Contents and Pull requests write, no Administration)

- **What stops its merge.** Every PR is authored by `dbarjs`. With `required_approving_review_count: 0` (today), nothing stops it: the merge endpoint needs only Contents: write (fact 1). With approvals ≥ 1, nobody but `dbarjs` can approve, and `dbarjs` can't approve his own PR (fact 3). So every PR would be stuck for Eduardo too.
- **Can Eduardo still merge?** Only through bypass (`RepositoryRole: admin` or `User: dbarjs`). Whether bypass then also applies to the agent's PAT, which lacks Administration, is the **unconfirmed** question above. The documented model (bypass actors are users and roles, and a token acts as its owner) points to "yes, the PAT bypasses too", and that would defeat the gate. Even if GitHub did check token permissions, the guarantee would rest on undocumented behavior.
- **Settings.** Without Administration the PAT can't edit rulesets or settings (fact 2). That is the one thing this option does deliver.
- **Author.** Eduardo is the author of everything. The signing problem stays as it is today, because agent commits need Eduardo's key.
- **Cost.** Fine-grained PAT expiry is configurable (the API's `expires_in` accepts 1 to 366 days or `none`) ([Managing your personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)). No ToS issue.
- **What it can still do.** Anything Eduardo can do within the token's permissions. It also can't reach Projects owned by a user account ([limitations](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#fine-grained-personal-access-tokens-limitations)).

## A prerequisite for any option

The new identity only helps if agent sessions **can't reach Eduardo's `gho_` token**. Today it sits in the shared `~/.config/gh` volume that every container mounts. While an agent can read it, the agent is `dbarjs`, and whatever bypass Eduardo grants himself is open to the agent too. Any credential change has to move Eduardo's token out of the agents' reach, or point agents at a separate `GH_CONFIG_DIR`. How to do that belongs to a follow-up ticket.

## Comparison

|                                    | GitHub App                                                           | Machine user (collaborator)                                | Fine-grained PAT on `dbarjs`                                                                              |
| ---------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Rule that blocks the agent's merge | approvals ≥ 1 + `require_last_push_approval`; App not on bypass list | approvals ≥ 1 + `require_last_push_approval`; not an admin | none that works reliably: approvals also block Eduardo, and bypass probably reaches the PAT (unconfirmed) |
| How Eduardo merges                 | approve, then merge (no bypass needed)                               | approve, then merge (no bypass needed)                     | only via bypass, which may also open the gate to the agent                                                |
| Can change settings or rulesets    | no (no Administration)                                               | no (collaborator)                                          | no (no Administration)                                                                                    |
| PR author                          | the App (bot)                                                        | machine user                                               | `dbarjs`                                                                                                  |
| Commit signing                     | local commits unverified unless made through the API as the App      | own SSH/GPG key, verified independently of Eduardo         | needs Eduardo's key (today's refusals continue)                                                           |
| Credential                         | private key + 1-hour tokens via a helper                             | classic PAT (fine-grained can't be used as collaborator)   | fine-grained PAT, up to 366 days or no expiry                                                             |
| ToS                                | no seat, no machine-account limit                                    | uses the one free machine account                          | none                                                                                                      |
| Tags, issues, workflows            | per granted permission                                               | yes                                                        | yes                                                                                                       |
| Setup effort                       | highest (register App, install, token helper)                        | low (account, invite, PAT)                                 | lowest                                                                                                    |

## Recommendation

**Use a GitHub App** with Contents, Pull requests, Issues and Metadata write or read as needed, never Administration. Leave it off the bypass list, and change "Protect main" to:

- `required_approving_review_count: 1`
- `require_last_push_approval: true`
- `dismiss_stale_reviews_on_push: true`

Eduardo merges by approving the App's PR and clicking merge. No bypass actor is needed, so the gate doesn't depend on the unconfirmed role-versus-token question. The App also costs no machine account, its tokens expire after an hour, and it can't edit the ruleset.

**Fallback:** a machine user with a classic PAT gives the same gate with less setup. It costs the one free machine account and a long-lived classic token.

**Reject option 3.** On a personal repo, its PRs can only merge through a bypass that the agent most likely inherits.

**Before any of this matters,** take Eduardo's `gho_` token out of the agents' reach.

### Unconfirmed

- Whether a `RepositoryRole: admin` or `User` bypass applies to a fine-grained PAT without Administration. There is no primary source; the test is described above.
- Whether the owner's documented "merge without approving reviews" privilege on personal repos survives a ruleset with an empty bypass list. `current_user_can_bypass: "never"` suggests it does not.
- The `<slug>[bot]` author name for App PRs; native App-token minting in `gh`; installation-token support for the sub-issue and dependency endpoints; and `@me` assignment for an App.
