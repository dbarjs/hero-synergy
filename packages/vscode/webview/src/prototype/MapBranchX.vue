<script setup lang="ts">
// PROTOTYPE (#202) — the real MapBranch's shape (map row, ⚑ Map, open tickets, Fog, Decisions),
// with a slot after the open tickets where variant A puts the map's spec, and an optional trail
// that shows the spec's counts on a finished map.
import { computed } from 'vue'

import Row from '../Row.vue'
import DecisionRow from './DecisionRow.vue'
import MapFolds from './MapFolds.vue'
import MapItem from './MapItem.vue'
import type { DecisionTicket, MapModel, SpecModel } from './model.ts'
import { isOpen, toggle } from './store.ts'

const props = defineProps<{
  map: MapModel
  depth: number
  muted?: boolean
  description?: string
  /** Variant A: a finished map whose spec is being built shows the spec's counts instead. */
  specTrail?: SpecModel
}>()

const key = computed(() => `map:${props.map.number}`)
const PLACE = { claimed: 0, frontier: 1, held: 2, blocked: 3, closed: 4 } as const
const open = computed<DecisionTicket[]>(() =>
  props.map.tickets
    .filter((t) => t.state === 'open')
    .map((t, index) => ({ t, index }))
    .sort((a, b) => PLACE[a.t.place] - PLACE[b.t.place] || a.index - b.index)
    .map(({ t }) => t),
)
</script>

<template>
  <Row
    :depth="depth"
    :expanded="isOpen(key)"
    :number="map.number"
    :label="map.title"
    :description="description"
    :muted="muted"
    @activate="toggle(key)"
  >
    <template v-if="specTrail">
      <span v-if="specTrail.needsYou > 0" class="needs">{{ specTrail.needsYou }} needs you</span>
      <span class="codicon codicon-file-text spec-mark" :title="`spec #${specTrail.number}`" />
      <template v-if="specTrail.status === 'no-tickets'">
        <span class="muted">no tickets yet</span>
      </template>
      <template v-else>
        <span class="takeable" :class="{ none: specTrail.takeable === 0 }">
          {{ specTrail.takeable === 0 ? 'nothing takeable' : `${specTrail.takeable} takeable` }}
        </span>
        <span class="muted" title="built of total"
          >{{ specTrail.built }}/{{ specTrail.total }}</span
        >
      </template>
    </template>
    <template v-else>
      <span v-if="map.needsYou > 0" class="needs">{{ map.needsYou }} needs you</span>
      <span v-if="!map.finished" class="takeable" :class="{ none: map.takeable === 0 }">
        {{ map.takeable === 0 ? 'nothing takeable' : `${map.takeable} takeable` }}
      </span>
      <span class="muted" title="decided of total">{{ map.decided }}/{{ map.total }}</span>
    </template>
  </Row>

  <template v-if="isOpen(key)">
    <MapItem :map="map" :depth="depth + 1" />
    <DecisionRow v-for="ticket in open" :key="ticket.number" :ticket="ticket" :depth="depth + 1" />
    <slot name="after-tickets" />
    <MapFolds :map="map" :depth="depth + 1" />
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
.spec-mark {
  color: var(--vscode-descriptionForeground);
}
</style>
