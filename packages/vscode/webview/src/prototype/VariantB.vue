<script setup lang="ts">
// PROTOTYPE — Variant B, "Graph": the whole map as one dependency graph, fog and destination
// included. Three layouts to compare: hand-rolled "waves" (column = how many resolutions away),
// hand-rolled longest-path, and dagre.
import { computed, ref } from 'vue'

import {
  command,
  cycleStatus,
  fogBehind,
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
  unblocks,
  waveOf,
} from './data.ts'
import type { Dir, LEdge, LNode } from './layout.ts'
import { dagreLayout, edgePath, layered, longestPath } from './layout.ts'

const props = defineProps<{ narrow: boolean }>()

type Engine = 'waves' | 'longest-path' | 'dagre'
// `?layout=` and `?dir=` preselect these, so a comparison can be shared as a URL.
const query = new URLSearchParams(location.search)
const engine = ref<Engine>((query.get('layout') as Engine | null) ?? 'waves')
const dir = ref<Dir>((query.get('dir') as Dir | null) ?? 'LR')
const showDecided = ref(true)
const picked = ref<string | null>(null)

const graph = computed(() => {
  const w = props.narrow ? 150 : 200
  const tickets = map.tickets.filter((t) => showDecided.value || isOpen(t))
  const shown = new Set(tickets.map((t) => t.number))
  const nodes: LNode[] = [
    ...tickets.map((t) => ({ id: `t${t.number}`, w, h: 58 })),
    ...map.fog.map((_, i) => ({ id: `f${i}`, w: w - 20, h: 44 })),
    { id: 'dest', w: 150, h: 58 },
  ]
  const edges: LEdge[] = [
    ...tickets.flatMap((t) =>
      t.blockedBy.filter((b) => shown.has(b)).map((b) => ({ from: `t${b}`, to: `t${t.number}` })),
    ),
    ...map.fog.flatMap((f, i) =>
      f.waitsOn.filter((n) => shown.has(n)).map((n) => ({ from: `t${n}`, to: `f${i}` })),
    ),
  ]
  // Every loose end leads to the destination; these only steer placement.
  const hidden: LEdge[] = nodes
    .filter((n) => n.id !== 'dest' && !edges.some((e) => e.from === n.id))
    .map((n) => ({ from: n.id, to: 'dest', hidden: true }))
  return { nodes, edges, all: [...edges, ...hidden] }
})

/** Column = distance from being takeable: decisions, then the frontier, then what it unlocks. */
function waveLayers(): Map<string, number> {
  const closed = map.tickets.filter((t) => !isOpen(t))
  const depth = (n: number): number =>
    Math.max(0, ...closed.filter((t) => t.blockedBy.includes(n)).map((t) => depth(t.number) + 1))
  const deepest = Math.max(0, ...closed.map((t) => depth(t.number)))
  const base = showDecided.value ? deepest + 1 : 0
  const layers = new Map<string, number>()
  for (const t of map.tickets) {
    layers.set(`t${t.number}`, isOpen(t) ? base + waveOf(t) - 1 : deepest - depth(t.number))
  }
  map.fog.forEach((f, i) => layers.set(`f${i}`, base + fogWave(f) - 1))
  const last = Math.max(...graph.value.nodes.filter((n) => n.id !== 'dest').map((n) => layers.get(n.id)!))
  layers.set('dest', last + 1)
  return layers
}

const layout = computed(() => {
  const { nodes, all } = graph.value
  if (engine.value === 'dagre') return dagreLayout(nodes, all, dir.value)
  const layers = engine.value === 'waves' ? waveLayers() : longestPath(nodes, all)
  return layered(nodes, all, layers, dir.value)
})

const related = computed(() => {
  if (!picked.value) return null
  const seen = new Set([picked.value])
  const walk = (id: string, forward: boolean): void => {
    for (const e of graph.value.edges) {
      const [here, there] = forward ? [e.from, e.to] : [e.to, e.from]
      if (here === id && !seen.has(there)) {
        seen.add(there)
        walk(there, forward)
      }
    }
  }
  walk(picked.value, true)
  walk(picked.value, false)
  return seen
})
const faded = (id: string): boolean => related.value !== null && !related.value.has(id)

