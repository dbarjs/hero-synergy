<script setup lang="ts">
// PROTOTYPE (#202) — the Detail for a spec, in two shapes (`?detail=`):
//   progress — the build tickets first, as a bar and a board by place; then the spec's sections,
//              the user stories folded behind their count;
//   issue    — the build tickets as one list in sub-issue order; then the body exactly as written.
import { computed, ref, watch } from 'vue'

import ActionBlock from '../ActionBlock.vue'
import Markdown from '../Markdown.vue'
import RowSession from '../RowSession.vue'
import type { BuildTicket, SpecModel } from './model.ts'
import PrLine from './PrLine.vue'
import { launch, reveal, specActions, state } from './store.ts'

const props = defineProps<{ spec: SpecModel }>()

const allStories = ref(false)
watch(
  () => props.spec.number,
  () => (allStories.value = false),
)

const groups = computed(() => {
  const open = props.spec.tickets.filter((t) => t.state === 'open')
  return [
    { key: 'claimed', heading: 'In progress', items: open.filter((t) => t.place === 'claimed') },
    { key: 'frontier', heading: 'Takeable', items: open.filter((t) => t.place === 'frontier') },
    {
      key: 'waiting',
      heading: 'Waiting',
      items: open.filter((t) => t.place === 'blocked' || t.place === 'held'),
    },
    {
      key: 'closed',
      heading: 'Built',
      items: props.spec.tickets.filter((t) => t.state === 'closed'),
    },
  ]
})

const segment = (count: number): string => `${(100 * count) / Math.max(1, props.spec.total)}%`

const SHOWN_STORIES = 5
const storiesSection = computed(() => {
  const shown = allStories.value ? props.spec.stories : props.spec.stories.slice(0, SHOWN_STORIES)
  return shown.join('\n')
})

const placeWord = (t: BuildTicket): string =>
  t.state === 'closed'
    ? 'built'
    : t.place === 'blocked'
      ? `waits on ${t.waitsOn.map((b) => `#${b.number}`).join(' ')}`
      : t.place === 'held'
        ? 'needs info'
        : t.place === 'frontier'
          ? t.next
            ? 'next'
            : 'takeable'
          : 'claimed'

const STATE_ICON: Record<string, string> = {
  claimed: 'circle-filled',
  frontier: 'circle-large-outline',
  blocked: 'circle-slash',
  held: 'question',
  closed: 'pass-filled',
}
</script>

