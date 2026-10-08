<script setup lang="ts">
import type { ActionId, Focus } from '../../src/protocol.ts'
import ActionBlock from './ActionBlock.vue'
import SessionLine from './SessionLine.vue'

/**
 * The Focus pane, open inline under the selected row. It is a stack of labelled
 * rows: state and claim for a ticket, counts and destination for a map. Session
 * status and Actions join as further rows in later tickets.
 */
defineProps<{ focus: Focus; depth: number }>()

const emit = defineEmits<{
  close: []
  open: [key: string]
  detail: [key: string]
  /** A drift line was clicked: open the Detail at its Drift section. */
  drift: [key: string]
  launch: [key: string, action: ActionId]
  focusTerminal: [key: string]
  copy: [key: string, action: ActionId]
}>()
</script>

<template>
  <section class="pane" :class="`depth-${depth}`" :aria-label="`#${focus.number} ${focus.title}`">
    <header class="head">
      <a
        class="title"
        :href="focus.kind === 'ticket' ? (focus.url ?? undefined) : undefined"
        role="link"
        tabindex="0"
        @click.prevent="emit('open', focus.key)"
        @keydown.enter.prevent="emit('open', focus.key)"
      >
        <span class="num">#{{ focus.number }}</span> {{ focus.title }}
      </a>
      <button type="button" class="detail" @click="emit('detail', focus.key)">↗ Detail</button>
      <button type="button" class="close" aria-label="Close" @click="emit('close')">✕</button>
    </header>

    <dl class="facts">
      <template v-if="focus.kind === 'ticket'">
        <div class="fact state">
          <dt>State</dt>
          <dd>{{ focus.state }}</dd>
        </div>
        <div class="fact claim">
          <dt>Claim</dt>
          <dd>{{ focus.claim === null ? 'unclaimed' : focus.claim.join(', ') }}</dd>
        </div>
        <div v-if="focus.disagreement" class="fact disagreement">
          <dt>Tracker</dt>
          <dd :class="focus.disagreement.level">{{ focus.disagreement.text }}</dd>
        </div>
        <div v-if="focus.session.kind !== 'none'" class="fact session">
          <dt>Session</dt>
          <dd>
            <SessionLine
              :session="focus.session"
              @focus-terminal="emit('focusTerminal', focus.key)"
            />
          </dd>
        </div>
      </template>
      <template v-else>
        <div class="fact counts">
          <dt>Counts</dt>
          <dd>
            {{ focus.takeable === 0 ? 'nothing takeable' : `${focus.takeable} takeable` }} ·
            {{ focus.decided }}/{{ focus.total }} decided
          </dd>
        </div>
        <div class="fact destination">
          <dt>Destination</dt>
          <dd>{{ focus.destination ?? 'not written down' }}</dd>
        </div>
      </template>
    </dl>

    <div v-if="focus.drift" class="drift">
      <button
        v-for="(message, index) in focus.drift.loud"
        :key="index"
        type="button"
        class="drift-line loud"
        @click="emit('drift', focus.key)"
      >
        <span class="codicon codicon-warning" /> {{ message }}
      </button>
      <button
        v-if="focus.drift.quiet > 0"
        type="button"
        class="drift-line quiet"
        @click="emit('drift', focus.key)"
      >
        {{ focus.drift.quiet }} old {{ focus.drift.quiet === 1 ? 'form' : 'forms' }}
      </button>
      <button
        v-if="focus.drift.tickets > 0"
        type="button"
        class="drift-line quiet tickets"
        @click="emit('drift', focus.key)"
      >
        {{ focus.drift.tickets }} {{ focus.drift.tickets === 1 ? 'ticket' : 'tickets' }} with drift
      </button>
    </div>

    <ActionBlock
      v-for="action in focus.actions"
      :key="action.id"
      :action="action"
      :ticket-key="focus.key"
      @launch="(key, action) => emit('launch', key, action)"
      @copy="(key, action) => emit('copy', key, action)"
    />
  </section>
</template>

<style scoped>
.pane {
  margin: 2px 8px 4px 0;
  padding: 6px 8px;
  border-left: 2px solid var(--vscode-focusBorder);
  background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
}
.depth-0 {
  margin-left: 20px;
}
.depth-1 {
  margin-left: 34px;
}
.depth-2 {
  margin-left: 50px;
}
.head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--vscode-textLink-foreground);
  cursor: pointer;
}
.num {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 0.9em;
}
.detail,
.close {
  flex: none;
  border: 0;
  border-radius: 2px;
  padding: 1px 6px;
  color: var(--vscode-button-secondaryForeground);
  background: var(--vscode-button-secondaryBackground);
  cursor: pointer;
}
.close {
  background: none;
  color: var(--vscode-icon-foreground);
}
.facts {
  margin: 4px 0 0;
}
.fact {
  display: flex;
  gap: 8px;
}
.drift {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: 4px;
}
.drift-line {
  max-width: 100%;
  border: 0;
  padding: 0;
  text-align: left;
  background: none;
  font: inherit;
  cursor: pointer;
}
.drift-line.loud .codicon {
  color: var(--vscode-editorWarning-foreground);
}
.drift-line.quiet {
  color: var(--vscode-descriptionForeground);
}
.link {
  border: 0;
  padding: 0;
  background: none;
  color: var(--vscode-textLink-foreground);
  cursor: pointer;
}
dt {
  flex: none;
  width: 72px;
  color: var(--vscode-descriptionForeground);
}
dd {
  margin: 0;
  min-width: 0;
}
.disagreement .warning {
  color: var(--vscode-editorWarning-foreground);
}
</style>
