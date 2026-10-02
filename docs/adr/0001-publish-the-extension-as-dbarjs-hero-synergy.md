# Publish the extension as `dbarjs.hero-synergy`

The extension's publisher ID is `dbarjs`, Eduardo's personal ID, and not the brand `hero-synergy`, even though the npm packages live in the `@hero-synergy` scope. The ID can never be changed once created, and it is also the Open VSX namespace, because both registries read the same `publisher` field. `dbarjs` mirrors the repository (`dbarjs/hero-synergy`), says plainly that a person is behind an unofficial companion, and can be claimed on Open VSX on its own because it matches Eduardo's GitHub ID.

The bare name `hero-synergy` belongs to the extension. An extension's `name` can't be scoped and two workspace packages can't share a name, so the unscoped npm name `hero-synergy` is deliberately not claimed. The scoped names `@hero-synergy/core` and `@hero-synergy/cli` are kept for later: v0.1.0 publishes neither, and if the CLI ships, `npx @hero-synergy/cli` runs the `hero-synergy` bin.

## Considered options

- **Publisher `hero-synergy`.** It matches the npm scope and would move with the project to an organization. Rejected: the ID `hero-synergy.hero-synergy` stutters, a brand publisher reads as more official than the project is, and its Open VSX ownership claim only works after the Marketplace publisher of the same name exists.
- **Giving the bare name to npm**, so that `npx hero-synergy` works. Rejected: the extension would need another name, such as `hero-synergy-vscode`, inside its permanent ID, and npm treats a package published only to hold a name as squatting.

## Consequences

- The extension stays tied to a personal publisher if the project ever moves to an organization. Co-maintainers can be added as members of the publisher.
- Someone else may publish an unscoped `hero-synergy` package on npm. That risk is accepted.
- Never "remove" the extension from the Marketplace to start over: a removed extension's name is reserved forever. Unpublish instead.
