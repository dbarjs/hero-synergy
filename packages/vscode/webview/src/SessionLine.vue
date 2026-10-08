<script setup lang="ts">
import { computed } from 'vue'

import type { SessionView } from '../../src/protocol.ts'
import { ageSince } from './age.ts'

/**
 * A ticket's session in the Focus pane and the Detail: the state, the status word, the time since
 * the last status event, and the way back to its terminal while it runs.
 */
const props = defineProps<{ session: Exclude<SessionView, { kind: 'none' }> }>()

const emit = defineEmits<{ focusTerminal: [] }>()

const age = computed(() =>
  props.session.kind === 'starting' ? '' : ` · ${ageSince(props.session.since)} ago`,
)
</script>

<template>
  <span class="line" :class="session.kind">
    <template v-if="session.kind === 'starting'">
      starting
      <span v-if="session.hint !== null" class="hint">{{ session.hint }}</span>
    </template>
    <template v-else-if="session.kind === 'live'">
      <span class="word" :class="{ needs: session.needsYou }">{{ session.status ?? 'live' }}</span>
      <span class="age">{{ age }}</span>
      <span v-if="session.warning !== null" class="warning">{{ session.warning }}</span>
    </template>
    <template v-else>
      <span class="word">{{ `ended: ${session.detail}` }}</span>
      <span class="age">{{ age }}</span>
    </template>
    <button
      v-if="session.kind === 'starting' || (session.kind === 'live' && session.focusable)"
      type="button"
      class="link"
      @click="emit('focusTerminal')"
    >
      focus terminal
    </button>
  </span>
</template>

<style scoped>
.hint {
  display: block;
  color: var(--vscode-editorWarning-foreground);
}
.warning {
  display: block;
  color: var(--vscode-editorWarning-foreground);
}
.needs {
  color: var(--vscode-editorWarning-foreground);
  font-weight: 600;
}
.age {
  color: var(--vscode-descriptionForeground);
}
</style>
