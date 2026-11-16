#!/bin/bash
# Implement spec on spec #9, run B: under -w 9, the spec's number, as Implement uses -w <ticket number> (#206).
# Tracked, named after the spec, bypass on because every open build ticket is ready-for-agent (#204).
O="$(cd "$(dirname "$0")" && pwd)"
exec "$O/run.sh" b 9 --permission-mode bypassPermissions -n '#9 Spec: sentence and paragraph counts (`sentences`, `paragraphs`, `structure`)' -w 9 --plugin-dir /workspaces/hero-synergy/.claude/worktrees/225/packages/vscode/claude-plugin '/mattpocock-skills:implement-spec https://github.com/dbarjs/flow-walk-throwaway/issues/9'
