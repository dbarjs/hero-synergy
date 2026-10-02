<script setup lang="ts">
// PROTOTYPE — Variant C, "List + focus": a flat list in map order with filter chips, and a focus
// pane that draws only the selected ticket's neighbourhood. The "both" answer without a full graph.
import { computed, ref } from 'vue'

import { blocked, claimed, decided, frontier, map, next, sessions, stateOf, statusClass, typeOf } from './data.ts'
import type { TicketState } from './data.ts'
import VariantCFocus from './VariantCFocus.vue'

defineProps<{ narrow: boolean }>()

type Filter = 'all' | TicketState | 'fog'
const filter = ref<Filter>('all')
const picked = ref(next ? `t${next.number}` : 'map')

const chips: { key: Filter; label: string; count: number }[] = [
  { key: 'all', label: 'All', count: map.tickets.length },
  { key: 'frontier', label: 'Frontier', count: frontier.length },
  { key: 'claimed', label: 'Claimed', count: claimed.length },
  { key: 'blocked', label: 'Blocked', count: blocked.length },
  { key: 'decided', label: 'Decided', count: decided.length },
  { key: 'fog', label: 'Fog', count: map.fog.length },
]
const tickets = computed(() =>
  filter.value === 'fog' ? [] : map.tickets.filter((t) => filter.value === 'all' || stateOf(t) === filter.value),
)
const MARK: Record<TicketState, string> = { decided: '✓', frontier: '●', claimed: '◐', blocked: '⊘' }
</script>

<template>
  <div class="c" :class="{ narrow }">
    <div class="list">
      <button class="map-row" :class="{ picked: picked === 'map' }" @click="picked = 'map'">
        <strong><span class="num">#{{ map.number }}</span> {{ map.title }}</strong>
        <span>⚑ destination · {{ decided.length }} decisions · out of scope</span>
      </button>
      <div class="chips">
        <button v-for="c in chips" :key="c.key" :class="{ on: filter === c.key }" @click="filter = c.key">
          {{ c.label }} {{ c.count }}
        </button>
      </div>

      <template v-for="t in tickets" :key="t.number">
        <button class="row" :class="[stateOf(t), { picked: picked === `t${t.number}` }]" @click="picked = `t${t.number}`">
          <span class="mark" :title="stateOf(t)">{{ MARK[stateOf(t)] }}</span>
          <span class="glyph" :title="typeOf(t).name">{{ typeOf(t).glyph }}</span>
          <span class="title"><span class="num">#{{ t.number }}</span> {{ t.title }}</span>
          <span v-if="t === next" class="next">next</span>
          <span
            v-if="sessions.has(t.number)"
            class="dot status"
            :class="statusClass(sessions.get(t.number)!.status)"
            :title="sessions.get(t.number)!.status"
          />
        </button>
        <VariantCFocus v-if="narrow && picked === `t${t.number}`" :id="picked" class="inline" @pick="picked = $event" />
      </template>
      <template v-if="filter === 'all' || filter === 'fog'">
        <template v-for="(f, i) in map.fog" :key="f.title">
          <button class="row fog" :class="{ picked: picked === `f${i}` }" @click="picked = `f${i}`">
            <span class="mark">≋</span>
            <span class="title">{{ f.title }}</span>
          </button>
          <VariantCFocus v-if="narrow && picked === `f${i}`" :id="picked" class="inline" @pick="picked = $event" />
        </template>
      </template>
      <VariantCFocus v-if="narrow && picked === 'map'" id="map" class="inline" @pick="picked = $event" />
    </div>
    <div v-if="!narrow" class="pane">
      <VariantCFocus :id="picked" @pick="picked = $event" />
    </div>
  </div>
</template>

<style scoped>
.c {
  display: grid;
  grid-template-columns: 380px minmax(0, 1fr);
  min-height: 100%;
}
.c.narrow {
  grid-template-columns: minmax(0, 1fr);
}
.list {
  min-width: 0;
  border-right: 1px solid var(--border);
}
.map-row {
  display: grid;
  gap: 2px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: none;
  text-align: left;
}
.map-row span {
  font-size: 11px;
  color: var(--fg-muted);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 12px;
}
.chips button {
  padding: 1px 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: none;
  font-size: 11px;
  color: var(--fg-muted);
}
.chips button.on {
  border-color: var(--accent);
  color: var(--fg);
}
.row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  width: 100%;
  padding: 3px 12px;
  border: 0;
  background: none;
  text-align: left;
}
.row:hover,
.map-row:hover {
  background: var(--bg-hover);
}
.picked {
  background: var(--bg-selected) !important;
}
.mark {
  width: 14px;
  text-align: center;
  flex: none;
  color: var(--fg-muted);
}
.frontier .mark,
.decided .mark {
  color: var(--green);
}
.claimed .mark {
  color: var(--blue);
}
.title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.decided .title,
.blocked .title,
.fog .title {
  color: var(--fg-muted);
}
.next {
  padding: 0 5px;
  border-radius: 3px;
  background: var(--green);
  color: #000;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}
.dot.status {
  padding: 0;
  border: 0;
}
.inline {
  margin: 2px 8px 8px 12px;
  padding: 10px;
  border-left: 2px solid var(--accent);
  background: var(--bg-raised);
}
</style>
