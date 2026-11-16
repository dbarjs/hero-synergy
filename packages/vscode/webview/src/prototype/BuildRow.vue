<script setup lang="ts">
// PROTOTYPE (#202) — one build ticket row in the Tree, built on the real Row.vue, and its Focus pane.
import RowSession from '../RowSession.vue'
import Row from '../Row.vue'
import type { BuildTicket } from './model.ts'
import PrLine from './PrLine.vue'
import ProtoFocus from './ProtoFocus.vue'
import { buildActions, launch, play, select, state } from './store.ts'

const props = defineProps<{ ticket: BuildTicket; depth: number }>()

const key = `b:${props.ticket.number}`
const playAction = (): ReturnType<typeof play> => play(buildActions(props.ticket))
</script>

<template>
  <Row
    class="ticket build"
    :class="ticket.place"
    :depth="depth"
    icon="tools"
    :number="ticket.number"
    :label="ticket.title"
    :muted="ticket.place === 'blocked' || ticket.place === 'held' || ticket.place === 'closed'"
    :selected="state.selected === key"
    opens-detail
    @activate="select(key)"
  >
    <button
      v-if="playAction() && ticket.place !== 'claimed'"
      type="button"
      class="play codicon codicon-play"
      :aria-disabled="playAction()!.disabled !== null"
      :title="playAction()!.disabled ?? playAction()!.command ?? ''"
      @click.stop="launch(playAction()!)"
    />
    <RowSession
      v-if="ticket.state === 'open' || ticket.session.kind !== 'none'"
      :session="ticket.session"
    />
    <PrLine v-if="ticket.pr && ticket.state === 'open'" :pr="ticket.pr" chip />
    <span v-if="ticket.place === 'blocked'" class="muted">
      waits on {{ ticket.waitsOn.map((b) => `#${b.number}`).join(' ') }}
    </span>
    <span v-if="ticket.place === 'held'" class="muted">needs info</span>
    <span v-if="ticket.place === 'claimed' && ticket.session.kind === 'none'" class="muted"
      >claimed</span
    >
    <span v-if="ticket.next" class="next">next</span>
    <span v-if="ticket.mode && ticket.state === 'open'" class="mode">{{ ticket.mode }}</span>
  </Row>
  <ProtoFocus v-if="state.selected === key" :item="{ kind: 'build', ticket }" :depth="depth" />
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
.play:hover:not([aria-disabled='true']) {
  color: var(--vscode-textLink-foreground);
}
.play[aria-disabled='true'] {
  opacity: 0.4;
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
