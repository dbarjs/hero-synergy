<script setup lang="ts">
import type { SessionView } from '@hero-synergy/core'
import { ageSince } from './age.ts'

/**
 * A session's trail on a row outside the open tickets: a closed ticket wrapping up in the
 * Decisions fold, a session with no ticket in view. The same words as an open ticket's row.
 */
defineProps<{ session: SessionView }>()

const emit = defineEmits<{ focusTerminal: [] }>()
</script>

<template>
  <button
    v-if="session.kind === 'starting' || (session.kind === 'live' && session.focusable)"
    type="button"
    class="focus-terminal codicon codicon-terminal"
    title="Focus terminal"
    aria-label="Focus terminal"
    @click.stop="emit('focusTerminal')"
    @keydown.enter.stop
    @keydown.space.stop
  />
  <span v-if="session.kind === 'starting'" class="session" :title="session.hint ?? undefined">
    starting<template v-if="session.hint !== null"> · no status yet</template>
  </span>
  <span
    v-if="session.kind === 'live'"
    class="session live"
    :class="{ needs: session.needsYou }"
    :title="`status since ${ageSince(session.since)} ago`"
  >
    {{ session.status ?? 'live' }} · {{ ageSince(session.since) }}
  </span>
  <span
    v-if="session.kind === 'live' && session.warning !== null"
    class="duplicate codicon codicon-warning"
    :title="session.warning"
    :aria-label="session.warning"
  />
  <span
    v-if="session.kind === 'ended'"
    class="session"
    :title="`${session.detail}, ${ageSince(session.since)} ago`"
  >
    ended · {{ session.detail }}
  </span>
</template>

<style scoped>
.focus-terminal {
  border: 0;
  padding: 0 2px;
  background: none;
  color: var(--vscode-icon-foreground);
  cursor: pointer;
}
.focus-terminal:hover {
  color: var(--vscode-textLink-foreground);
}
.session {
  color: var(--vscode-descriptionForeground);
}
.duplicate {
  color: var(--vscode-editorWarning-foreground);
}
.session.needs {
  color: var(--vscode-editorWarning-foreground);
  font-weight: 600;
}
</style>
