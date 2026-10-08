<script setup lang="ts">
import { computed, nextTick, onMounted, watch } from 'vue'

import type { ActionId, DetailView, MapSection, NeighbourView } from '../../src/protocol.ts'
import ActionBlock from './ActionBlock.vue'
import Markdown from './Markdown.vue'
import SessionLine from './SessionLine.vue'
import WorktreeLine from './WorktreeLine.vue'

/**
 * The Detail at the editor's width: the full issue of the selection. A ticket shows its
 * header, its immediate neighbours in two columns, its body and, once closed, its answer.
 * A map shows its destination, decisions so far, fog and what is out of scope.
 */
const props = defineProps<{ view: DetailView }>()

const emit = defineEmits<{
  /** A neighbour or a decision was clicked: select it in the Tree. */
  reveal: [key: string]
  /** The title link and ↗ Open: the issue itself. */
  open: [key: string]
  /** A link in a rendered body. */
  link: [url: string]
  launch: [key: string, action: ActionId]
  focusTerminal: [key: string]
  copy: [key: string, action: ActionId]
  /** Hide a drift entry until its detail changes. */
  dismiss: [dismissKey: string]
}>()

const SECTIONS: ReadonlyArray<{ section: MapSection; heading: string }> = [
  { section: 'destination', heading: 'Destination' },
  { section: 'decisions', heading: 'Decisions so far' },
  { section: 'fog', heading: 'Not yet specified' },
  { section: 'out-of-scope', heading: 'Out of scope' },
]

const scrollToSection = async (): Promise<void> => {
  const { section } = props.view
  if (section === null) return
  await nextTick()
  document.getElementById(`section-${section}`)?.scrollIntoView?.({ block: 'start' })
}

onMounted(scrollToSection)
// Every request scrolls, even a second one for the section already showing.
watch(() => props.view.scroll, scrollToSection)
watch(() => props.view.detail?.key, scrollToSection)

/** The Drift section of the selection, empty when there is none to show. */
const drift = computed(() => props.view.detail?.drift ?? [])

/** Whether anything in the Drift section is loud, which puts the ⚠ chip in the header. */
const loud = computed(() =>
  drift.value.some((group) => group.entries.some((entry) => entry.level === 'loud')),
)

const scrollToDrift = (): void =>
  document.getElementById('section-drift')?.scrollIntoView?.({ block: 'start' })

/** A free-form map shows only the sections that were read, then its body as written. */
const sections = computed(() => {
  const detail = props.view.detail
  if (detail?.kind !== 'map' || detail.freeForm === null) return SECTIONS
  const filled = {
    destination: detail.destination !== null,
    decisions: detail.decisions.length > 0,
    fog: detail.fog.length > 0,
    'out-of-scope': detail.outOfScope.length > 0,
    drift: false,
  }
  return SECTIONS.filter(({ section }) => filled[section])
})

/** The entries of the fog or the out-of-scope section of a map's Detail. */
const listOf = (section: MapSection): ReadonlyArray<{ readonly text: string }> => {
  const detail = props.view.detail
  if (detail?.kind !== 'map') return []
  return section === 'fog' ? detail.fog : detail.outOfScope
}

const neighbourTitle = (neighbour: NeighbourView): string =>
  neighbour.key === null ? `${neighbour.title} (not in this map)` : neighbour.title
</script>