const pickedTicket = computed(() =>
  picked.value?.startsWith('t') ? ticket(Number(picked.value.slice(1))) : null,
)
const pickedFog = computed(() =>
  picked.value?.startsWith('f') ? map.fog[Number(picked.value.slice(1))] : null,
)
const style = (id: string): Record<string, string> => {
  const at = layout.value.nodes.get(id)!
  return { left: `${at.x}px`, top: `${at.y}px`, width: `${at.w}px`, height: `${at.h}px` }
}
</script>

<template>
  <div class="b">
    <div class="toolbar">
      <strong>{{ map.title }}</strong>
      <span class="spacer" />
      <label>
        layout
        <select v-model="engine">
          <option value="waves">waves (hand-rolled)</option>
          <option value="longest-path">longest path (hand-rolled)</option>
          <option value="dagre">dagre</option>
        </select>
      </label>
      <label>
        <select v-model="dir">
          <option value="LR">left → right</option>
          <option value="TB">top → bottom</option>
        </select>
      </label>
      <label><input v-model="showDecided" type="checkbox" /> decisions</label>
    </div>
    <div class="legend">
      <span class="key decided">decided</span>
      <span class="key frontier">frontier</span>
      <span class="key claimed">claimed</span>
      <span class="key blocked">blocked</span>
      <span class="key fog">fog</span>
    </div>

    <div class="canvas" :style="{ width: `${layout.width}px`, height: `${layout.height}px` }" @click="picked = null">
      <svg :width="layout.width" :height="layout.height">
        <defs>
          <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="context-stroke" />
          </marker>
        </defs>
        <path
          v-for="e in graph.edges"
          :key="`${e.from}-${e.to}`"
          :d="edgePath(layout.nodes.get(e.from)!, layout.nodes.get(e.to)!, dir)"
          :class="{
            edge: true,
            foggy: e.to.startsWith('f'),
            live: e.from.startsWith('t') && isOpen(ticket(Number(e.from.slice(1)))),
            faded: faded(e.from) || faded(e.to),
          }"
          marker-end="url(#arrow)"
        />
      </svg>

      <template v-for="t in map.tickets" :key="t.number">
        <div
          v-if="layout.nodes.has(`t${t.number}`)"
          class="node"
          :class="[stateOf(t), { picked: picked === `t${t.number}`, faded: faded(`t${t.number}`) }]"
          :style="style(`t${t.number}`)"
          :title="t.gist ?? t.question"
          @click.stop="picked = `t${t.number}`"
        >
          <div class="title">
            <span class="glyph" :title="typeOf(t).name">{{ stateOf(t) === 'decided' ? '✓' : typeOf(t).glyph }}</span>
            <span class="text">{{ t.title }}</span>
          </div>
          <div class="foot">
            <span v-if="sessions.has(t.number)" class="status" :class="statusClass(sessions.get(t.number)!.status)">
              {{ sessions.get(t.number)!.status }}
            </span>
            <span v-else-if="stateOf(t) === 'frontier'" class="tag">{{ t === next ? 'next' : 'frontier' }}</span>
            <span v-else-if="stateOf(t) === 'blocked'" class="muted">⊘ {{ openBlockers(t).length }} open blocker</span>
            <span class="spacer" />
            <span v-if="t.assignee && isOpen(t)" class="claim" :title="`claimed by ${t.assignee}`">
              {{ t.assignee.slice(0, 2) }}
            </span>
          </div>
        </div>
      </template>
      <div
        v-for="(f, i) in map.fog"
        :key="f.title"
        class="node fog"
        :class="{ picked: picked === `f${i}`, faded: faded(`f${i}`) }"
        :style="style(`f${i}`)"
        :title="f.text"
        @click.stop="picked = `f${i}`"
      >
        <div class="title"><span class="glyph">≋</span><span class="text">{{ f.title }}</span></div>
      </div>
      <div class="node dest" :style="style('dest')" :title="map.destination">
        <div class="title"><span class="glyph">⚑</span><span class="text">Destination: v0.1.0 fully decided</span></div>
      </div>
    </div>

    <div v-if="pickedTicket" class="detail">
      <div class="head">
        <strong>{{ pickedTicket.title }}</strong>
        <span class="muted">{{ typeOf(pickedTicket).name }} · {{ typeOf(pickedTicket).mode }}</span>
        <button
          v-if="sessions.has(pickedTicket.number)"
          class="status"
          :class="statusClass(sessions.get(pickedTicket.number)!.status)"
          @click="cycleStatus(pickedTicket.number)"
        >
          {{ sessions.get(pickedTicket.number)!.status }}
        </button>
      </div>
      <div>{{ pickedTicket.gist ?? pickedTicket.question }}</div>
      <div v-if="openBlockers(pickedTicket).length" class="muted">
        ⊘ waits on {{ openBlockers(pickedTicket).map((b) => b.title).join(' · ') }}
      </div>
      <div v-if="unblocks(pickedTicket).length || fogBehind(pickedTicket).length" class="muted">
        → clears the way for
        {{ [...unblocks(pickedTicket).map((u) => u.title), ...fogBehind(pickedTicket).map((f) => `≋ ${f.title}`)].join(' · ') }}
      </div>
      <div v-if="stateOf(pickedTicket) === 'frontier' && !sessions.has(pickedTicket.number)" class="act">
        <button class="btn" @click="launch(pickedTicket.number)">▶ Work ticket</button>
        <code class="cmd">{{ command(pickedTicket) }}</code>
      </div>
    </div>
    <div v-else-if="pickedFog" class="detail">
      <div class="head"><strong>≋ {{ pickedFog.title }}</strong> <span class="muted">fog</span></div>
      <div>{{ pickedFog.text }}</div>
      <div class="muted">⊘ waits on {{ pickedFog.waitsOn.map((n) => ticket(n).title).join(' · ') }}</div>
    </div>
  </div>
