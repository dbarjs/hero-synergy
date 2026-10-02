#!/bin/bash
# usage: cc.sh <scenario> [claude args...]; runs claude in the sandbox with the status + probe plugins
name=$1; shift
for v in $(env | grep -E '^(CLAUDE_CODE_|CLAUDECODE|CLAUDE_PID|CLAUDE_EFFORT)' | cut -d= -f1); do unset $v; done
export HERO_SYNERGY_TICKET="https://github.com/dbarjs/hero-synergy/issues/6#$name"
export HERO_SYNERGY_EVENTS=/tmp/claude-1000/-workspaces-hero-synergy/ed2b1586-4c1c-49c8-afd5-e725ccf53344/scratchpad/out/$name.events.jsonl
export HERO_SYNERGY_PROBE=/tmp/claude-1000/-workspaces-hero-synergy/ed2b1586-4c1c-49c8-afd5-e725ccf53344/scratchpad/out/$name.probe.jsonl
cd /tmp/claude-1000/-workspaces-hero-synergy/ed2b1586-4c1c-49c8-afd5-e725ccf53344/scratchpad/sandbox
exec claude --plugin-dir /workspaces/hero-synergy/.claude/worktrees/status-hooks/packages/vscode/claude-plugin --plugin-dir /workspaces/hero-synergy/.claude/worktrees/status-hooks/prototype/status-hooks/probe-plugin \
  --settings '{"remoteControlAtStartup":false,"inputNeededNotifEnabled":false,"agentPushNotifEnabled":false}' \
  --debug-file /tmp/claude-1000/-workspaces-hero-synergy/ed2b1586-4c1c-49c8-afd5-e725ccf53344/scratchpad/out/$name.debug.log --model haiku "$@"
