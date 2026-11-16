<script setup lang="ts">
// PROTOTYPE (#202) — a spec and what unfolds under it, built on the real Row.vue:
// the spec row (counts, state, ▶), a ▤ Spec item that opens its Focus pane, the open build tickets
// (claimed, then the frontier with `next`, then held, then blocked), and a folded ✓ Built node.
// Variant D also puts the map it came from inside, as a ⚑ Map item with its decisions folded.
import { computed } from 'vue'

import Row from '../Row.vue'
import BuildRow from './BuildRow.vue'
import MapFolds from './MapFolds.vue'
import MapItem from './MapItem.vue'
import type { BuildTicket, MapModel, SpecModel } from './model.ts'
import ProtoFocus from './ProtoFocus.vue'
import { isOpen, launch, play, select, specActions, state, toggle } from './store.ts'

const props = defineProps<{
  spec: SpecModel
  depth: number
  /** Muted text after the title: where the spec came from, in the variants that need to say. */
  description?: string
  /** Variant D: the map lives inside its spec. */
  map?: MapModel
  muted?: boolean
}>()

const key = computed(() => `spec:${props.spec.number}`)
const itemKey = computed(() => `specitem:${props.spec.number}`)
const builtKey = computed(() => `built:${props.spec.number}`)

const PLACE_ORDER = { claimed: 0, frontier: 1, held: 2, blocked: 3, closed: 4 } as const
const open = computed<BuildTicket[]>(() =>
  props.spec.tickets
    .filter((t) => t.state === 'open')
    .map((t, index) => ({ t, index }))
    .sort((a, b) => PLACE_ORDER[a.t.place] - PLACE_ORDER[b.t.place] || a.index - b.index)
    .map(({ t }) => t),
)
const closed = computed(() => props.spec.tickets.filter((t) => t.state === 'closed'))

const playAction = computed(() => play(specActions(props.spec)))
</script>

<template>
  <Row
    class="spec"
    :depth="depth"
    :expanded="isOpen(key)"
    icon="file-text"
    :number="spec.number"
    :label="spec.title"
    :description="description"
    :muted="muted"
    @activate="toggle(key)"
  >
    <button
      v-if="playAction"
      type="button"
      class="play codicon codicon-play"
      :title="`${playAction.label}: ${playAction.command}`"
      @click.stop="launch(playAction)"
    />
    <span
      v-if="spec.needsYou > 0"
      class="needs"
      :title="`${spec.needsYou} build session needs you`"
    >
      {{ spec.needsYou }} needs you
    </span>
    <template v-if="spec.status === 'no-tickets'">
      <span class="muted">no tickets yet</span>
    </template>
    <template v-else-if="spec.status === 'built'">
      <span class="built codicon codicon-pass-filled" title="every build ticket closed" />
      <span class="muted" title="built of total">{{ spec.built }}/{{ spec.total }}</span>
    </template>
    <template v-else>
      <span class="takeable" :class="{ none: spec.takeable === 0 }">
        {{ spec.takeable === 0 ? 'nothing takeable' : `${spec.takeable} takeable` }}
      </span>
      <span class="muted" title="built of total">{{ spec.built }}/{{ spec.total }}</span>
    </template>
  </Row>

  <template v-if="isOpen(key)">
    <MapItem v-if="map" :map="map" :depth="depth + 1" titled />

    <Row
      :depth="depth + 1"
      icon="book"
      label="Spec"
      :description="spec.problem"
      :title="spec.problem"
      muted
      :selected="state.selected === itemKey || state.selected === key"
      opens-detail
      @activate="select(itemKey)"
    />
    <ProtoFocus
      v-if="state.selected === itemKey || state.selected === key"
      :item="{ kind: 'spec', spec }"
      :depth="depth + 1"
    />

    <BuildRow v-for="ticket in open" :key="ticket.number" :ticket="ticket" :depth="depth + 1" />

    <template v-if="closed.length > 0">
      <Row
        :depth="depth + 1"
        :expanded="isOpen(builtKey)"
        icon="check"
        label="Built"
        muted
        @activate="toggle(builtKey)"
      >
        <span class="muted">{{ closed.length }}</span>
      </Row>
      <template v-if="isOpen(builtKey)">
        <BuildRow
          v-for="ticket in closed"
          :key="ticket.number"
          :ticket="ticket"
          :depth="depth + 2"
        />
      </template>
    </template>

    <MapFolds v-if="map" :map="map" :depth="depth + 1" />
  </template>
</template>

<style scoped>
.takeable {
  padding: 0 6px;
  border-radius: 8px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  font-size: 0.85em;
  line-height: 16px;
}
.takeable.none,
.muted {
  color: var(--vscode-descriptionForeground);
  background: none;
}
.needs {
  color: var(--vscode-editorWarning-foreground);
  font-weight: 600;
}
.built {
  color: var(--vscode-charts-green);
}
.play {
  border: 0;
  padding: 0 2px;
  background: none;
  color: var(--vscode-icon-foreground);
  cursor: pointer;
}
.play:hover {
  color: var(--vscode-textLink-foreground);
}
</style>
