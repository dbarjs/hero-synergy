<script setup lang="ts">
// PROTOTYPE — Maps variant M1, "Maps, then drill in": one card per active map with its progress
// and its next ticket; finished maps fold into one line. Click a map to open it on its own.
import { computed, ref } from 'vue'

import {
  activeMaps,
  agoText,
  command,
  cycleStatus,
  finishedMaps,
  finishedText,
  launch,
  mapOf,
  needsYouIn,
  orderedActive,
  sessions,
  statusClass,
  stuck,
  typeOf,
} from './data.ts'

defineProps<{ narrow: boolean }>()
const emit = defineEmits<{ open: [map: number] }>()

const finishedOpen = ref(false)
const filter = ref('')
const finished = computed(() =>
  finishedMaps.filter((s) => s.map.title.toLowerCase().includes(filter.value.toLowerCase())),
)
const needsYou = computed(() => activeMaps.flatMap((s) => needsYouIn(s.map)))
</script>

<template>
  <div class="m1">
    <header>
      <strong>Maps</strong>
      <span class="muted">{{ activeMaps.length }} active · {{ finishedMaps.length }} finished</span>
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
      <h2>Active <span class="count">{{ activeMaps.length }}</span></h2>
      <div v-for="s in orderedActive" :key="s.map.number" class="card" @click="emit('open', s.map.number)">
        <div class="card-head">
          <span class="title"><span class="num">#{{ s.map.number }}</span> {{ s.map.title }}</span>
          <span class="muted">{{ s.decided.length }}/{{ s.map.tickets.length }}</span>
        </div>
        <div class="bar"><div :style="{ width: `${(s.decided.length / s.map.tickets.length) * 100}%` }" /></div>
        <div class="counts">
          <span v-if="s.frontier.length" class="c-frontier">● {{ s.frontier.length }} frontier</span>
          <span v-if="s.claimed.length" class="c-claimed">◐ {{ s.claimed.length }} claimed</span>
          <span v-if="s.blocked.length">⊘ {{ s.blocked.length }} blocked</span>
          <span v-if="s.map.fog.length">≋ {{ s.map.fog.length }} fog</span>
        </div>
        <div v-if="s.next" class="next-line">
          <div class="main">
            <span class="next">next</span>
            <span class="glyph" :title="typeOf(s.next).name">{{ typeOf(s.next).glyph }}</span><span class="num">#{{ s.next.number }}</span> {{ s.next.title }}
          </div>
          <button
            v-if="!sessions.has(s.next.number)"
            class="btn"
            :title="command(s.next)"
            @click.stop="launch(s.next.number)"
          >
            ▶
          </button>
          <span v-else class="status" :class="statusClass(sessions.get(s.next.number)!.status)">
            {{ sessions.get(s.next.number)!.status }}
          </span>
        </div>
        <div v-else-if="stuck(s)" class="stuck">
          Nothing takeable.
          <div v-for="t in s.claimed" :key="t.number">
            ↳ waits on <em><span class="num">#{{ t.number }}</span> {{ t.title }}</em>
            <span v-if="sessions.has(t.number)" class="status" :class="statusClass(sessions.get(t.number)!.status)">
              {{ sessions.get(t.number)!.status }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <section>
      <h2 class="fold" @click="finishedOpen = !finishedOpen">
        {{ finishedOpen ? '▾' : '▸' }} Finished <span class="count">{{ finishedMaps.length }}</span>
      </h2>
      <template v-if="finishedOpen">
        <input v-model="filter" class="filter" placeholder="Filter finished maps" />
        <div v-for="s in finished" :key="s.map.number" class="row done" @click="emit('open', s.map.number)">
          <span class="glyph ok">✓</span>
          <div class="main"><span class="num">#{{ s.map.number }}</span> {{ s.map.title }}</div>
          <span class="muted">{{ s.decided.length }} decisions · {{ finishedText(s.map) }}</span>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.m1 {
  max-width: 620px;
}
header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
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
.row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 4px 12px;
}
.row:hover {
  background: var(--bg-hover);
}
.row.done {
  cursor: pointer;
  color: var(--fg-muted);
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
.link {
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
}
.link:hover {
  color: var(--accent);
}
.card {
  margin: 4px 8px 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg-raised);
  cursor: pointer;
}
.card:hover {
  border-color: var(--accent);
}
.card-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.title {
  font-weight: 600;
}
.bar {
  height: 3px;
  margin: 6px 0;
  border-radius: 2px;
  background: var(--border);
}
.bar div {
  height: 100%;
  border-radius: 2px;
  background: var(--green);
}
.counts {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  font-size: 11px;
  color: var(--fg-muted);
}
.c-frontier {
  color: var(--green);
}
.c-claimed {
  color: var(--blue);
}
.next-line {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
}
.next {
  margin-right: 2px;
  padding: 0 5px;
  border-radius: 3px;
  background: var(--green);
  color: #000;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}
.btn {
  padding: 1px 7px;
}
.stuck {
  margin-top: 6px;
  font-size: 12px;
  color: var(--amber);
}
.stuck div {
  color: var(--fg-muted);
}
.stuck em {
  font-style: normal;
  color: var(--fg);
}
.ok {
  color: var(--green);
}
.filter {
  display: block;
  width: calc(100% - 24px);
  margin: 2px 12px 6px;
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: 2px;
  background: var(--bg-raised);
  color: var(--fg);
  font: inherit;
}
</style>
