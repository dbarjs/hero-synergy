#!/bin/bash
# The To tickets step of the walk, two ways:
#   A: /exit the To spec session, then resume it by id with /to-tickets (the Cockpit's way, #205).
#   B: type /to-tickets into the To spec session that is still open (upstream's own way).
O="$(cd "$(dirname "$0")" && pwd)"
"$O/type.sh" a spec-a '/exit'
sleep 5
"$O/type.sh" b spec-b '/mattpocock-skills:to-tickets https://github.com/dbarjs/flow-walk-throwaway/issues/9'
tmux new-window -d -t walk -n tickets-a "$O/l-totickets-a.sh"
tmux list-windows -t walk -F '#{window_name}'
