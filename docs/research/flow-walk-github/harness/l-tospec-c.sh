#!/bin/bash
# To spec on map #18 (run C, in clone a), as the Cockpit launches it once #205 is built.
O="$(cd "$(dirname "$0")" && pwd)"
exec "$O/run.sh" a 18 -n '#18 Longest word and longest line' --plugin-dir /workspaces/hero-synergy/.claude/worktrees/225/packages/vscode/claude-plugin '/mattpocock-skills:to-spec https://github.com/dbarjs/flow-walk-throwaway/issues/18'
