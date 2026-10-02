#!/bin/bash
# tmux driver: t.sh start <name> [claude args] | say <name> <text> | key <name> <keys...> | shot <name> | ev <name>
S=/tmp/claude-1000/-workspaces-hero-synergy/ed2b1586-4c1c-49c8-afd5-e725ccf53344/scratchpad
cmd=$1; name=$2; shift 2
case $cmd in
  start) tmux new-session -d -s $name -x 160 -y 45 "$S/cc.sh $name $(printf '%q ' "$@")" ;;
  say) tmux send-keys -t $name -l "$1"; sleep 0.5; tmux send-keys -t $name Enter ;;
  key) tmux send-keys -t $name "$@" ;;
  shot) tmux capture-pane -t $name -p | grep -v '^\s*$' | tail -${1:-25} ;;
  ev) echo "--- events (seed plugin)"; jq -r '[.at, .hook, .detail // "-", .session[0:8]] | @tsv' $S/out/$name.events.jsonl
      echo "--- probe (ground truth)"; jq -r '[.at, .hook, (.input.source // .input.reason // .input.notification_type // .input.tool_name // .input.trigger // .input.error // "-"), (.input.agent_type // "main"), .input.session_id[0:8]] | @tsv' $S/out/$name.probe.jsonl ;;
esac
