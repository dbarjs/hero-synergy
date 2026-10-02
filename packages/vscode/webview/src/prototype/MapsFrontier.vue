<script setup lang="ts">
// PROTOTYPE — Maps variant M3, "Frontier across maps": tickets first, maps second. One list of
// everything takeable right now across all active maps, grouped by map; maps with nothing
// takeable are called out; finished maps are a footnote. A select narrows it to one map.
import { computed, reactive, ref } from 'vue'

import {
  activeMaps,
  agoText,
  command,
  cycleStatus,
  finishedMaps,
  finishedText,
  launch,
  mapOf,
  named,
  needsYouIn,
  orderedActive,
  sessions,
  statusClass,
  stuck,
  typeOf,
} from './data.ts'

defineProps<{ narrow: boolean }>()
const emit = defineEmits<{ open: [map: number] }>()

const scope = ref(0)
const scoped = computed(() => orderedActive.value.filter((s) => !scope.value || s.map.number === scope.value))
const needsYou = computed(() => scoped.value.flatMap((s) => needsYouIn(s.map)))
const takeable = computed(() => scoped.value.filter((s) => s.frontier.length))
const inSession = computed(() =>
  scoped.value.flatMap((s) => s.claimed).filter((t) => !needsYou.value.includes(t)),
)
const stuckMaps = computed(() => scoped.value.filter(stuck))
const total = computed(() => takeable.value.reduce((sum, s) => sum + s.frontier.length, 0))

const PREVIEW = 3
const expanded = reactive(new Set<number>())
const finishedOpen = ref(false)
</script>

