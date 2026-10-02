<script setup lang="ts">
// PROTOTYPE — Maps variant M4, "Tree + focus": Eduardo's merge of M2 and C. The tree from M2 on
// the left; clicking any row (map, ticket, fog) shows C's focus pane on the right, or inline
// under the row at sidebar width. A "cards" toggle swaps the active maps' rows for M1's cards.
import { computed, reactive, ref } from 'vue'

import {
  command,
  cycleStatus,
  finishedMaps,
  finishedText,
  launch,
  needsYouIn,
  openBlockers,
  orderedActive,
  sessions,
  stateOf,
  statusClass,
  stuck,
  ticket,
  typeOf,
} from './data.ts'
import type { Summary, TicketState } from './data.ts'
import VariantCFocus from './VariantCFocus.vue'

defineProps<{ narrow: boolean }>()

const first = orderedActive.value[0]
const unfolded = reactive(new Set<string>(first ? [`m${first.map.number}`] : []))
const toggle = (key: string): void => void (unfolded.has(key) ? unfolded.delete(key) : unfolded.add(key))
const twisty = (key: string): string => (unfolded.has(key) ? '▾' : '▸')
const picked = ref(first?.next ? `t${first.next.number}` : first ? `m${first.map.number}` : '')
const density = ref<'compact' | 'cards'>('compact')

const MARK: Record<TicketState, string> = { decided: '✓', frontier: '●', claimed: '◐', blocked: '⊘' }
const openTickets = (s: Summary) => [...s.claimed, ...s.frontier, ...s.blocked]
const needsYou = computed(() => orderedActive.value.flatMap((s) => needsYouIn(s.map)).length)
</script>

