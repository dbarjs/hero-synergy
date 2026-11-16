<script setup lang="ts">
// PROTOTYPE (#202) — the repo-level folds every variant ends with: Unmapped (the stray
// ready-for-agent issue lives here) and a Finished fold whose content each variant passes in.
import Row from '../Row.vue'
import ProtoFocus from './ProtoFocus.vue'
import { isOpen, scene, select, state, toggle } from './store.ts'

defineProps<{
  finishedCount: number
  finishedLabel?: string
  depth?: number
  finishedKey?: string
}>()
</script>

<template>
  <template v-if="scene.lone.length > 0">
    <Row
      :depth="depth ?? 0"
      :expanded="isOpen('unmapped')"
      icon="warning"
      label="Unmapped"
      muted
      @activate="toggle('unmapped')"
    >
      <span class="count">{{ scene.lone.length }}</span>
    </Row>
    <template v-if="isOpen('unmapped')">
      <template v-for="lone in scene.lone" :key="lone.number">
        <Row
          :depth="(depth ?? 0) + 1"
          icon="tools"
          :number="lone.number"
          :label="lone.title"
          description="no spec"
          :selected="state.selected === `lone:${lone.number}`"
          @activate="select(`lone:${lone.number}`)"
        >
          <span class="mode">{{ lone.role === 'ready-for-agent' ? 'AFK' : 'HITL' }}</span>
        </Row>
        <ProtoFocus
          v-if="state.selected === `lone:${lone.number}`"
          :item="{ kind: 'lone', lone }"
          :depth="(depth ?? 0) + 1"
        />
      </template>
    </template>
  </template>
  <template v-if="finishedCount > 0">
    <Row
      :depth="depth ?? 0"
      :expanded="isOpen(finishedKey ?? 'finished')"
      icon="check-all"
      label="Finished"
      muted
      @activate="toggle(finishedKey ?? 'finished')"
    >
      <span class="count">{{ finishedLabel ?? `${finishedCount}` }}</span>
    </Row>
    <slot v-if="isOpen(finishedKey ?? 'finished')" />
  </template>
</template>

<style scoped>
.count {
  color: var(--vscode-descriptionForeground);
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
