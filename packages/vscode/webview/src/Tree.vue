<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import type { ActionId, MapSection, ViewModel } from '../../src/protocol.ts'
import FocusPane from './FocusPane.vue'
import MapBranch from './MapBranch.vue'
import Row from './Row.vue'
import StartActions from './StartActions.vue'

/** The Tree: the maps in the order the host sent them, the finished ones folded at the bottom. */
const props = defineProps<{ viewModel: ViewModel }>()

const emit = defineEmits<{
  expand: [key: string]
  collapse: [key: string]
  /** The row to select, or null to close the pane. */
  select: [key: string | null]
  open: [key: string]
  refresh: []
  /** Select the row and open the Detail on it, scrolled to a section of a map. */
  openDetail: [key: string, section: MapSection | null]
  launch: [key: string, action: ActionId]
  focusTerminal: [key: string]
  copy: [key: string, action: ActionId]
}>()

// The repo row's age is read against the clock, so tick to keep "tracker read 2 min ago" honest.
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 30_000)
})
onBeforeUnmount(() => clearInterval(timer))

const age = (collectedAt: string): string => {
  const seconds = Math.max(0, Math.round((now.value - Date.parse(collectedAt)) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours} h ago` : `${Math.floor(hours / 24)} d ago`
}

/** The age is emphasised once the snapshot is older than this, or when the last collect failed. */
const STALE_AFTER_MS = 5 * 60_000

const clock = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

const BUDGET_WORDS = {
  paused: 'paused until',
  'rate-limited': 'rate-limited until',
  backoff: 'backing off until',
} as const

/** The repo row's text: how old the read is, why the last collect failed, and what holds refreshes back. */
const repoDescription = (model: Extract<ViewModel, { kind: 'maps' }>): string =>
  [
    `tracker read ${age(model.collectedAt)}`,
    model.notice?.message,
    model.budget && `${BUDGET_WORDS[model.budget.kind]} ${clock(model.budget.until)}`,
  ]
    .filter((part) => part)
    .join(' · ')

const isStale = (model: Extract<ViewModel, { kind: 'maps' }>): boolean =>
  model.notice !== null || now.value - Date.parse(model.collectedAt) > STALE_AFTER_MS

/** A click on the selected row again closes its pane. */
const select = (key: string): void => {
  const selected = props.viewModel.kind === 'maps' ? props.viewModel.selection?.key : undefined
  emit('select', selected === key ? null : key)
}

const toggle = (key: string, expanded: boolean): void => {
  if (expanded) emit('expand', key)
  else emit('collapse', key)
}
</script>

<template>
  <p v-if="viewModel.kind === 'loading'" class="note">Reading the tracker…</p>

  <div v-else-if="viewModel.kind === 'message'" class="note">
    <p class="message">{{ viewModel.message }}</p>
    <p v-if="viewModel.detail" class="detail">{{ viewModel.detail }}</p>
    <StartActions
      :start="viewModel.start"
      @launch="(key, action) => emit('launch', key, action)"
      @copy="(key, action) => emit('copy', key, action)"
    />
  </div>

  <div v-else role="tree" aria-label="Maps">
    <Row
      v-if="viewModel.repo !== null"
      class="repo"
      :class="{ stale: isStale(viewModel) }"
      :depth="0"
      icon="repo"
      :label="viewModel.repo"
      :description="repoDescription(viewModel)"
      @activate="emit('refresh')"
    >
      <span class="codicon codicon-refresh" title="Refresh" />
    </Row>
    <div v-if="viewModel.notice" class="notice" role="alert">
      <p class="message">{{ viewModel.notice.message }}</p>
      <p v-if="viewModel.notice.fix" class="detail">{{ viewModel.notice.fix }}</p>
      <p class="detail">Showing the maps from the last read.</p>
    </div>
    <div v-if="viewModel.maps.length === 0 && viewModel.finished === null" class="note">
      <p class="message">No maps yet.</p>
      <StartActions
        :start="viewModel.start"
        @launch="(key, action) => emit('launch', key, action)"
        @copy="(key, action) => emit('copy', key, action)"
      />
    </div>
    <MapBranch
      v-for="map in viewModel.maps"
      :key="map.key"
      :map="map"
      :selection="viewModel.selection"
      @toggle="toggle"
      @select="select"
      @close="emit('select', null)"
      @open="(key) => emit('open', key)"
      @open-detail="(key, section) => emit('openDetail', key, section)"
      @launch="(key, action) => emit('launch', key, action)"
      @focus-terminal="(key) => emit('focusTerminal', key)"
      @copy="(key, action) => emit('copy', key, action)"
    />
    <template v-if="viewModel.unmapped">
      <Row
        :depth="0"
        :expanded="viewModel.unmapped.expanded"
        icon="warning"
        label="Unmapped"
        muted
        @activate="toggle(viewModel.unmapped.key, !viewModel.unmapped.expanded)"
      >
        <span class="count">{{ viewModel.unmapped.entries.length }}</span>
      </Row>
      <template v-if="viewModel.unmapped.expanded">
        <template v-for="ticket in viewModel.unmapped.entries" :key="ticket.key">
          <Row
            class="ticket unmapped"
            :depth="1"
            :number="ticket.number"
            :label="ticket.title"
            :warn="ticket.loud.length > 0 ? ticket.loud.join('\n') : undefined"
            :selected="viewModel.selection?.key === ticket.key"
            opens-detail
            @activate="select(ticket.key)"
            @open-detail="emit('openDetail', ticket.key, null)"
          />
          <FocusPane
            v-if="viewModel.selection && viewModel.selection.key === ticket.key"
            :focus="viewModel.selection"
            :depth="1"
            @close="emit('select', null)"
            @open="(key) => emit('open', key)"
            @detail="(key) => emit('openDetail', key, null)"
            @drift="(key) => emit('openDetail', key, 'drift')"
            @launch="(key) => emit('launch', key)"
            @focus-terminal="(key) => emit('focusTerminal', key)"
            @copy="(key) => emit('copy', key)"
          />
        </template>
      </template>
    </template>
    <template v-if="viewModel.finished">
      <Row
        :depth="0"
        :expanded="viewModel.finished.expanded"
        icon="check-all"
        label="Finished"
        muted
        @activate="toggle(viewModel.finished.key, !viewModel.finished.expanded)"
      >
        <span class="count">{{ viewModel.finished.maps.length }} maps</span>
      </Row>
      <template v-if="viewModel.finished.expanded">
        <MapBranch
          v-for="map in viewModel.finished.maps"
          :key="map.key"
          :map="map"
          :base="1"
          finished
          :selection="viewModel.selection"
          @toggle="toggle"
          @select="select"
          @close="emit('select', null)"
          @open="(key) => emit('open', key)"
          @open-detail="(key, section) => emit('openDetail', key, section)"
          @launch="(key, action) => emit('launch', key, action)"
          @focus-terminal="(key) => emit('focusTerminal', key)"
          @copy="(key, action) => emit('copy', key, action)"
        />
      </template>
    </template>
  </div>
</template>

<style scoped>
.note {
  margin: 0;
  padding: 8px 12px;
  color: var(--vscode-descriptionForeground);
}
.message {
  margin: 0 0 4px;
  color: var(--vscode-foreground);
}
.detail {
  margin: 0;
}
.notice {
  margin: 0;
  padding: 4px 12px 8px;
  color: var(--vscode-descriptionForeground);
  border-left: 2px solid var(--vscode-editorWarning-foreground);
}
.repo.stale :deep(.description) {
  color: var(--vscode-editorWarning-foreground);
  font-weight: 600;
}
.count {
  color: var(--vscode-descriptionForeground);
}
</style>