<template>
  <div class="m3">
    <header>
      <select v-model="scope">
        <option :value="0">All {{ activeMaps.length }} active maps</option>
        <option v-for="s in activeMaps" :key="s.map.number" :value="s.map.number">
          {{ named(s.map) }}
        </option>
      </select>
      <span class="muted">{{ total }} takeable</span>
    </header>

    <section v-if="needsYou.length">
      <h2 class="attention">Needs you <span class="count">{{ needsYou.length }}</span></h2>
      <div v-for="t in needsYou" :key="t.number" class="row">
        <span class="glyph" :title="typeOf(t).name">{{ typeOf(t).glyph }}</span>
        <div class="main">
          <div><span class="num">#{{ t.number }}</span> {{ t.title }}</div>
          <div class="sub">
            <button class="status" :class="statusClass(sessions.get(t.number)!.status)" @click="cycleStatus(t.number)">
              {{ sessions.get(t.number)!.status }}
            </button>
            {{ agoText(sessions.get(t.number)!) }}
          </div>
          <button class="sub link" @click="emit('open', mapOf(t).number)">in <span class="num">#{{ mapOf(t).number }}</span> {{ mapOf(t).title }}</button>
        </div>
      </div>
    </section>

    <section>
      <h2>Takeable now <span class="count">{{ total }}</span></h2>
      <template v-for="s in takeable" :key="s.map.number">
        <button class="group" @click="emit('open', s.map.number)">
          <span class="group-title">
          {{ named(s.map) }}
        </span>
          <span class="muted">{{ s.decided.length }}/{{ s.map.tickets.length }} ›</span>
        </button>
        <div
          v-for="t in expanded.has(s.map.number) ? s.frontier : s.frontier.slice(0, PREVIEW)"
          :key="t.number"
          class="row"
        >
          <span class="glyph" :title="typeOf(t).name">{{ typeOf(t).glyph }}</span>
          <div class="main">
            <span class="num">#{{ t.number }}</span> {{ t.title }}
            <span v-if="t === s.next" class="next">next</span>
          </div>
          <span v-if="sessions.has(t.number)" class="status" :class="statusClass(sessions.get(t.number)!.status)">
            {{ sessions.get(t.number)!.status }}
          </span>
          <button v-else class="btn" :title="command(t)" @click="launch(t.number)">▶</button>
        </div>
        <button
          v-if="s.frontier.length > PREVIEW && !expanded.has(s.map.number)"
          class="more"
          @click="expanded.add(s.map.number)"
        >
          + {{ s.frontier.length - PREVIEW }} more
        </button>
      </template>
    </section>

    <section v-if="inSession.length">
      <h2>Claimed <span class="count">{{ inSession.length }}</span></h2>
      <div v-for="t in inSession" :key="t.number" class="row">
        <span class="glyph" :title="typeOf(t).name">{{ typeOf(t).glyph }}</span>
        <div class="main">
          <div><span class="num">#{{ t.number }}</span> {{ t.title }}</div>
          <div class="sub">
            <button
              v-if="sessions.has(t.number)"
              class="status"
              :class="statusClass(sessions.get(t.number)!.status)"
              @click="cycleStatus(t.number)"
            >
              {{ sessions.get(t.number)!.status }}
            </button>
            <template v-else>no live session</template>
          </div>
          <button class="sub link" @click="emit('open', mapOf(t).number)">in <span class="num">#{{ mapOf(t).number }}</span> {{ mapOf(t).title }}</button>
        </div>
      </div>
    </section>

    <section v-if="stuckMaps.length">
      <h2>Nothing takeable <span class="count">{{ stuckMaps.length }}</span></h2>
      <div v-for="s in stuckMaps" :key="s.map.number" class="row">
        <span class="glyph">⊘</span>
        <div class="main">
          <button class="link strong" @click="emit('open', s.map.number)">
          {{ named(s.map) }}
        </button>
          <div v-for="t in s.claimed" :key="t.number" class="sub">↳ waits on <em><span class="num">#{{ t.number }}</span> {{ t.title }}</em></div>
        </div>
      </div>
    </section>

    <section v-if="!scope">
      <h2 class="fold" @click="finishedOpen = !finishedOpen">
        {{ finishedOpen ? '▾' : '▸' }} Finished maps <span class="count">{{ finishedMaps.length }}</span>
      </h2>
      <template v-if="finishedOpen">
        <div v-for="s in finishedMaps" :key="s.map.number" class="row dim" @click="emit('open', s.map.number)">
          <span class="glyph">✓</span>
          <div class="main">
          {{ named(s.map) }}
        </div>
          <span class="muted">{{ finishedText(s.map) }}</span>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.m3 {
  max-width: 620px;
}
header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}
select {
  flex: 1;
  min-width: 0;
  padding: 2px 4px;
  border: 1px solid var(--border);
  background: var(--bg-raised);
  color: var(--fg);
  font: inherit;
}
.muted {
  font-size: 11px;
  color: var(--fg-muted);
  white-space: nowrap;
}
h2 {
  margin: 0;
  padding: 10px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--fg-muted);
}
h2.fold {
  cursor: pointer;
}
h2.attention {
  color: var(--amber);
}
.count {
  margin-left: 4px;
  padding: 0 6px;
  border-radius: 8px;
  background: var(--badge-bg);
  color: var(--badge-fg);
  font-weight: 400;
}
.group {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  margin-top: 6px;
  padding: 3px 12px;
  border: 0;
  background: none;
  text-align: left;
}
.group:hover {
  background: var(--bg-hover);
}
.group-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-muted);
}
.row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 3px 12px;
}
.row:hover {
  background: var(--bg-hover);
}
.row.dim {
  color: var(--fg-muted);
  cursor: pointer;
}
.main {
  flex: 1;
  min-width: 0;
}
.sub {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--fg-muted);
}
.sub em {
  font-style: normal;
  color: var(--fg);
}
.link {
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
}
.link:hover {
  color: var(--accent);
}
.strong {
  font-weight: 600;
}
.btn {
  visibility: hidden;
  padding: 1px 7px;
}
.row:hover .btn {
  visibility: visible;
}
.more {
  margin-left: 34px;
  padding: 0;
  border: 0;
  background: none;
  font-size: 12px;
  color: var(--accent);
}
.next {
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 3px;
  background: var(--green);
  color: #000;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}
</style>
