#!/bin/bash
# Implement spec on spec #27, run C: no -w, in a repo whose CLAUDE.md says work closes through pull requests.
O="$(cd "$(dirname "$0")" && pwd)"
exec "$O/run.sh" a 27 --permission-mode bypassPermissions -n '#27 Spec: longest word and longest line (`longest-word`, `longest-line`, `longest`)' --plugin-dir /workspaces/hero-synergy/.claude/worktrees/225/packages/vscode/claude-plugin '/mattpocock-skills:implement-spec https://github.com/dbarjs/flow-walk-throwaway/issues/27'
