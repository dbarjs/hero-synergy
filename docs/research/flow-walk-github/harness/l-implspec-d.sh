#!/bin/bash
# Implement spec on spec #26, run D: under -w 26, in a repo whose CLAUDE.md says work closes through pull requests.
O="$(cd "$(dirname "$0")" && pwd)"
exec "$O/run.sh" b 26 --permission-mode bypassPermissions -n '#26 Spec: digit and punctuation counts (`digits`, `punctuation`, `symbols`)' -w 26 --plugin-dir /workspaces/hero-synergy/.claude/worktrees/225/packages/vscode/claude-plugin '/mattpocock-skills:implement-spec https://github.com/dbarjs/flow-walk-throwaway/issues/26'