<template>
  <div class="m4" :class="{ narrow }">
    <div class="tree">
      <div class="bar">
        <span class="muted">{{ orderedActive.length }} active · {{ finishedMaps.length }} finished</span>
        <span v-if="needsYou" class="badge you">{{ needsYou }} need you</span>
        <span class="spacer" />
        <button class="density" :class="{ on: density === 'compact' }" @click="density = 'compact'">compact</button>
        <button class="density" :class="{ on: density === 'cards' }" @click="density = 'cards'">cards</button>
      </div>

      <template v-for="s in orderedActive" :key="s.map.number">
        <!-- Map row: compact (M2) or card (M1). Either way, click = select; twisty = unfold. -->
        <div
          v-if="density === 'compact'"
          class="row map"
          :class="{ picked: picked === `m${s.map.number}` }"
          @click="picked = `m${s.map.number}`"
        >
          <span class="twisty" @click.stop="toggle(`m${s.map.number}`)">{{ twisty(`m${s.map.number}`) }}</span>
          <span class="label"><span class="num">#{{ s.map.number }}</span> {{ s.map.title }}</span>
          <span v-if="needsYouIn(s.map).length" class="badge you">{{ needsYouIn(s.map).length }}</span>
          <span v-if="s.frontier.length" class="badge takeable">{{ s.frontier.length }}</span>
          <span v-else-if="stuck(s)" class="badge" title="nothing takeable">⊘</span>
          <span class="desc">{{ s.decided.length }}/{{ s.map.tickets.length }}</span>
        </div>
        <div
          v-else
          class="card"
          :class="{ picked: picked === `m${s.map.number}` }"
          @click="picked = `m${s.map.number}`"
        >
          <div class="card-head">
            <span class="twisty" @click.stop="toggle(`m${s.map.number}`)">{{ twisty(`m${s.map.number}`) }}</span>
            <span class="label strong"><span class="num">#{{ s.map.number }}</span> {{ s.map.title }}</span>
            <span class="desc">{{ s.decided.length }}/{{ s.map.tickets.length }}</span>
          </div>
          <div class="progress"><div :style="{ width: `${(s.decided.length / s.map.tickets.length) * 100}%` }" /></div>
          <div class="counts">
            <span v-if="needsYouIn(s.map).length" class="c-you">! {{ needsYouIn(s.map).length }} need you</span>
            <span v-if="s.frontier.length" class="c-frontier">● {{ s.frontier.length }} frontier</span>
            <span v-if="s.claimed.length" class="c-claimed">◐ {{ s.claimed.length }} claimed</span>
            <span v-if="s.blocked.length">⊘ {{ s.blocked.length }} blocked</span>
            <span v-if="s.map.fog.length">≋ {{ s.map.fog.length }} fog</span>
          </div>
          <div v-if="s.next && !unfolded.has(`m${s.map.number}`)" class="next-line" @click.stop="picked = `t${s.next.number}`">
            <span class="next">next</span>
            <span class="label"><span class="num">#{{ s.next.number }}</span> {{ s.next.title }}</span>
          </div>
          <div v-else-if="stuck(s) && !unfolded.has(`m${s.map.number}`)" class="stuck">
            nothing takeable · waits on
            <span v-for="t in s.claimed" :key="t.number"><span class="num">#{{ t.number }}</span> {{ t.title }}</span>
          </div>
        </div>
        <VariantCFocus v-if="narrow && picked === `m${s.map.number}`" :id="picked" class="inline" @pick="picked = $event" />

        <template v-if="unfolded.has(`m${s.map.number}`)">
          <template v-for="t in openTickets(s)" :key="t.number">
            <div class="row d1" :class="[stateOf(t), { picked: picked === `t${t.number}` }]" @click="picked = `t${t.number}`">
              <span class="mark" :title="stateOf(t)">{{ MARK[stateOf(t)] }}</span>
              <span class="glyph" :title="typeOf(t).name">{{ typeOf(t).glyph }}</span>
              <span class="label">
                <span class="num">#{{ t.number }}</span> {{ t.title }}
                <span v-if="stateOf(t) === 'blocked'" class="desc">
                  waits on {{ openBlockers(t).map((b) => `#${b.number}`).join(' ') }}
                </span>
              </span>
              <button
                v-if="sessions.has(t.number)"
                class="status"
                :class="statusClass(sessions.get(t.number)!.status)"
                @click.stop="cycleStatus(t.number)"
              >
                {{ sessions.get(t.number)!.status }}
              </button>
              <span v-else-if="t === s.next" class="next">next</span>
              <button
                v-if="stateOf(t) === 'frontier' && !sessions.has(t.number)"
                class="btn"
                :title="command(t)"
                @click.stop="launch(t.number)"
              >
                ▶
              </button>
            </div>
            <VariantCFocus v-if="narrow && picked === `t${t.number}`" :id="picked" class="inline" @pick="picked = $event" />
          </template>

          <template v-if="s.map.fog.length">
            <div class="row d1 dim" @click="toggle(`m${s.map.number}:fog`)">
              <span class="twisty">{{ twisty(`m${s.map.number}:fog`) }}</span>
              <span class="label">≋ Fog</span><span class="desc">{{ s.map.fog.length }}</span>
            </div>
            <template v-if="unfolded.has(`m${s.map.number}:fog`)">
              <template v-for="(f, i) in s.map.fog" :key="f.title">
                <div
                  class="row d2 dim"
                  :class="{ picked: picked === `f${s.map.number}:${i}` }"
                  @click="picked = `f${s.map.number}:${i}`"
                >
                  <span class="label">
                    {{ f.title }}
                    <span class="desc">
                      waits on {{ f.waitsOn.map(ticket).filter((t) => t.state === 'OPEN').map((t) => `#${t.number}`).join(' ') }}
                    </span>
                  </span>
                </div>
                <VariantCFocus v-if="narrow && picked === `f${s.map.number}:${i}`" :id="picked" class="inline" @pick="picked = $event" />
              </template>
            </template>
          </template>
          <template v-if="s.decided.length">
            <div class="row d1 dim" @click="toggle(`m${s.map.number}:dec`)">
              <span class="twisty">{{ twisty(`m${s.map.number}:dec`) }}</span>
              <span class="label">✓ Decisions so far</span><span class="desc">{{ s.decided.length }}</span>
            </div>
            <template v-if="unfolded.has(`m${s.map.number}:dec`)">
              <template v-for="t in s.decided" :key="t.number">
                <div class="row d2 dim" :class="{ picked: picked === `t${t.number}` }" @click="picked = `t${t.number}`">
                  <span class="label"><span class="num">#{{ t.number }}</span> {{ t.title }}</span>
                </div>
                <VariantCFocus v-if="narrow && picked === `t${t.number}`" :id="picked" class="inline" @pick="picked = $event" />
              </template>
            </template>
          </template>
        </template>
      </template>

      <div class="row map dim" @click="toggle('finished')">
        <span class="twisty">{{ twisty('finished') }}</span>
        <span class="label">Finished</span>
        <span class="desc">{{ finishedMaps.length }} maps</span>
      </div>
      <template v-if="unfolded.has('finished')">
        <template v-for="s in finishedMaps" :key="s.map.number">
          <div class="row d1 dim" :class="{ picked: picked === `m${s.map.number}` }" @click="picked = `m${s.map.number}`">
            <span class="twisty" @click.stop="toggle(`m${s.map.number}`)">{{ twisty(`m${s.map.number}`) }}</span>
            <span class="label"><span class="num">#{{ s.map.number }}</span> {{ s.map.title }}</span>
            <span class="desc">{{ s.decided.length }} · {{ finishedText(s.map) }}</span>
          </div>
          <VariantCFocus v-if="narrow && picked === `m${s.map.number}`" :id="picked" class="inline" @pick="picked = $event" />
          <template v-if="unfolded.has(`m${s.map.number}`)">
            <template v-for="t in s.decided" :key="t.number">
              <div class="row d2 dim" :class="{ picked: picked === `t${t.number}` }" @click="picked = `t${t.number}`">
                <span class="mark">✓</span><span class="label"><span class="num">#{{ t.number }}</span> {{ t.title }}</span>
              </div>
              <VariantCFocus v-if="narrow && picked === `t${t.number}`" :id="picked" class="inline" @pick="picked = $event" />
            </template>
          </template>
        </template>
      </template>
    </div>
    <div v-if="!narrow" class="pane">
      <VariantCFocus v-if="picked" :id="picked" @pick="picked = $event" />
    </div>
  </div>
