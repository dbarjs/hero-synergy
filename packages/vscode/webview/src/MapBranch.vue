<script setup lang="ts">
import type { Focus, MapNode, MapSection, TicketRow } from '../../src/protocol.ts'
import FocusPane from './FocusPane.vue'
import Row from './Row.vue'

/** One map and what unfolds under it, drawn from its node. */
const props = defineProps<{
  map: MapNode
  /** Indent added to every row: 1 inside the Finished fold. */
  base?: number
  /** A finished map is muted and shows no takeable count. */
  finished?: boolean
  /** The selected row's pane, drawn under that row when it is in this map. */
  selection: Focus | null
}>()

const emit = defineEmits<{
  toggle: [key: string, expanded: boolean]
  select: [key: string]
  close: []
  open: [key: string]
  openDetail: [key: string, section: MapSection | null]
}>()

const isSelected = (key: string | null): boolean => key !== null && props.selection?.key === key

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
      :selected="isSelected(map.focusKey)"
      opens-detail
      @activate="emit('select', map.focusKey)"
      @open-detail="emit('openDetail', map.focusKey, null)"
    />
    <FocusPane
      v-if="selection && isSelected(map.focusKey)"
      :focus="selection"
      :depth="depth(1)"
      @close="emit('close')"
      @open="(key) => emit('open', key)"
      @detail="(key) => emit('openDetail', key, null)"
    />

    <template v-for="ticket in map.tickets" :key="ticket.number">
      <Row
        class="ticket"
        :class="ticket.place"
        :depth="depth(1)"
        :icon="typeIcon(ticket)"
        :number="ticket.number"
        :label="ticket.title"
        :muted="ticket.place === 'blocked'"
        :selected="isSelected(ticket.key)"
        opens-detail
        @activate="emit('select', ticket.key)"
        @open-detail="emit('openDetail', ticket.key, null)"
      >
        <span v-if="ticket.place === 'blocked'" class="waits">
          waits on {{ ticket.waitsOn.map((blocker) => `#${blocker.number}`).join(' ') }}
        </span>
        <span v-if="ticket.place === 'claimed'" class="claimed">claimed</span>
        <span v-if="ticket.next" class="next">next</span>
        <span v-if="ticket.mode" class="mode">{{ ticket.mode }}</span>
      </Row>
      <FocusPane
        v-if="selection && isSelected(ticket.key)"
        :focus="selection"
        :depth="depth(1)"
        @close="emit('close')"
        @open="(key) => emit('open', key)"
        @detail="(key) => emit('openDetail', key, null)"
      />
    </template>

    <template v-if="map.fog.entries.length > 0">
      <Row
        :depth="depth(1)"
        :expanded="map.fog.expanded"
        icon="cloud"
        label="Fog"
        muted
        opens-detail
        @activate="emit('toggle', map.fog.key, !map.fog.expanded)"
        @open-detail="emit('openDetail', map.focusKey, 'fog')"
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
        opens-detail
        @activate="emit('toggle', map.decisions.key, !map.decisions.expanded)"
        @open-detail="emit('openDetail', map.focusKey, 'decisions')"
      >
        <span class="count">{{ map.decisions.entries.length }}</span>
      </Row>
      <template v-if="map.decisions.expanded">
        <template v-for="(entry, index) in map.decisions.entries" :key="index">
          <Row
            class="decision"
            :depth="depth(2)"
            :number="entry.number"
            :label="entry.title"
            :description="entry.gist"
            :title="`${entry.title}: ${entry.gist}`"
            muted
            :selected="isSelected(entry.key)"
            opens-detail
            @activate="entry.key !== null && emit('select', entry.key)"
            @open-detail="entry.key !== null && emit('openDetail', entry.key, null)"
          />
          <FocusPane
            v-if="selection && isSelected(entry.key)"
            :focus="selection"
            :depth="depth(2)"
            @close="emit('close')"
            @open="(key) => emit('open', key)"
            @detail="(key) => emit('openDetail', key, null)"
          />
        </template>
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
