#!/bin/bash
# The Implement spec step: end both To tickets sessions with /exit, then launch run A and run B at the same moment.
O="$(cd "$(dirname "$0")" && pwd)"
"$O/type.sh" a tickets-a '/exit'
"$O/type.sh" b spec-b '/exit'
sleep 6
tmux list-windows -t walk -F '#{window_name}'
tmux new-window -d -t walk -n impl-a "$O/l-implspec-a.sh"
tmux new-window -d -t walk -n impl-b "$O/l-implspec-b.sh"
sleep 20
for w in impl-a impl-b; do echo "------ $w"; tmux capture-pane -t "walk:$w" -p | grep -v '^\s*$' | tail -12; done