<template>
  <article class="detail">
    <header class="head">
      <h1>
        <span class="num">#{{ spec.number }}</span> {{ spec.title }}
      </h1>
      <button type="button" class="open">↗ Open issue</button>
    </header>

    <dl class="facts">
      <div class="fact">
        <dt>Kind</dt>
        <dd>spec</dd>
      </div>
      <div class="fact">
        <dt>State</dt>
        <dd>{{ spec.state }}</dd>
      </div>
      <div class="fact">
        <dt>Map</dt>
        <dd>
          <button
            v-if="spec.map"
            type="button"
            class="link"
            @click="reveal(`mapitem:${spec.map.number}`)"
          >
            <span class="num">#{{ spec.map.number }}</span> {{ spec.map.title }}
          </button>
          <span v-if="spec.map?.state === 'closed'" class="muted"> (closed)</span>
          <span v-if="!spec.map" class="muted">none</span>
        </dd>
      </div>
      <div class="fact">
        <dt>Built</dt>
        <dd>
          {{ spec.built }}/{{ spec.total
          }}<template v-if="spec.total > 0">
            · {{ spec.takeable === 0 ? 'nothing takeable' : `${spec.takeable} takeable` }}</template
          >
        </dd>
      </div>
      <div v-if="spec.live > 0" class="fact">
        <dt>Sessions</dt>
        <dd>
          {{ spec.live }} live<span v-if="spec.needsYou > 0" class="needs"
            >, {{ spec.needsYou }} need you</span
          >
        </dd>
      </div>
    </dl>

    <ActionBlock
      v-for="(entry, index) in specActions(spec)"
      :key="index"
      :action="entry"
      ticket-key="prototype"
      @launch="launch(entry)"
      @copy="launch(entry)"
    />

    <!-- The build tickets. -->
    <section class="tickets" aria-label="Build tickets">
      <h2>Build tickets</h2>
      <p v-if="spec.total === 0" class="muted">
        None yet. <code>/to-tickets</code> splits the spec into build tickets; or the whole spec is
        built in one go, as #155 was.
      </p>

      <template v-else-if="state.detail === 'progress'">
        <div class="bar" role="img" :aria-label="`${spec.built} of ${spec.total} built`">
          <span class="seg closed" :style="{ width: segment(groups[3]!.items.length) }" />
          <span class="seg claimed" :style="{ width: segment(groups[0]!.items.length) }" />
          <span class="seg frontier" :style="{ width: segment(groups[1]!.items.length) }" />
          <span class="seg waiting" :style="{ width: segment(groups[2]!.items.length) }" />
        </div>
        <div class="board">
          <div v-for="group in groups" :key="group.key" class="column" :class="group.key">
            <h3>
              {{ group.heading }} <span class="muted">{{ group.items.length }}</span>
            </h3>
            <p v-if="group.items.length === 0" class="muted">Nothing.</p>
            <button
              v-for="ticket in group.items"
              :key="ticket.number"
              type="button"
              class="card"
              :class="{ next: ticket.next }"
              @click="reveal(`b:${ticket.number}`)"
            >
              <span class="card-title"
                ><span class="num">#{{ ticket.number }}</span> {{ ticket.title }}</span
              >
              <span class="card-trail">
                <span v-if="ticket.next" class="next-chip">next</span>
                <span v-if="ticket.place === 'blocked'" class="muted"
                  >waits on {{ ticket.waitsOn.map((b) => `#${b.number}`).join(' ') }}</span
                >
                <span v-if="ticket.place === 'held'" class="muted">needs info</span>
                <RowSession v-if="ticket.state === 'open'" :session="ticket.session" />
                <PrLine v-if="ticket.pr" :pr="ticket.pr" chip />
                <span v-if="ticket.mode && ticket.state === 'open'" class="mode">{{
                  ticket.mode
                }}</span>
              </span>
            </button>
          </div>
        </div>
      </template>

      <ul v-else class="list">
        <li v-for="ticket in spec.tickets" :key="ticket.number">
          <span
            class="codicon"
            :class="[
              `codicon-${STATE_ICON[ticket.state === 'closed' ? 'closed' : ticket.place]}`,
              ticket.place,
            ]"
          />
          <button
            type="button"
            class="link"
            :class="{ done: ticket.state === 'closed' }"
            @click="reveal(`b:${ticket.number}`)"
          >
            <span class="num">#{{ ticket.number }}</span> {{ ticket.title }}
          </button>
          <span class="muted"> · {{ placeWord(ticket) }}</span>
          <PrLine v-if="ticket.pr" :pr="ticket.pr" chip />
        </li>
      </ul>
    </section>

    <!-- The spec itself. -->
    <template v-if="state.detail === 'progress'">
      <p v-if="spec.preamble" class="preamble">
        <Markdown inline :source="spec.preamble.split('\n')[0]!" />
      </p>
      <nav class="toc">
        <a v-for="part in spec.sections" :key="part.heading" :href="`#s-${part.heading}`">{{
          part.heading
        }}</a>
      </nav>
      <section
        v-for="part in spec.sections"
        :id="`s-${part.heading}`"
        :key="part.heading"
        class="part"
      >
        <h2>
          {{ part.heading }}
          <span v-if="part.heading === 'User Stories'" class="muted">{{
            spec.stories.length
          }}</span>
        </h2>
        <template v-if="part.heading === 'User Stories'">
          <Markdown :source="storiesSection" />
          <button
            v-if="spec.stories.length > SHOWN_STORIES"
            type="button"
            class="link more"
            @click="allStories = !allStories"
          >
            {{ allStories ? 'Show the first 5' : `Show all ${spec.stories.length} user stories` }}
          </button>
        </template>
        <Markdown v-else :source="part.body" />
      </section>
    </template>
    <section v-else class="part body">
      <h2>Body</h2>
      <Markdown :source="spec.body" />
    </section>
  </article>
