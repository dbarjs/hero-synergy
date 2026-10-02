<script setup lang="ts">
// PROTOTYPE — Variant A, "Frontier list": a sidebar-shaped list grouped by what you can do now.
// No graph at all; a blocked ticket names its blockers in a line of text.
import { reactive } from 'vue'

import {
  agoText,
  blocked,
  claimed,
  command,
  cycleStatus,
  decided,
  frontier,
  launch,
  map,
  needsYou,
  next,
  openBlockers,
  sessions,
  statusClass,
  ticket,
  typeOf,
} from './data.ts'

defineProps<{ narrow: boolean }>()

const open = reactive({ destination: false, fog: false, decided: false, out: false })
const expanded = reactive(new Set<number>())
const toggle = (n: number): void => void (expanded.has(n) ? expanded.delete(n) : expanded.add(n))
</script>

<template>
  <div class="a">
    <header>
      <div class="map-title">{{ map.title }}</div>
      <div
        class="destination"
        :class="{ clamp: !open.destination }"
        @click="open.destination = !open.destination"
      >
        <span class="flag">⚑</span> {{ map.destination }}
      </div>
      <div class="progress">
        <div class="bar">
          <div :style="{ width: `${(decided.length / map.tickets.length) * 100}%` }" />
        </div>
        {{ decided.length }} of {{ map.tickets.length }} decided · {{ frontier.length }} on the
        frontier
      </div>
    </header>

    <section v-if="needsYou.length">
      <h2 class="attention">
        Needs you <span class="count">{{ needsYou.length }}</span>
      </h2>
      <div v-for="t in needsYou" :key="t.number" class="row">
        <span class="glyph" :title="typeOf(t).name">{{ typeOf(t).glyph }}</span>
        <div class="main">
          <div class="title">{{ t.title }}</div>
          <div class="sub">
            <button
              class="status"
              :class="statusClass(sessions.get(t.number)!.status)"
              @click="cycleStatus(t.number)"
            >
              {{ sessions.get(t.number)!.status }}
            </button>
            {{ agoText(sessions.get(t.number)!) }}
          </div>
        </div>
        <button class="link">Show terminal</button>
      </div>
    </section>

    <section>
      <h2>
        Frontier <span class="count">{{ frontier.length }}</span>
      </h2>
      <div
        v-for="t in frontier"
        :key="t.number"
        class="row"
        :class="{ open: expanded.has(t.number) }"
      >
        <span class="glyph" :title="typeOf(t).name">{{ typeOf(t).glyph }}</span>
        <div class="main" @click="toggle(t.number)">
          <div class="title">
            {{ t.title }}
            <span v-if="t === next" class="next">next</span>
          </div>
          <template v-if="sessions.has(t.number)">
            <div class="sub">
              <button
                class="status"
                :class="statusClass(sessions.get(t.number)!.status)"
                @click.stop="cycleStatus(t.number)"
              >
                {{ sessions.get(t.number)!.status }}
              </button>
              not claimed on the tracker yet
            </div>
          </template>
          <template v-else-if="expanded.has(t.number) || t === next">
            <div class="sub">{{ typeOf(t).name }} · {{ typeOf(t).mode }}</div>
            <div v-if="expanded.has(t.number)" class="sub">{{ t.question }}</div>
            <code class="cmd">{{ command(t) }}</code>
          </template>
        </div>
        <button
          v-if="!sessions.has(t.number)"
          class="btn"
          :title="command(t)"
          @click="launch(t.number)"
        >
          ▶ Work
        </button>
      </div>
    </section>

    <section>
      <h2>
        Claimed <span class="count">{{ claimed.length }}</span>
      </h2>
      <div v-for="t in claimed" :key="t.number" class="row">
        <span class="glyph" :title="typeOf(t).name">{{ typeOf(t).glyph }}</span>
        <div class="main">
          <div class="title">{{ t.title }}</div>
          <div class="sub">
            <button
              v-if="sessions.has(t.number)"
              class="status"
              :class="statusClass(sessions.get(t.number)!.status)"
              @click="cycleStatus(t.number)"
            >
              {{ sessions.get(t.number)!.status }}
            </button>
            <template v-else>no live session ·</template>
            claimed by {{ t.assignee }}
          </div>
        </div>
        <span class="claim" :title="`claimed by ${t.assignee}`">{{ t.assignee!.slice(0, 2) }}</span>
      </div>
    </section>

    <section>
      <h2>
        Blocked <span class="count">{{ blocked.length }}</span>
      </h2>
      <div v-for="t in blocked" :key="t.number" class="row dim">
        <span class="glyph" :title="typeOf(t).name">{{ typeOf(t).glyph }}</span>
        <div class="main">
          <div class="title">{{ t.title }}</div>
          <div v-for="b in openBlockers(t)" :key="b.number" class="sub waits">
            ⊘ waits on <em>{{ b.title }}</em>
          </div>
        </div>
      </div>
    </section>

    <section>
      <h2 class="fold" @click="open.fog = !open.fog">
        {{ open.fog ? '▾' : '▸' }} Fog <span class="count">{{ map.fog.length }}</span>
      </h2>
      <template v-if="open.fog">
        <div v-for="f in map.fog" :key="f.title" class="row dim">
          <span class="glyph">≋</span>
          <div class="main">
            <div class="title">{{ f.title }}</div>
            <div class="sub">{{ f.text }}</div>
            <div
              v-for="n in f.waitsOn.filter((n) => ticket(n).state === 'OPEN')"
              :key="n"
              class="sub waits"
            >
              ⊘ waits on <em>{{ ticket(n).title }}</em>
            </div>
          </div>
        </div>
      </template>
    </section>

    <section>
      <h2 class="fold" @click="open.decided = !open.decided">
        {{ open.decided ? '▾' : '▸' }} Decisions so far
        <span class="count">{{ decided.length }}</span>
      </h2>
      <template v-if="open.decided">
        <div v-for="t in decided" :key="t.number" class="row">
          <span class="glyph done">✓</span>
          <div class="main">
            <div class="title">{{ t.title }}</div>
            <div class="sub">{{ t.gist }}</div>
          </div>
        </div>
      </template>
    </section>

    <section>
      <h2 class="fold" @click="open.out = !open.out">{{ open.out ? '▾' : '▸' }} Out of scope</h2>
      <template v-if="open.out">
        <div v-for="line in map.outOfScope" :key="line" class="row dim">
          <div class="main">
            <div class="sub">{{ line }}</div>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.a {
  max-width: 560px;
}
header {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}
.map-title {
  font-weight: 600;
}
.destination {
  margin: 4px 0 8px;
  color: var(--fg-muted);
  font-size: 12px;
  white-space: pre-line;
  cursor: pointer;
}
.destination.clamp {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.flag {
  color: var(--green);
}
.progress {
  font-size: 11px;
  color: var(--fg-muted);
}
.bar {
  height: 3px;
  margin-bottom: 4px;
  border-radius: 2px;
  background: var(--border);
}
.bar div {
  height: 100%;
  border-radius: 2px;
  background: var(--green);
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
.row .btn,
.row .link {
  visibility: hidden;
}
.row:hover .btn,
.row:hover .link,
.row:first-of-type .btn {
  visibility: visible;
}
.main {
  flex: 1;
  min-width: 0;
}
.sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--fg-muted);
}
.cmd {
  margin-top: 4px;
}
.waits em {
  font-style: normal;
  color: var(--fg);
}
.dim .title {
  color: var(--fg-muted);
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
.done {
  color: var(--green);
}
.link {
  border: 0;
  background: none;
  color: var(--accent);
  font-size: 12px;
  white-space: nowrap;
}
</style>
