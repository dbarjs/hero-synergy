<script setup lang="ts">
import type { ViewModel } from '../../src/protocol.ts'
import MapBranch from './MapBranch.vue'
import Row from './Row.vue'

/** The Tree: the maps in the order the host sent them, the finished ones folded at the bottom. */
defineProps<{ viewModel: ViewModel }>()

const emit = defineEmits<{ expand: [key: string]; collapse: [key: string] }>()

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
  </div>

  <div v-else role="tree" aria-label="Maps">
    <p v-if="viewModel.maps.length === 0 && viewModel.finished === null" class="note">
      No maps yet.
    </p>
    <MapBranch v-for="map in viewModel.maps" :key="map.key" :map="map" @toggle="toggle" />
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
          @toggle="toggle"
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
.count {
  color: var(--vscode-descriptionForeground);
}
</style>
