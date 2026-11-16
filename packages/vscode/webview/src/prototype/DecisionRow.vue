<script setup lang="ts">
// PROTOTYPE (#202) — a decision ticket row as the real MapBranch draws it, and its Focus pane.
import RowSession from '../RowSession.vue'
import Row from '../Row.vue'
import type { DecisionTicket } from './model.ts'
import ProtoFocus from './ProtoFocus.vue'
import { decisionActions, launch, play, select, state } from './store.ts'

const props = defineProps<{ ticket: DecisionTicket; depth: number }>()

const key = `t:${props.ticket.number}`
const TYPE_ICONS: Record<string, string> = {
  research: 'search',
  prototype: 'beaker',
  grilling: 'comment-discussion',
  task: 'checklist',
}
const action = (): ReturnType<typeof play> => play(decisionActions(props.ticket))
</script>

<template>
  <Row
    class="ticket"
    :depth="depth"
    :icon="ticket.state === 'closed' ? undefined : (TYPE_ICONS[ticket.type ?? ''] ?? 'question')"
    :number="ticket.number"
    :label="ticket.title"
    :description="ticket.state === 'closed' ? (ticket.gist ?? undefined) : undefined"
    :muted="ticket.place === 'blocked' || ticket.state === 'closed'"
    :selected="state.selected === key"
    opens-detail
    @activate="select(key)"
  >
    <button
      v-if="action()"
      type="button"
      class="play codicon codicon-play"
      :title="action()!.command ?? ''"
      @click.stop="launch(action()!)"
    />
    <RowSession :session="ticket.session" />
    <span v-if="ticket.place === 'blocked'" class="muted">
      waits on {{ ticket.waitsOn.map((b) => `#${b.number}`).join(' ') }}
    </span>
    <span v-if="ticket.place === 'claimed' && ticket.session.kind === 'none'" class="muted"
      >claimed</span
    >
    <span v-if="ticket.next" class="next">next</span>
    <span v-if="ticket.mode && ticket.state === 'open'" class="mode">{{ ticket.mode }}</span>
  </Row>
  <ProtoFocus v-if="state.selected === key" :item="{ kind: 'decision', ticket }" :depth="depth" />
</template>

<style scoped>
.muted {
  color: var(--vscode-descriptionForeground);
}
.play {
  border: 0;
  padding: 0 2px;
  background: none;
  color: var(--vscode-icon-foreground);
  cursor: pointer;
}
.next {
  padding: 0 4px;
  border-radius: 3px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  font-size: 0.8em;
  font-weight: 600;
  line-height: 15px;
  text-transform: uppercase;
}
.mode {
  padding: 0 4px;
  border: 1px solid var(--vscode-descriptionForeground);
  border-radius: 3px;
  color: var(--vscode-descriptionForeground);
  font-size: 0.8em;
  line-height: 13px;
}
</style>
