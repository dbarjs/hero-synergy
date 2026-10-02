<script setup lang="ts">
// PROTOTYPE — Variant D, "Route": the graph flattened into a trail. Vertical position is distance
// to the destination: walked decisions, then what's takeable now, then what each resolution
// opens up (tickets and fog alike), then the destination. Hovering an item lights up what it
// waits on and what it clears.
import { computed, ref } from 'vue'

import {
  agoText,
  command,
  cycleStatus,
  decided,
  fogWave,
  isOpen,
  launch,
  map,
  next,
  openBlockers,
  sessions,
  stateOf,
  statusClass,
  ticket,
  typeOf,
  waveOf,
} from './data.ts'
import type { Fog, Ticket } from './data.ts'

defineProps<{ narrow: boolean }>()

const walkedOpen = ref(false)
const outOpen = ref(false)
const hover = ref<string | null>(null)

interface Stop {
  id: string
  ticket?: Ticket
  fog?: Fog
  waitsOn: Ticket[]
}
const stops: Stop[] = [
  ...map.tickets.filter(isOpen).map((t) => ({ id: `t${t.number}`, ticket: t, waitsOn: openBlockers(t) })),
  ...map.fog.map((f, i) => ({ id: `f${i}`, fog: f, waitsOn: f.waitsOn.map(ticket).filter(isOpen) })),
]
const waveOfStop = (s: Stop): number => (s.ticket ? waveOf(s.ticket) : fogWave(s.fog!))
const waves = computed(() => {
  const last = Math.max(...stops.map(waveOfStop))
  return Array.from({ length: last }, (_, i) => ({
    wave: i + 1,
    // Within "now": sessions first, then the frontier in map order.
    stops: stops
      .filter((s) => waveOfStop(s) === i + 1)
      .toSorted((a, b) => Number(!!b.ticket?.assignee) - Number(!!a.ticket?.assignee)),
  }))
})
const WAVE_NAME = ['Now', 'Then', 'After that']

/** Lit when hovered, or linked to the hovered stop in either direction. */
function lit(s: Stop): boolean {
  if (!hover.value) return false
  if (s.id === hover.value) return true
  const hovered = stops.find((x) => x.id === hover.value)!
  return (
    s.waitsOn.some((b) => `t${b.number}` === hover.value) ||
    hovered.waitsOn.some((b) => `t${b.number}` === s.id)
  )
}
</script>