<template>
  <p v-if="view.detail === null" class="empty">Select a ticket or a map in the Tree.</p>

  <article v-else-if="view.detail.kind === 'ticket'" class="detail ticket">
    <header class="head">
      <h1>
        <span class="num">#{{ view.detail.number }}</span> {{ view.detail.title }}
      </h1>
      <button v-if="loud" type="button" class="chip" @click="scrollToDrift">
        <span class="codicon codicon-warning" /> Drift
      </button>
      <button type="button" class="open" @click="emit('open', view.detail.key)">
        ↗ Open issue
      </button>
    </header>

    <dl class="facts">
      <div class="fact state">
        <dt>State</dt>
        <dd>{{ view.detail.state }}</dd>
      </div>
      <div class="fact place">
        <dt>Place</dt>
        <dd>{{ view.detail.place }}</dd>
      </div>
      <div class="fact type">
        <dt>Type</dt>
        <dd>
          {{ view.detail.type ?? 'untyped'
          }}<template v-if="view.detail.mode"> · {{ view.detail.mode }}</template>
        </dd>
      </div>
      <div class="fact claim">
        <dt>Claim</dt>
        <dd>{{ view.detail.claim === null ? 'unclaimed' : view.detail.claim.join(', ') }}</dd>
      </div>
      <div v-if="view.detail.disagreement" class="fact disagreement">
        <dt>Tracker</dt>
        <dd :class="view.detail.disagreement.level">{{ view.detail.disagreement.text }}</dd>
      </div>
      <div v-if="view.detail.session.kind !== 'none'" class="fact session">
        <dt>Session</dt>
        <dd>
          <SessionLine
            :session="view.detail.session"
            @focus-terminal="emit('focusTerminal', view.detail.key)"
          />
        </dd>
      </div>
      <div v-if="view.detail.worktree !== null" class="fact worktree">
        <dt>Worktree</dt>
        <dd><WorktreeLine :worktree="view.detail.worktree" /></dd>
      </div>
    </dl>

    <ActionBlock
      v-for="action in view.detail.actions"
      :key="action.id"
      :action="action"
      :ticket-key="view.detail.key"
      @launch="(key, action) => emit('launch', key, action)"
      @copy="(key, action) => emit('copy', key, action)"
    />

    <section class="neighbourhood" aria-label="Neighbourhood">
      <div
        v-for="column in [
          { name: 'waits-on', heading: 'Waits on', items: view.detail.waitsOn },
          {
            name: 'clears-the-way',
            heading: 'Clears the way for',
            items: view.detail.clearsWayFor,
          },
        ]"
        :key="column.name"
        class="column"
        :class="column.name"
      >
        <h2>{{ column.heading }}</h2>
        <p v-if="column.items.length === 0" class="none">Nothing.</p>
        <ul v-else>
          <li v-for="neighbour in column.items" :key="neighbour.number">
            <button
              v-if="neighbour.key !== null"
              type="button"
              class="neighbour"
              :class="neighbour.state"
              @click="emit('reveal', neighbour.key)"
            >
              <span class="num">#{{ neighbour.number }}</span> {{ neighbour.title }}
              <span class="state">{{ neighbour.state }}</span>
            </button>
            <span v-else class="neighbour outside" :title="neighbourTitle(neighbour)">
              <span class="num">#{{ neighbour.number }}</span> {{ neighbour.title }}
              <span class="state">{{ neighbour.state }}</span>
            </span>
          </li>
        </ul>
      </div>
    </section>

    <section class="body" aria-label="Body">
      <Markdown
        v-if="view.detail.body.trim() !== ''"
        :source="view.detail.body"
        @link="emit('link', $event)"
      />
      <p v-else class="none">No body.</p>
    </section>

    <section v-if="view.detail.resolution" class="resolution" aria-label="Resolution">
      <h2>Resolution</h2>
      <p v-if="view.detail.resolution.author || view.detail.resolution.at" class="byline">
        {{ [view.detail.resolution.author, view.detail.resolution.at].filter(Boolean).join(' · ') }}
      </p>
      <Markdown :source="view.detail.resolution.body" @link="emit('link', $event)" />
    </section>

    <section
      v-if="drift.length > 0"
      id="section-drift"
      class="section drift"
      :class="{ targeted: view.section === 'drift' }"
      aria-label="Drift"
    >
      <h2>Drift</h2>
      <div v-for="(group, index) in drift" :key="index" class="group">
        <h3 v-if="group.number !== null">
          <button
            v-if="group.key !== null"
            type="button"
            class="neighbour"
            @click="emit('reveal', group.key)"
          >
            <span class="num">#{{ group.number }}</span> {{ group.title }}
          </button>
        </h3>
        <ul>
          <li
            v-for="entry in group.entries"
            :key="entry.dismissKey"
            class="drift-entry"
            :class="entry.level"
          >
            <p class="message">
              <span v-if="entry.level === 'loud'" class="codicon codicon-warning" />
              {{ entry.message }}
              <button type="button" class="link dismiss" @click="emit('dismiss', entry.dismissKey)">
                Dismiss
              </button>
            </p>
            <p v-if="entry.detail" class="detail">{{ entry.detail }}</p>
            <p class="hint">{{ entry.hint }}</p>
          </li>
        </ul>
      </div>
    </section>
  </article>

  <article v-else class="detail map">
    <header class="head">
      <h1>
        <span class="num">#{{ view.detail.number }}</span> {{ view.detail.title }}
      </h1>
      <button v-if="loud" type="button" class="chip" @click="scrollToDrift">
        <span class="codicon codicon-warning" /> Drift
      </button>
      <button type="button" class="open" @click="emit('open', view.detail.key)">
        ↗ Open issue
      </button>
    </header>
    <p class="counts">
      {{ view.detail.takeable === 0 ? 'nothing takeable' : `${view.detail.takeable} takeable` }} ·
      {{ view.detail.decided }}/{{ view.detail.total }} decided
    </p>

    <ActionBlock
      v-for="action in view.detail.actions"
      :key="action.id"
      :action="action"
      :ticket-key="view.detail.key"
      @launch="(key, action) => emit('launch', key, action)"
      @copy="(key, action) => emit('copy', key, action)"
    />

    <section
      v-for="{ section, heading } in sections"
      :id="`section-${section}`"
      :key="section"
      class="section"
      :class="[section, { targeted: view.section === section }]"
      :aria-label="heading"
    >
      <h2>{{ heading }}</h2>

      <template v-if="section === 'destination'">
        <Markdown
          v-if="view.detail.destination"
          :source="view.detail.destination"
          @link="emit('link', $event)"
        />
        <p v-else class="none">Not written down.</p>
      </template>

      <template v-else-if="section === 'decisions'">
        <p v-if="view.detail.decisions.length === 0" class="none">None yet.</p>
        <ul v-else>
          <li v-for="(decision, index) in view.detail.decisions" :key="index" class="entry">
            <button
              v-if="decision.key !== null"
              type="button"
              class="neighbour"
              @click="emit('reveal', decision.key)"
            >
              <span v-if="decision.number !== null" class="num">#{{ decision.number }}</span>
              {{ decision.title }}
            </button>
            <span v-else class="neighbour outside">
              <span v-if="decision.number !== null" class="num">#{{ decision.number }}</span>
              {{ decision.title }}
            </span>
            — <Markdown inline :source="decision.gist" @link="emit('link', $event)" />
          </li>
        </ul>
      </template>

      <template v-else>
        <p v-if="listOf(section).length === 0" class="none">Nothing.</p>
        <ul v-else>
          <li v-for="(entry, index) in listOf(section)" :key="index" class="entry">
            <Markdown inline :source="entry.text" @link="emit('link', $event)" />
          </li>
        </ul>
      </template>
    </section>

    <section v-if="view.detail.freeForm !== null" class="section free-form" aria-label="As written">
      <p class="none">This map's body isn't in the current form; shown as written.</p>
      <pre class="raw">{{ view.detail.freeForm }}</pre>
    </section>

    <section
      v-if="drift.length > 0"
      id="section-drift"
      class="section drift"
      :class="{ targeted: view.section === 'drift' }"
      aria-label="Drift"
    >
      <h2>Drift</h2>
      <div v-for="(group, index) in drift" :key="index" class="group">
        <h3 v-if="group.number !== null">
          <button
            v-if="group.key !== null"
            type="button"
            class="neighbour"
            @click="emit('reveal', group.key)"
          >
            <span class="num">#{{ group.number }}</span> {{ group.title }}
          </button>
        </h3>
        <ul>
          <li
            v-for="entry in group.entries"
            :key="entry.dismissKey"
            class="drift-entry"
            :class="entry.level"
          >
            <p class="message">
              <span v-if="entry.level === 'loud'" class="codicon codicon-warning" />
              {{ entry.message }}
              <button type="button" class="link dismiss" @click="emit('dismiss', entry.dismissKey)">
                Dismiss
              </button>
            </p>
            <p v-if="entry.detail" class="detail">{{ entry.detail }}</p>
            <p class="hint">{{ entry.hint }}</p>
          </li>
        </ul>
      </div>
    </section>
  </article>
