#!/bin/bash
# To spec on map #1, as the Cockpit launches it once #205 is built: tracked, named after the map, no -w.
O="$(cd "$(dirname "$0")" && pwd)"
exec "$O/run.sh" a 1 -n '#1 Word, line and character counts' --plugin-dir /workspaces/hero-synergy/.claude/worktrees/225/packages/vscode/claude-plugin '/mattpocock-skills:to-spec https://github.com/dbarjs/flow-walk-throwaway/issues/1'
