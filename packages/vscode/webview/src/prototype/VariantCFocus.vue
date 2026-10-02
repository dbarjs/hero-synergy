<script setup lang="ts">
// PROTOTYPE — Variant C's focus pane: one ticket and its immediate neighbourhood, as a tiny
// three-column graph that needs no layout engine.
import { computed } from 'vue'

import {
  agoText,
  command,
  cycleStatus,
  decided,
  fogBehind,
  isOpen,
  launch,
  map,
  sessions,
  stateOf,
  statusClass,
  terminalCommand,
  ticket,
  typeOf,
  unblocks,
} from './data.ts'

const props = defineProps<{ id: string }>()
const emit = defineEmits<{ pick: [id: string] }>()

const t = computed(() => (props.id.startsWith('t') ? ticket(Number(props.id.slice(1))) : null))
const fog = computed(() => (props.id.startsWith('f') ? map.fog[Number(props.id.slice(1))] : null))
const session = computed(() => (t.value ? sessions.get(t.value.number) : undefined))
</script>

<template>
  <div v-if="t" class="focus">
    <div class="kicker">
      {{ typeOf(t).glyph }} {{ typeOf(t).name }} · {{ typeOf(t).mode }} ·
      <span :class="`s-${stateOf(t)}`">{{ stateOf(t) }}</span>
      <template v-if="t.assignee && isOpen(t)"> · claimed by {{ t.assignee }}</template>
    </div>
    <h1>{{ t.title }}</h1>

    <div class="hood">
      <div class="col">
        <div class="col-head">Waits on</div>
        <button
          v-for="b in t.blockedBy.map(ticket)"
          :key="b.number"
          class="chip"
          :class="{ done: !isOpen(b), blocking: isOpen(b) }"
          @click="emit('pick', `t${b.number}`)"
        >
          {{ isOpen(b) ? '⊘' : '✓' }} {{ b.title }}
        </button>
        <div v-if="!t.blockedBy.length" class="none">nothing</div>
      </div>
      <div class="arrow">→</div>
      <div class="col">
        <div class="chip self">{{ t.title }}</div>
      </div>
      <div class="arrow">→</div>
      <div class="col">
        <div class="col-head">Clears the way for</div>
        <button v-for="u in unblocks(t)" :key="u.number" class="chip" @click="emit('pick', `t${u.number}`)">
          {{ typeOf(u).glyph }} {{ u.title }}
        </button>
        <button
          v-for="f in fogBehind(t)"
          :key="f.title"
          class="chip fog"
          @click="emit('pick', `f${map.fog.indexOf(f)}`)"
        >
          ≋ {{ f.title }}
        </button>
        <div v-if="!unblocks(t).length && !fogBehind(t).length" class="none">nothing yet</div>
      </div>
    </div>

    <template v-if="t.gist">
      <h2>Decision</h2>
      <p>{{ t.gist }}</p>
    </template>
    <h2>Question</h2>
    <p>{{ t.question }}</p>

    <template v-if="session">
      <h2>Session</h2>
      <div class="line">
        <button class="status" :class="statusClass(session.status)" @click="cycleStatus(t.number)">
          {{ session.status }}
        </button>
        <span class="muted">last status event {{ agoText(session) }}</span>
        <button class="btn">Show terminal</button>
      </div>
      <p v-if="!t.assignee" class="muted">The tracker doesn't show the claim yet.</p>
    </template>
    <template v-else-if="stateOf(t) === 'frontier'">
      <h2>Action</h2>
      <div class="line">
        <button class="btn" @click="launch(t.number)">▶ Work ticket</button>
        <code class="cmd">{{ command(t) }}</code>
      </div>
      <details>
        <summary class="muted">in the terminal</summary>
        <code class="cmd">{{ terminalCommand(t) }}</code>
      </details>
    </template>
  </div>

  <div v-else-if="fog" class="focus">
    <div class="kicker">≋ fog · not yet specified</div>
    <h1>{{ fog.title }}</h1>
    <p>{{ fog.text }}</p>
    <h2>Waits on</h2>
    <button
      v-for="n in fog.waitsOn"
      :key="n"
      class="chip"
      :class="{ done: !isOpen(ticket(n)), blocking: isOpen(ticket(n)) }"
      @click="emit('pick', `t${n}`)"
    >
      {{ isOpen(ticket(n)) ? '⊘' : '✓' }} {{ ticket(n).title }}
    </button>
  </div>

  <div v-else class="focus">
    <div class="kicker">map</div>
    <h1>{{ map.title }}</h1>
    <h2>⚑ Destination</h2>
    <p class="pre">{{ map.destination }}</p>
    <h2>Decisions so far ({{ decided.length }})</h2>
    <button v-for="d in decided" :key="d.number" class="decision" @click="emit('pick', `t${d.number}`)">
      <strong>✓ {{ d.title }}</strong>
      <span>{{ d.gist }}</span>
    </button>
    <h2>Out of scope</h2>
    <p v-for="line in map.outOfScope" :key="line" class="muted">{{ line }}</p>
  </div>
</template>

<style scoped>
.focus {
  padding: 14px 16px;
  max-width: 820px;
}
.kicker {
  font-size: 11px;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.s-frontier {
  color: var(--green);
}
.s-claimed {
  color: var(--blue);
}
h1 {
  margin: 2px 0 12px;
  font-size: 16px;
  font-weight: 600;
}
h2 {
  margin: 14px 0 4px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--fg-muted);
}
p {
  margin: 0 0 6px;
}
.pre {
  white-space: pre-line;
}
.muted {
  color: var(--fg-muted);
  font-size: 12px;
}
.hood {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.col {
  display: grid;
  gap: 5px;
  flex: 1 1 180px;
  min-width: 0;
}
.col-head {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--fg-muted);
}
.arrow {
  color: var(--fg-muted);
}
.chip {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-raised);
  font-size: 12px;
  text-align: left;
}
.chip.self {
  border-color: var(--accent);
  font-weight: 600;
}
.chip.done {
  color: var(--fg-muted);
}
.chip.blocking {
  border-color: var(--amber);
}
.chip.fog {
  border-style: dashed;
  color: var(--fg-muted);
}
.none {
  font-size: 12px;
  color: var(--fg-muted);
  font-style: italic;
}
.line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.line .cmd {
  flex: 1 1 200px;
}
.decision {
  display: grid;
  gap: 2px;
  width: 100%;
  margin-bottom: 4px;
  padding: 5px 8px;
  border: 0;
  border-radius: 4px;
  background: none;
  text-align: left;
  font-size: 12px;
}
.decision:hover {
  background: var(--bg-hover);
}
.decision span {
  color: var(--fg-muted);
}
</style>