</template>

<style scoped>
.empty,
.none,
.byline,
.counts {
  color: var(--vscode-descriptionForeground);
}
.empty {
  padding: 16px;
}
.detail {
  max-width: 960px;
  padding: 16px 20px 32px;
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
  cursor: pointer;
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 24px;
  margin: 0 0 16px;
}
.fact {
  display: flex;
  gap: 8px;
}
.link {
  border: 0;
  padding: 0;
  background: none;
  color: var(--vscode-textLink-foreground);
  cursor: pointer;
}
dt {
  color: var(--vscode-descriptionForeground);
}
dd {
  margin: 0;
}
.neighbourhood {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
  padding: 10px 12px;
  border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border));
  border-radius: 3px;
}
ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  margin: 2px 0;
}
.neighbour {
  border: 0;
  padding: 0;
  text-align: left;
  color: var(--vscode-textLink-foreground);
  background: none;
  font: inherit;
  cursor: pointer;
}
.neighbour:hover {
  text-decoration: underline;
}
.neighbour.outside {
  color: var(--vscode-descriptionForeground);
  cursor: default;
}
.neighbour.closed {
  color: var(--vscode-descriptionForeground);
}
.state {
  margin-left: 4px;
  font-size: 0.85em;
  color: var(--vscode-descriptionForeground);
}
.body,
.resolution {
  margin-bottom: 20px;
}
.resolution {
  padding: 8px 12px;
  border-left: 3px solid var(--vscode-focusBorder);
  background: var(--vscode-textBlockQuote-background);
}
.section {
  margin-bottom: 20px;
  padding: 4px 0 4px 10px;
  border-left: 2px solid transparent;
}
.section.targeted {
  border-left-color: var(--vscode-focusBorder);
}
.entry {
  margin: 4px 0;
}
.chip {
  flex: none;
  border: 1px solid var(--vscode-editorWarning-foreground);
  border-radius: 10px;
  padding: 0 8px;
  color: var(--vscode-editorWarning-foreground);
  background: none;
  font: inherit;
  cursor: pointer;
}
.raw {
  margin: 0;
  white-space: pre-wrap;
  font-family: var(--vscode-editor-font-family, monospace);
}
h3 {
  margin: 8px 0 2px;
  font-size: 1em;
  font-weight: 600;
}
.drift-entry {
  margin: 6px 0 10px;
}
.drift-entry p {
  margin: 0;
}
.drift-entry .codicon {
  color: var(--vscode-editorWarning-foreground);
}
.drift-entry.quiet .message,
.drift-entry .detail,
.drift-entry .hint {
  color: var(--vscode-descriptionForeground);
}
.dismiss {
  margin-left: 8px;
}
@media (max-width: 560px) {
  .neighbourhood {
    grid-template-columns: 1fr;
  }
}
.disagreement .warning {
  color: var(--vscode-editorWarning-foreground);
}
</style>
