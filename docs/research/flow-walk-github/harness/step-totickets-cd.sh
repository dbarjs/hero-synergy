#!/bin/bash
# The To tickets step for runs C and D, the same two ways as for A and B:
#   C: /exit the To spec session, then resume it by id with /to-tickets.
#   D: type /to-tickets into the To spec session that is still open.
O="$(cd "$(dirname "$0")" && pwd)"
"$O/type.sh" a spec-c '/exit'
sleep 5
"$O/type.sh" b spec-d '/mattpocock-skills:to-tickets https://github.com/dbarjs/flow-walk-throwaway/issues/26'
tmux new-window -d -t walk -n tickets-c "$O/l-totickets-c.sh"
tmux list-windows -t walk -F '#{window_name}'
