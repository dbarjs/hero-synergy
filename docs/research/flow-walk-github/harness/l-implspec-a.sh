#!/bin/bash
# Implement spec on spec #10, run A: no -w, so the session works in the checkout it is launched in.
# Tracked, named after the spec, bypass on because every open build ticket is ready-for-agent (#204).
O="$(cd "$(dirname "$0")" && pwd)"
exec "$O/run.sh" a 10 --permission-mode bypassPermissions -n '#10 Spec: word, line and character counts' --plugin-dir /workspaces/hero-synergy/.claude/worktrees/225/packages/vscode/claude-plugin '/mattpocock-skills:implement-spec https://github.com/dbarjs/flow-walk-throwaway/issues/10'
