# Hero Synergy

An unofficial VS Code cockpit for [Matt Pocock's agent skills](https://github.com/mattpocock/skills): wayfinder maps, frontier tickets and named Claude Code sessions in VS Code terminals.

The extension, its requirements, settings and conventions are described in [`packages/vscode/README.md`](packages/vscode/README.md). The vocabulary is in [`CONTEXT.md`](CONTEXT.md) and the decisions are in [`docs/adr/`](docs/adr).

## Developing

```sh
pnpm install
pnpm exec vp run -r build
pnpm exec vp check
pnpm exec vp test
pnpm exec vp run --filter hero-synergy package
```

## Licence

[MIT](LICENSE)