</template>

<style scoped>
.m4 {
  display: grid;
  grid-template-columns: 420px minmax(0, 1fr);
  min-height: 100%;
}
.m4.narrow {
  grid-template-columns: minmax(0, 1fr);
}
.tree {
  min-width: 0;
  padding-top: 4px;
  border-right: 1px solid var(--border);
}
.bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 8px;
}
.spacer {
  flex: 1;
}
.density {
  padding: 0 7px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: none;
  font-size: 11px;
  color: var(--fg-muted);
}
.density.on {
  border-color: var(--accent);
  color: var(--fg);
}
.muted {
  font-size: 11px;
  color: var(--fg-muted);
}
.row {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 10px 0 6px;
  white-space: nowrap;
  cursor: pointer;
}
.row:hover,
.card:hover {
  background: var(--bg-hover);
}
.picked {
  background: var(--bg-selected) !important;
}
.row.map {
  font-weight: 600;
}
.d1 {
  padding-left: 22px;
}
.d2 {
  padding-left: 40px;
}
.twisty,
.mark {
  width: 14px;
  flex: none;
  text-align: center;
  color: var(--fg-muted);
}
.label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.strong {
  font-weight: 600;
}
.desc {
  margin-left: 4px;
  font-size: 11px;
  font-weight: 400;
  color: var(--fg-muted);
}
.dim .label,
.blocked .label {
  color: var(--fg-muted);
}
.row.map.dim .label {
  font-weight: 400;
}
.frontier .mark {
  color: var(--green);
}
.claimed .mark {
  color: var(--blue);
}
.badge {
  min-width: 16px;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--badge-bg);
  color: var(--badge-fg);
  font-size: 10px;
  font-weight: 600;
  line-height: 15px;
  text-align: center;
}
.badge.takeable {
  background: var(--green);
  color: #000;
}
.badge.you {
  background: var(--amber);
  color: #000;
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
.btn {
  display: none;
  padding: 0 6px;
  line-height: 16px;
}
.row:hover .btn {
  display: block;
}
.card {
  margin: 3px 8px 6px;
  padding: 7px 9px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg-raised);
  cursor: pointer;
}
.card.picked {
  border-color: var(--accent);
}
.card-head {
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.progress {
  height: 3px;
  margin: 6px 0;
  border-radius: 2px;
  background: var(--border);
}
.progress div {
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
.c-you {
  color: var(--amber);
}
.c-frontier {
  color: var(--green);
}
.c-claimed {
  color: var(--blue);
}
.next-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
  white-space: nowrap;
}
.next-line:hover .label {
  color: var(--accent);
}
.stuck {
  margin-top: 6px;
  font-size: 12px;
  color: var(--amber);
}
.stuck span {
  color: var(--fg-muted);
}
.inline {
  margin: 2px 8px 8px 12px;
  padding: 10px;
  border-left: 2px solid var(--accent);
  background: var(--bg-raised);
}
</style>
