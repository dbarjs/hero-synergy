---
'hero-synergy': minor
---

The Tree now shows the maps of a repo whose issue tracker is GitHub. It reads them through the `gh` CLI, so run `gh auth login` once if you have not. A row at the top names the repo and says how long ago the tracker was read; the Refresh button reads it again. Click a map's title to open its issue in your browser. When the maps cannot be shown, the Tree says why in one message: no tracker doc, a tracker the Cockpit does not read, a remote that is not on GitHub, `gh` missing or not logged in, or no repo found. If a refresh fails after the maps were shown, they stay on screen with the reason (not logged in, rate-limited, no network, a timeout) and what to do about it.
