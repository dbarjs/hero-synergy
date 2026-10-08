<script setup lang="ts">
import type { Focus, HealthRow } from '../../src/protocol.ts'
import FocusPane from './FocusPane.vue'
import Row from './Row.vue'

/**
 * The pinned Health row at the top of the Tree, and its pane when it is selected. A click selects
 * the row; a second click closes the pane. The ⚠ is there while any entry is loud, with the loud
 * messages on hover; a row of notes only has none.
 */
const props = defineProps<{ health: HealthRow; selection: Focus | null }>()

const emit = defineEmits<{
  select: [key: string | null]
  dismissHealth: [dismissKey: string]
}>()

const toggle = (): void =>
  emit('select', props.selection?.key === props.health.key ? null : props.health.key)
</script>

<template>
  <Row
    class="health"
    :class="{ loud: health.loud }"
    :depth="0"
    :icon="health.loud ? 'warning' : 'info'"
    :label="health.label"
    :selected="selection?.key === health.key"
    :title="health.loud ? health.hover.join('\n') : undefined"
    @activate="toggle"
  />
  <FocusPane
    v-if="selection && selection.kind === 'health'"
    :focus="selection"
    :depth="0"
    @close="emit('select', null)"
    @dismiss-health="(dismissKey) => emit('dismissHealth', dismissKey)"
  />
</template>

<style scoped>
.health.loud :deep(.mark) {
  color: var(--vscode-editorWarning-foreground);
}
</style>
