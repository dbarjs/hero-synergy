#!/bin/bash
# The Implement spec step for runs C and D: end both To tickets sessions with /exit, then launch both at the same moment.
O="$(cd "$(dirname "$0")" && pwd)"
"$O/type.sh" a tickets-c '/exit'
"$O/type.sh" b spec-d '/exit'
sleep 6
tmux list-windows -t walk -F '#{window_name}'
tmux new-window -d -t walk -n impl-c "$O/l-implspec-c.sh"
tmux new-window -d -t walk -n impl-d "$O/l-implspec-d.sh"
sleep 20
for w in impl-c impl-d; do echo "------ $w"; tmux capture-pane -t "walk:$w" -p | grep -v '^\s*$' | tail -8 | cut -c1-200; done
