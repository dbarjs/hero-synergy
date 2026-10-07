<script setup lang="ts">
import type { TicketRow, MapNode } from '../../src/protocol.ts'
import Row from './Row.vue'

/** One map and what unfolds under it, drawn from its node. */
const props = defineProps<{
  map: MapNode
  /** Indent added to every row: 1 inside the Finished fold. */
  base?: number
  /** A finished map is muted and shows no takeable count. */
  finished?: boolean
}>()

const emit = defineEmits<{ toggle: [key: string, expanded: boolean] }>()

const depth = (level: number): number => level + (props.base ?? 0)

const TYPE_ICONS = {
  research: 'search',
  prototype: 'beaker',
  grilling: 'comment-discussion',
  task: 'checklist',
} as const

const typeIcon = (ticket: TicketRow): string =>
  ticket.type === null ? 'question' : TYPE_ICONS[ticket.type]

const takeableText = (map: MapNode): string =>
  map.takeable === 0 ? 'nothing takeable' : `${map.takeable} takeable`
</script>

<template>
  <Row
    :depth="depth(0)"
    :expanded="map.expanded"
    :number="map.number"
    :label="map.title"
    :muted="finished"
    @activate="emit('toggle', map.key, !map.expanded)"
  >
    <span v-if="!finished" class="takeable" :class="{ none: map.takeable === 0 }">
      {{ takeableText(map) }}
    </span>
    <span class="progress" title="decided of total">{{ map.decided }}/{{ map.total }}</span>
  </Row>

  <template v-if="map.expanded">
    <Row
      :depth="depth(1)"
      icon="flag"
      label="Map"
      :description="map.destination ?? undefined"
      :title="map.destination ?? undefined"
      muted
    />

    <Row
      v-for="ticket in map.tickets"
      :key="ticket.number"
      class="ticket"
      :class="ticket.place"
      :depth="depth(1)"
      :icon="typeIcon(ticket)"
      :number="ticket.number"
      :label="ticket.title"
      :muted="ticket.place === 'blocked'"
    >
      <span v-if="ticket.place === 'blocked'" class="waits">
        waits on {{ ticket.waitsOn.map((blocker) => `#${blocker.number}`).join(' ') }}
      </span>
      <span v-if="ticket.place === 'claimed'" class="claimed">claimed</span>
      <span v-if="ticket.next" class="next">next</span>
      <span v-if="ticket.mode" class="mode">{{ ticket.mode }}</span>
    </Row>

    <template v-if="map.fog.entries.length > 0">
      <Row
        :depth="depth(1)"
        :expanded="map.fog.expanded"
        icon="cloud"
        label="Fog"
        muted
        @activate="emit('toggle', map.fog.key, !map.fog.expanded)"
      >
        <span class="count">{{ map.fog.entries.length }}</span>
      </Row>
      <template v-if="map.fog.expanded">
        <Row
          v-for="(entry, index) in map.fog.entries"
          :key="index"
          :depth="depth(2)"
          :label="entry.text"
          :title="entry.text"
          muted
        />
      </template>
    </template>

    <template v-if="map.decisions.entries.length > 0">
      <Row
        :depth="depth(1)"
        :expanded="map.decisions.expanded"
        icon="check"
        label="Decisions"
        muted
        @activate="emit('toggle', map.decisions.key, !map.decisions.expanded)"
      >
        <span class="count">{{ map.decisions.entries.length }}</span>
      </Row>
      <template v-if="map.decisions.expanded">
        <Row
          v-for="(entry, index) in map.decisions.entries"
          :key="index"
          class="decision"
          :depth="depth(2)"
          :number="entry.number"
          :label="entry.title"
          :description="entry.gist"
          :title="`${entry.title}: ${entry.gist}`"
          muted
        />
      </template>
    </template>
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
.progress,
.count,
.waits,
.claimed {
  color: var(--vscode-descriptionForeground);
  background: none;
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
