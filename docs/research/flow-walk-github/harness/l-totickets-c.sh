#!/bin/bash
# To tickets on spec #27 (run C), resuming the map's ended To spec conversation by id.
O="$(cd "$(dirname "$0")" && pwd)"
exec "$O/run.sh" a 27 --resume 22d35935-6754-4eb3-95b8-5d1446785ed2 -n '#27 Spec: longest word and longest line (`longest-word`, `longest-line`, `longest`)' --plugin-dir /workspaces/hero-synergy/.claude/worktrees/225/packages/vscode/claude-plugin '/mattpocock-skills:to-tickets https://github.com/dbarjs/flow-walk-throwaway/issues/27'
