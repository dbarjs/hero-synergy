<script setup lang="ts">
import type { ActionId, Start } from '../../src/protocol.ts'
import ActionBlock from './ActionBlock.vue'

/**
 * What an empty Tree leads with: the install commands, Setup or Chart a map, each with its
 * command and ▶, and the line that goes with them ("pick one, never both").
 */
defineProps<{ start: Start }>()

const emit = defineEmits<{
  launch: [key: string, action: ActionId]
  copy: [key: string, action: ActionId]
}>()
</script>

<template>
  <div v-if="start.actions.length > 0" class="start">
    <ActionBlock
      v-for="action in start.actions"
      :key="action.id"
      :action="action"
      :ticket-key="start.key"
      @launch="(key, id) => emit('launch', key, id)"
      @copy="(key, id) => emit('copy', key, id)"
    />
    <p v-if="start.note" class="pick">{{ start.note }}</p>
  </div>
</template>

<style scoped>
.start {
  padding: 4px 0 0;
}
.pick {
  margin: 6px 0 0;
  color: var(--vscode-descriptionForeground);
}
</style>
