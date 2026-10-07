<script setup lang="ts">
import type { ActionView } from '../../src/protocol.ts'

/**
 * An Action as the Focus pane and the Detail show it: the button that runs it, a copy
 * button, the command whole in a code block, the env on a muted second line and any note.
 * A greyed Action keeps its command and says why it cannot run.
 */
defineProps<{ action: ActionView; ticketKey: string }>()

const emit = defineEmits<{ launch: [key: string]; copy: [key: string] }>()
</script>

<template>
  <div class="action">
    <div class="action-head">
      <button
        type="button"
        class="run"
        :aria-disabled="action.disabled !== null"
        :title="action.disabled ?? action.command ?? undefined"
        @click="action.disabled === null && emit('launch', ticketKey)"
      >
        <span class="codicon codicon-play" /> {{ action.label }}
      </button>
      <button
        v-if="action.command !== null"
        type="button"
        class="copy"
        title="Copy command"
        aria-label="Copy command"
        @click="emit('copy', ticketKey)"
      >
        <span class="codicon codicon-copy" />
      </button>
    </div>
    <p v-if="action.disabled" class="reason">{{ action.disabled }}</p>
    <pre v-if="action.command !== null" class="command"><code>{{ action.command }}</code></pre>
    <p v-if="action.envLine" class="env">{{ action.envLine }}</p>
    <p v-if="action.note" class="shared">{{ action.note }}</p>
  </div>
</template>

<style scoped>
.action {
  margin-top: 6px;
}
.action-head {
  display: flex;
  gap: 6px;
}
.run,
.copy {
  border: 0;
  border-radius: 2px;
  padding: 2px 8px;
  color: var(--vscode-button-foreground);
  background: var(--vscode-button-background);
  cursor: pointer;
}
.copy {
  color: var(--vscode-button-secondaryForeground);
  background: var(--vscode-button-secondaryBackground);
}
[aria-disabled='true'] {
  opacity: 0.5;
  cursor: not-allowed;
}
.command {
  margin: 6px 0 0;
  padding: 4px 6px;
  overflow-x: auto;
  background: var(--vscode-textCodeBlock-background);
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 0.9em;
  white-space: pre-wrap;
  word-break: break-all;
}
.env,
.shared,
.reason {
  margin: 4px 0 0;
  color: var(--vscode-descriptionForeground);
  font-size: 0.9em;
}
.env {
  font-family: var(--vscode-editor-font-family, monospace);
  word-break: break-all;
}
.reason {
  color: var(--vscode-editorWarning-foreground);
}
</style>
