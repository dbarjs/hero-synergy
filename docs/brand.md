# Brand

Hero Synergy's logo is the **Wayfinder Seal**: a compass needle whose north point is a star, inside a ring of four runes, on a midnight-indigo tile. It shows what the extension does: it finds the way through a wayfinder map. It was chosen on 2026-10-09 from four directions: a compass, a constellation, an H monogram and a crystal cluster.

## Files

The logo lives with the extension, at the paths `packages/vscode/package.json` already points to.

| File                                     | What it is                                                       | Where it's used                                                            |
| ---------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `packages/vscode/media/icon.svg`         | The full-color logo on a 128-unit grid. The source of truth.     | The source of `icon.png`; READMEs and docs outside the Marketplace.        |
| `packages/vscode/media/icon.png`         | A 256 × 256 export of `icon.svg`.                                | `icon` in the manifest: the Marketplace, Open VSX and the Extensions view. |
| `packages/vscode/media/hero-synergy.svg` | A single-color glyph on a 24-unit grid, drawn in `currentColor`. | The activity bar, and anywhere the Cockpit needs a small mark.             |

## Rules

- The registries take only a PNG icon of at least 128 px, and the manifest tests check it. Change `icon.svg`, then export `icon.png` from it (below); never edit the PNG by hand.
- Keep the glyph one color. VS Code uses an activity-bar icon as a mask and paints it with the theme's color, so a second color or an opacity is lost.
- Below 32 px, prefer the glyph to the full-color logo: the ring and the runes blur.
- The extension README is also the Marketplace page, so an image there needs an absolute `https://` URL to a PNG, such as `https://raw.githubusercontent.com/dbarjs/hero-synergy/main/packages/vscode/media/icon.png`. The root README can show `packages/vscode/media/icon.svg` by relative path.
- Don't recolor, stretch, rotate or add effects. Never show the logo beside Matt Pocock's or AI Hero's marks: Hero Synergy is an unofficial companion.

## Colors

| Name     | Hex       | Role                                                              |
| -------- | --------- | ----------------------------------------------------------------- |
| Midnight | `#0F0B30` | The tile's dark end, and the Marketplace banner (`galleryBanner`) |
| Indigo   | `#30258C` | The tile's light end                                              |
| Lavender | `#A9B6FF` | The ring and the runes                                            |
| Gold     | `#FFC94A` | The north needle, the only warm accent                            |

## Exporting the PNG

```sh
pnpm dlx @resvg/resvg-js-cli@2.6.2-beta.1 --fit-width 256 packages/vscode/media/icon.svg packages/vscode/media/icon.png
```
