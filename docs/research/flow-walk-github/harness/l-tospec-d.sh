#!/bin/bash
# To spec on map #22 (run D, in clone b), as the Cockpit launches it once #205 is built.
O="$(cd "$(dirname "$0")" && pwd)"
exec "$O/run.sh" b 22 -n '#22 Digit and punctuation counts' --plugin-dir /workspaces/hero-synergy/.claude/worktrees/225/packages/vscode/claude-plugin '/mattpocock-skills:to-spec https://github.com/dbarjs/flow-walk-throwaway/issues/22'
