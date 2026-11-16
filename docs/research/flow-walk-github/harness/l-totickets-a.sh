#!/bin/bash
# To tickets on spec #10, as the Cockpit launches it once #205 is built: tracked, named after the spec,
# resuming the map's ended To spec conversation by id.
O="$(cd "$(dirname "$0")" && pwd)"
exec "$O/run.sh" a 10 --resume 99f80418-23b9-49dc-b510-8935555af943 -n '#10 Spec: word, line and character counts' --plugin-dir /workspaces/hero-synergy/.claude/worktrees/225/packages/vscode/claude-plugin '/mattpocock-skills:to-tickets https://github.com/dbarjs/flow-walk-throwaway/issues/10'