</template>

<style scoped>
.b {
  min-width: max-content;
}
.toolbar,
.legend {
  position: sticky;
  left: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  width: var(--frame-w, 100vw);
}
.toolbar {
  border-bottom: 1px solid var(--border);
}
.spacer {
  flex: 1;
}
select {
  background: var(--bg-raised);
  color: var(--fg);
  border: 1px solid var(--border);
  font: inherit;
}
.legend {
  padding-block: 6px 0;
  font-size: 11px;
  color: var(--fg-muted);
}
.key::before {
  content: '';
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 4px;
  border: 1.5px solid var(--fg-muted);
  border-radius: 2px;
  vertical-align: -1px;
}
.key.decided::before {
  border-color: var(--green);
  opacity: 0.6;
}
.key.frontier::before {
  border-color: var(--green);
  background: var(--green);
}
.key.claimed::before {
  border-color: var(--blue);
}
.key.fog::before {
  border-style: dashed;
}
.canvas {
  position: relative;
}
svg {
  position: absolute;
  inset: 0;
}
.edge {
  fill: none;
  stroke: var(--fg-muted);
  stroke-width: 1.2;
  opacity: 0.45;
}
.edge.live {
  stroke: var(--amber);
  opacity: 0.9;
}
.edge.foggy {
  stroke-dasharray: 4 4;
}
.edge.faded {
  opacity: 0.08;
}
.node {
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 5px 7px;
  border: 1.5px solid var(--border);
  border-radius: 5px;
  background: var(--bg-raised);
  font-size: 12px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.node .title {
  display: flex;
  gap: 4px;
}
.node .text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.25;
}
.foot {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}
.node.decided {
  border-color: color-mix(in srgb, var(--green) 45%, transparent);
  color: var(--fg-muted);
}
.node.decided .glyph {
  color: var(--green);
}
.node.frontier {
  border-color: var(--green);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--green) 25%, transparent);
}
.node.claimed {
  border-color: var(--blue);
}
.node.blocked {
  color: var(--fg-muted);
}
.node.fog {
  border-style: dashed;
  border-radius: 22px;
  background: transparent;
  color: var(--fg-muted);
  justify-content: center;
}
.node.dest {
  border-color: var(--fg);
  justify-content: center;
  font-weight: 600;
}
.node.picked {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.node.faded {
  opacity: 0.25;
}
.tag {
  padding: 0 5px;
  border-radius: 3px;
  background: var(--green);
  color: #000;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}
.muted {
  color: var(--fg-muted);
}
.detail {
  position: fixed;
  left: 12px;
  bottom: 56px;
  z-index: 10;
  display: grid;
  gap: 5px;
  width: min(560px, calc(100vw - 24px));
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-raised);
  box-shadow: 0 6px 24px rgb(0 0 0 / 40%);
  font-size: 12px;
}
.narrow-detail {
  width: 316px;
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.act {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
</style>
