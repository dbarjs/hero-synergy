# Agents act as the dbarjs-agent App

Only Eduardo merges to `main`. Agent sessions push branches, open PRs and edit issues as `dbarjs-agent[bot]`. This is a private GitHub App owned by `dbarjs` and installed on selected repos, hero-synergy first. Its permissions are Contents, Pull requests, Issues and Workflows write, plus Metadata read. It has no Administration, Actions write or Secrets, and it is never a ruleset bypass actor. Eduardo merges from the GitHub web UI, or with `gh` on his host. Decided in [Pick the agent's GitHub identity](https://github.com/dbarjs/hero-synergy/issues/161), from the research in [Which agent identity can open PRs but never merge?](https://github.com/dbarjs/hero-synergy/issues/160).

Any rule set under Eduardo's identity can be bypassed or deleted by that same identity, so the gate needs a second identity that doesn't hold his admin role. The gate is on the branch, not the review. One ruleset restricts updates to `main`, and only the repository admin role is exempt. In a personal repo, that role is the owner alone. The App can push branches and open PRs, but it can never move `main`, even on an approved PR. A second ruleset, with no bypass at all, holds everyone, Eduardo included, to a PR with green checks and signed commits. The rulesets are set out in [Settle the final main ruleset](https://github.com/dbarjs/hero-synergy/issues/162).

Agents and Eduardo's shell run as the same Unix user in the devcontainer, so nothing in the container can be Eduardo's admin login. The App's private key may sit in the container where agents can read it: anyone holding it can mint tokens, but only with the App's own narrow power. The guarded case is a well-meaning agent following stale instructions, like the `--auto` merges of PRs 98 and 111. Defending against an agent that hunts for credentials is out of scope. The forwarded SSH agent can push branches as `dbarjs`, but it can't merge, and the ruleset stops it pushing to `main`.

## Considered options

- **A fine-grained PAT on `dbarjs`.** Rejected: whatever lets Eduardo merge, an exemption or a bypass, the agent's PAT would share it, by the documented model.
- **An approval gate instead of a branch gate.** One approval from someone other than the last pusher, and no bypass. Rejected for three reasons:
  - Merging needs only Contents: write, so the App could merge any PR Eduardo had approved.
  - Eduardo couldn't merge PRs he authored himself.
  - "Allow GitHub Actions to create and approve pull requests" stays on for the Release PR, so a workflow on an agent's branch could approve that agent's PR.
- **A machine user with the Write role.** Gives the same gate, but needs a classic PAT, because fine-grained PATs don't cover collaborators, and it uses GitHub's one free machine account. Kept as the fallback.
- **One App per repo.** Rejected: Eduardo runs many maps across many repos from one shared devcontainer image, so a new repo should only need a new installation.

## Consequences

- Both `gh` and `git push` use the App token, through `gh auth git-credential` for `github.com`, so every push and PR an agent makes shows as the agent's.
- Until agents stop holding Eduardo's admin token, they are exempt from the update rule exactly as he is. The gate only binds them once that token leaves the container.
- Glossary and ADR edits reach `main` by PR, like everything else.
- Wayfinder claims assign `dbarjs` by name, because `@me` would resolve to the bot.
- Installation tokens expire after an hour, so long sessions need a minting wrapper, not a stored token.
- Commit signing and authorship are separate. Commits may still be signed with Eduardo's key whichever identity pushes them.