<template>
  <div class="d">
    <div class="map-title">{{ map.title }}</div>

    <div class="stage">
      <div class="stage-name fold" @click="walkedOpen = !walkedOpen">
        {{ walkedOpen ? '▾' : '▸' }} Walked · {{ decided.length }} decisions so far
      </div>
      <div v-if="!walkedOpen" class="stop compact">
        <span class="pin done">✓</span>
        <div class="trail-dots" :title="decided.map((t) => t.title).join('\n')">
          <span v-for="t in decided" :key="t.number" :title="t.title">✓</span>
        </div>
      </div>
      <template v-else>
        <div v-for="t in decided" :key="t.number" class="stop walked">
          <span class="pin done">✓</span>
          <div class="body">
            <div class="title">{{ t.title }}</div>
            <div class="sub">{{ t.gist }}</div>
          </div>
        </div>
      </template>
    </div>

    <div class="here">you are here</div>

    <div v-for="w in waves" :key="w.wave" class="stage">
      <div class="stage-name">
        {{ WAVE_NAME[w.wave - 1] ?? `${w.wave - 1} resolutions away` }}
        <span class="muted">
          {{ w.wave === 1 ? '· takeable or in session' : '· opens once the tickets above resolve' }}
        </span>
      </div>
      <div
        v-for="s in w.stops"
        :key="s.id"
        class="stop"
        :class="[s.ticket ? stateOf(s.ticket) : 'fog', { lit: lit(s), unlit: hover && !lit(s) }]"
        @mouseenter="hover = s.id"
        @mouseleave="hover = null"
      >
        <template v-if="s.ticket">
          <span class="pin" />
          <div class="body">
            <div class="title">
              <span class="glyph" :title="typeOf(s.ticket).name">{{ typeOf(s.ticket).glyph }}</span>
              {{ s.ticket.title }}
              <span v-if="s.ticket === next" class="next">next</span>
            </div>
            <div v-if="sessions.has(s.ticket.number)" class="sub">
              <button
                class="status"
                :class="statusClass(sessions.get(s.ticket.number)!.status)"
                @click="cycleStatus(s.ticket.number)"
              >
                {{ sessions.get(s.ticket.number)!.status }}
              </button>
              {{ agoText(sessions.get(s.ticket.number)!) }}
              <template v-if="s.ticket.assignee"> · claimed by {{ s.ticket.assignee }}</template>
              <template v-else> · not claimed on the tracker yet</template>
            </div>
            <div v-else-if="s.ticket.assignee" class="sub">claimed by {{ s.ticket.assignee }} · no live session</div>
            <div v-for="b in s.waitsOn" :key="b.number" class="sub waits">↳ after <em>{{ b.title }}</em></div>
            <code v-if="s.ticket === next && !sessions.has(s.ticket.number)" class="cmd">{{ command(s.ticket) }}</code>
          </div>
          <button
            v-if="stateOf(s.ticket) === 'frontier' && !sessions.has(s.ticket.number)"
            class="btn"
            :title="command(s.ticket)"
            @click="launch(s.ticket.number)"
          >
            ▶
          </button>
        </template>
        <template v-else>
          <span class="pin" />
          <div class="body">
            <div class="title"><span class="glyph">≋</span> {{ s.fog!.title }}</div>
            <div class="sub clamp">{{ s.fog!.text }}</div>
            <div v-for="b in s.waitsOn" :key="b.number" class="sub waits">↳ after <em>{{ b.title }}</em></div>
          </div>
        </template>
      </div>
    </div>

    <div class="stage end">
      <div class="stop dest">
        <span class="pin flag">⚑</span>
        <div class="body">
          <div class="title">Destination</div>
          <div class="sub pre">{{ map.destination }}</div>
          <div class="sub fold" @click="outOpen = !outOpen">{{ outOpen ? '▾' : '▸' }} Out of scope</div>
          <template v-if="outOpen">
            <div v-for="line in map.outOfScope" :key="line" class="sub">{{ line }}</div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.d {
  max-width: 620px;
  padding: 10px 12px 0;
}
.map-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.stage {
  position: relative;
  padding-left: 22px;
}
/* The rail. */
.stage::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--border);
}
.stage:first-of-type::before {
  background: var(--green);
  opacity: 0.6;
}
.stage.end::before {
  bottom: auto;
  height: 12px;
}
.stage-name {
  padding: 8px 0 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.fold {
  cursor: pointer;
}
.muted {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: var(--fg-muted);
}
.here {
  margin: 6px 0 2px;
  padding: 1px 8px;
  width: max-content;
  border-radius: 9px;
  background: var(--fg);
  color: var(--bg);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}
.stop {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 4px 6px 4px 0;
  border-radius: 4px;
  transition: opacity 0.12s;
}
.stop:hover,
.stop.lit {
  background: var(--bg-hover);
}
.stop.unlit {
  opacity: 0.35;
}
.pin {
  position: absolute;
  left: -19px;
  top: 8px;
  width: 10px;
  height: 10px;
  border: 2px solid var(--fg-muted);
  border-radius: 50%;
  background: var(--bg);
}
.pin.done,
.pin.flag {
  border: 0;
  top: 4px;
  left: -21px;
  width: 14px;
  background: var(--bg);
  color: var(--green);
  font-size: 12px;
  text-align: center;
}
.frontier .pin {
  border-color: var(--green);
  background: var(--green);
}
.claimed .pin {
  border-color: var(--blue);
  background: linear-gradient(90deg, var(--blue) 50%, var(--bg) 50%);
}
.fog .pin {
  border-style: dashed;
}
.body {
  flex: 1;
  min-width: 0;
}
.sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--fg-muted);
}
.sub.clamp {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pre {
  white-space: pre-line;
}
.waits em {
  font-style: normal;
  color: var(--fg);
}
.blocked .title,
.fog .title,
.walked .title {
  color: var(--fg-muted);
}
.cmd {
  margin-top: 4px;
}
.btn {
  visibility: hidden;
  padding: 2px 7px;
}
.stop:hover .btn {
  visibility: visible;
}
.trail-dots {
  display: flex;
  gap: 5px;
  color: var(--green);
  opacity: 0.7;
  font-size: 11px;
}
.compact .pin {
  display: none;
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
.dest .title {
  font-weight: 600;
}
</style>