</template>

<style scoped>
.detail {
  max-width: 960px;
  padding: 16px 20px 48px;
}
.head {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
h1 {
  flex: 1 1 auto;
  margin: 0 0 8px;
  font-size: 1.5em;
  font-weight: 600;
}
h2 {
  margin: 0 0 6px;
  font-size: 1.05em;
  font-weight: 600;
}
h3 {
  margin: 0 0 6px;
  font-size: 0.9em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.num {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 0.9em;
  color: var(--vscode-descriptionForeground);
}
.open {
  flex: none;
  border: 0;
  border-radius: 2px;
  padding: 3px 10px;
  color: var(--vscode-button-secondaryForeground);
  background: var(--vscode-button-secondaryBackground);
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 24px;
  margin: 0 0 12px;
}
.fact {
  display: flex;
  gap: 8px;
}
dt,
.muted {
  color: var(--vscode-descriptionForeground);
}
dd {
  margin: 0;
}
.needs {
  color: var(--vscode-editorWarning-foreground);
  font-weight: 600;
}
.link {
  border: 0;
  padding: 0;
  text-align: left;
  background: none;
  color: var(--vscode-textLink-foreground);
  font: inherit;
  cursor: pointer;
}
.link.done {
  color: var(--vscode-descriptionForeground);
}
.tickets,
.part {
  margin: 20px 0;
}
.bar {
  display: flex;
  height: 6px;
  margin: 4px 0 12px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--vscode-editorWidget-border);
}
.seg.closed {
  background: var(--vscode-charts-green);
}
.seg.claimed {
  background: var(--vscode-charts-blue);
}
.seg.frontier {
  background: var(--vscode-button-background);
  opacity: 0.55;
}
.seg.waiting {
  background: var(--vscode-descriptionForeground);
  opacity: 0.35;
}
.board {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.column {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 3px;
  text-align: left;
  background: var(--vscode-editorWidget-background);
  color: var(--vscode-foreground);
  font: inherit;
  cursor: pointer;
}
.card:hover {
  border-color: var(--vscode-focusBorder);
}
.card.next {
  border-color: var(--vscode-button-background);
}
.closed .card {
  opacity: 0.7;
}
.card-trail {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 0.9em;
}
.next-chip {
  padding: 0 4px;
  border-radius: 3px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  font-size: 0.8em;
  font-weight: 600;
  text-transform: uppercase;
}
.mode {
  padding: 0 4px;
  border: 1px solid var(--vscode-descriptionForeground);
  border-radius: 3px;
  color: var(--vscode-descriptionForeground);
  font-size: 0.8em;
  line-height: 13px;
}
.list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.list li {
  margin: 3px 0;
}
.list :deep(.chip) {
  margin-left: 6px;
}
.list .codicon {
  margin-right: 6px;
  vertical-align: middle;
  font-size: 13px;
  color: var(--vscode-descriptionForeground);
}
.list .codicon.claimed {
  color: var(--vscode-charts-blue);
}
.list .codicon-pass-filled {
  color: var(--vscode-charts-green);
}
.preamble {
  color: var(--vscode-descriptionForeground);
}
.toc {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 8px 0 16px;
  padding: 6px 0;
  border-top: 1px solid var(--vscode-editorWidget-border);
  border-bottom: 1px solid var(--vscode-editorWidget-border);
}
.toc a {
  color: var(--vscode-textLink-foreground);
  text-decoration: none;
}
.more {
  margin-top: 4px;
}
code {
  font-family: var(--vscode-editor-font-family, monospace);
}
@media (max-width: 760px) {
  .board {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
