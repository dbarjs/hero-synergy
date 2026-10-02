<script setup lang="ts">
// PROTOTYPE — Variant C's focus pane: one ticket and its immediate neighbourhood, as a tiny
// three-column graph that needs no layout engine.
import { computed } from 'vue'

import type { MapData } from './data.ts'

import {
  agoText,
  command,
  cycleStatus,
  fogBehind,
  isOpen,
  launch,
  map,
  mapOf,
  sessions,
  summarize,
  stateOf,
  statusClass,
  terminalCommand,
  ticket,
  typeOf,
  unblocks,
} from './data.ts'
import { allMaps } from './maps.ts'

const props = defineProps<{ id: string; closable?: boolean }>()
const emit = defineEmits<{ pick: [id: string]; close: [] }>()

const t = computed(() => (props.id.startsWith('t') ? ticket(Number(props.id.slice(1))) : null))
// Ids: `t<ticket>`, `m<map>` (or `map` for the open one), `f<map>:<index>` (or `f<index>`).
const byNumber = (n: string): MapData => allMaps.find((m) => m.number === Number(n))!
const fog = computed(() => {
  if (!props.id.startsWith('f')) return null
  const [a, b] = props.id.slice(1).split(':')
  return b === undefined ? map.fog[Number(a)] : byNumber(a!).fog[Number(b)]
})
const shownMap = computed(() =>
  props.id === 'map' ? map : props.id.startsWith('m') ? byNumber(props.id.slice(1)) : null,
)
const summary = computed(() => (shownMap.value ? summarize(shownMap.value) : null))
const session = computed(() => (t.value ? sessions.get(t.value.number) : undefined))
</script>

<template>
  <div v-if="t" class="focus">
    <button v-if="closable" class="close" title="Close" @click="emit('close')">✕</button>
    <div class="kicker">
      {{ typeOf(t).glyph }} {{ typeOf(t).name }} · {{ typeOf(t).mode }} ·
      <span :class="`s-${stateOf(t)}`">{{ stateOf(t) }}</span>
      <template v-if="t.assignee && isOpen(t)"> · claimed by {{ t.assignee }}</template>
    </div>
    <h1>
      <a :href="t.url" target="_blank" rel="noreferrer" title="Open the issue">
        <span class="num">#{{ t.number }}</span> {{ t.title }} <span class="ext">↗</span>
      </a>
    </h1>

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
          {{ isOpen(b) ? '⊘' : '✓' }} <span class="num">#{{ b.number }}</span> {{ b.title }}
        </button>
        <div v-if="!t.blockedBy.length" class="none">nothing</div>
      </div>
      <div class="arrow">→</div>
      <div class="col">
        <div class="col-head">Clears the way for</div>
        <button v-for="u in unblocks(t)" :key="u.number" class="chip" @click="emit('pick', `t${u.number}`)">
          {{ typeOf(u).glyph }} <span class="num">#{{ u.number }}</span> {{ u.title }}
        </button>
        <button
          v-for="f in fogBehind(t)"
          :key="f.title"
          class="chip fog"
          @click="emit('pick', `f${mapOf(t).number}:${mapOf(t).fog.indexOf(f)}`)"
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
    <button v-if="closable" class="close" title="Close" @click="emit('close')">✕</button>
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
      {{ isOpen(ticket(n)) ? '⊘' : '✓' }} <span class="num">#{{ ticket(n).number }}</span> {{ ticket(n).title }}
    </button>
  </div>

  <div v-else-if="shownMap && summary" class="focus">
    <button v-if="closable" class="close" title="Close" @click="emit('close')">✕</button>
    <div class="kicker">map · {{ summary.frontier.length }} takeable · {{ summary.claimed.length }} claimed · {{ summary.blocked.length }} blocked · {{ shownMap.fog.length }} fog</div>
    <h1>
      <a :href="shownMap.url" target="_blank" rel="noreferrer" title="Open the map issue">
        <span class="num">#{{ shownMap.number }}</span> {{ shownMap.title }} <span class="ext">↗</span>
      </a>
    </h1>
    <h2>⚑ Destination</h2>
    <p class="pre">{{ shownMap.destination }}</p>
    <details :open="!closable">
      <summary><h2>Decisions so far ({{ summary.decided.length }})</h2></summary>
      <button v-for="d in summary.decided" :key="d.number" class="decision" @click="emit('pick', `t${d.number}`)">
        <strong>✓ <span class="num">#{{ d.number }}</span> {{ d.title }}</strong>
        <span>{{ d.gist }}</span>
      </button>
    </details>
    <h2>Out of scope</h2>
    <p v-for="line in shownMap.outOfScope" :key="line" class="muted">{{ line }}</p>
    <p v-if="!shownMap.outOfScope.length" class="muted">nothing ruled out</p>
  </div>
</template>

<style scoped>
.focus {
  position: relative;
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
.close {
  position: absolute;
  top: 8px;
  right: 8px;
  border: 0;
  background: none;
  color: var(--fg-muted);
}
.close:hover {
  color: var(--fg);
}
summary {
  cursor: pointer;
  list-style: none;
}
summary h2 {
  display: inline;
}
summary::before {
  content: '▸ ';
  color: var(--fg-muted);
  font-size: 11px;
}
details[open] summary::before {
  content: '▾ ';
}
h1 a {
  color: inherit;
  text-decoration: none;
}
h1 a:hover {
  color: var(--accent);
}
.ext {
  font-size: 12px;
  color: var(--fg-muted);
}
</style>
