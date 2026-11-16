<script setup lang="ts">
// PROTOTYPE (#202) — a map's ≋ Fog and ✓ Decisions folds, as the real MapBranch draws them.
import Row from '../Row.vue'
import DecisionRow from './DecisionRow.vue'
import type { MapModel } from './model.ts'
import { isOpen, scene, toggle } from './store.ts'

const props = defineProps<{ map: MapModel; depth: number }>()

const fogKey = `fog:${props.map.number}`
const decKey = `dec:${props.map.number}`
const closed = () => props.map.tickets.filter((t) => t.state === 'closed')
void scene
</script>

<template>
  <template v-if="map.fog.length > 0">
    <Row
      :depth="depth"
      :expanded="isOpen(fogKey)"
      icon="cloud"
      label="Fog"
      muted
      @activate="toggle(fogKey)"
    >
      <span class="count">{{ map.fog.length }}</span>
    </Row>
    <template v-if="isOpen(fogKey)">
      <Row
        v-for="(entry, index) in map.fog"
        :key="index"
        :depth="depth + 1"
        :label="entry"
        :title="entry"
        muted
      />
    </template>
  </template>
  <template v-if="closed().length > 0">
    <Row
      :depth="depth"
      :expanded="isOpen(decKey)"
      icon="check"
      label="Decisions"
      muted
      @activate="toggle(decKey)"
    >
      <span class="count">{{ closed().length }}</span>
    </Row>
    <template v-if="isOpen(decKey)">
      <DecisionRow
        v-for="ticket in closed()"
        :key="ticket.number"
        :ticket="ticket"
        :depth="depth + 1"
      />
    </template>
  </template>
</template>

<style scoped>
.count {
  color: var(--vscode-descriptionForeground);
}
</style>
