<script setup lang="ts">
// PROTOTYPE — Maps variant M2, "One tree": every map is a node that unfolds in place, like the
// file explorer. No drilling in; several maps can be open at once. Finished maps are one folder.
import { reactive } from 'vue'

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
  named,
} from './data.ts'
import type { Summary, TicketState } from './data.ts'

defineProps<{ narrow: boolean }>()

const first = orderedActive.value[0]
const unfolded = reactive(new Set<string>(first ? [`m${first.map.number}`] : []))
const toggle = (key: string): void => void (unfolded.has(key) ? unfolded.delete(key) : unfolded.add(key))
const twisty = (key: string): string => (unfolded.has(key) ? '▾' : '▸')

const MARK: Record<TicketState, string> = { decided: '✓', frontier: '●', claimed: '◐', blocked: '⊘' }
const openTickets = (s: Summary) => [...s.claimed, ...s.frontier, ...s.blocked]
</script>

<template>
  <div class="m2">
    <template v-for="s in orderedActive" :key="s.map.number">
      <div class="row map" @click="toggle(`m${s.map.number}`)">
        <span class="twisty">{{ twisty(`m${s.map.number}`) }}</span>
        <span class="label"><span class="num">#{{ s.map.number }}</span> {{ s.map.title }}</span>
        <span v-if="needsYouIn(s.map).length" class="badge you" title="sessions that need you">
          {{ needsYouIn(s.map).length }}
        </span>
        <span v-if="s.frontier.length" class="badge takeable" title="frontier tickets">{{ s.frontier.length }}</span>
        <span v-else-if="stuck(s)" class="badge" title="nothing takeable">⊘</span>
        <span class="desc">{{ s.decided.length }}/{{ s.map.tickets.length }}</span>
      </div>

      <template v-if="unfolded.has(`m${s.map.number}`)">
        <div class="row d1 dim" :title="s.map.destination">
          <span class="mark">⚑</span><span class="label">{{ s.map.destination }}</span>
        </div>
        <div v-for="t in openTickets(s)" :key="t.number" class="row d1" :class="stateOf(t)">
          <span class="mark" :title="stateOf(t)">{{ MARK[stateOf(t)] }}</span>
          <span class="glyph" :title="typeOf(t).name">{{ typeOf(t).glyph }}</span>
          <span class="label">
            <span class="num">#{{ t.number }}</span> {{ t.title }}
            <span v-if="stateOf(t) === 'blocked'" class="desc">
              waits on {{ openBlockers(t).map(named).join(' · ') }}
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

        <template v-if="s.map.fog.length">
          <div class="row d1 dim" @click="toggle(`m${s.map.number}:fog`)">
            <span class="twisty">{{ twisty(`m${s.map.number}:fog`) }}</span>
            <span class="label">≋ Fog</span><span class="desc">{{ s.map.fog.length }}</span>
          </div>
          <template v-if="unfolded.has(`m${s.map.number}:fog`)">
            <div v-for="f in s.map.fog" :key="f.title" class="row d2 dim" :title="f.text">
              <span class="label">
                {{ f.title }}
                <span class="desc">
                  waits on
                  {{
                    f.waitsOn
                      .map(ticket)
                      .filter((t) => t.state === 'OPEN')
                      .map(named)
                      .join(' · ')
                  }}
                </span>
              </span>
            </div>
          </template>
        </template>
        <template v-if="s.decided.length">
          <div class="row d1 dim" @click="toggle(`m${s.map.number}:dec`)">
            <span class="twisty">{{ twisty(`m${s.map.number}:dec`) }}</span>
            <span class="label">✓ Decisions so far</span><span class="desc">{{ s.decided.length }}</span>
          </div>
          <template v-if="unfolded.has(`m${s.map.number}:dec`)">
            <div v-for="t in s.decided" :key="t.number" class="row d2 dim" :title="t.gist ?? ''">
              <span class="label"><span class="num">#{{ t.number }}</span> {{ t.title }}</span>
            </div>
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
        <div class="row d1 dim" @click="toggle(`m${s.map.number}`)">
          <span class="twisty">{{ twisty(`m${s.map.number}`) }}</span>
          <span class="label"><span class="num">#{{ s.map.number }}</span> {{ s.map.title }}</span>
          <span class="desc">{{ s.decided.length }} · {{ finishedText(s.map) }}</span>
        </div>
        <template v-if="unfolded.has(`m${s.map.number}`)">
          <div v-for="t in s.decided" :key="t.number" class="row d2 dim">
            <span class="mark">✓</span><span class="label"><span class="num">#{{ t.number }}</span> {{ t.title }}</span>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>

<style scoped>
.m2 {
  padding-top: 4px;
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
.row:hover {
  background: var(--bg-hover);
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
</style>
