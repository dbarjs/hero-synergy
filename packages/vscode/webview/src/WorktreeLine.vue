<script setup lang="ts">
import { computed } from 'vue'

import type { WorktreeView } from '../../src/protocol.ts'

/**
 * A ticket's worktree in the Focus pane and the Detail: that it exists, and whether it holds
 * uncommitted files or commits that are not on `main`. Read-only: nothing here changes it.
 */
const props = defineProps<{ worktree: WorktreeView }>()

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`

/** What the worktree holds that is not yet on `main`, one phrase each; clean when neither. */
const holds = computed(() => {
  const parts: string[] = []
  if (props.worktree.uncommitted > 0) {
    parts.push(plural(props.worktree.uncommitted, 'uncommitted file', 'uncommitted files'))
  }
  if (props.worktree.ahead !== null && props.worktree.ahead > 0) {
    parts.push(plural(props.worktree.ahead, 'commit not on main', 'commits not on main'))
  }
  return parts
})
</script>

<template>
  <span class="line">
    <span class="branch">{{ worktree.branch }}</span>
    <span v-if="holds.length === 0" class="clean"> · clean</span>
    <span v-else class="holds"> · {{ holds.join(' · ') }}</span>
  </span>
</template>

<style scoped>
.branch {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 0.9em;
}
.clean {
  color: var(--vscode-descriptionForeground);
}
.holds {
  color: var(--vscode-editorWarning-foreground);
}
</style>
