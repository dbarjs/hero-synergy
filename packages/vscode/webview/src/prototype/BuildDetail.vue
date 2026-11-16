<script setup lang="ts">
// PROTOTYPE (#202) — the Detail for a build ticket: header and facts as a decision ticket has them,
// plus the triage role and the pull request; a three-column neighbourhood (Part of → Waits on →
// Clears the way for); What to build; the acceptance criteria with their boxes as the issue holds
// them. With `?detail=issue` the body is shown as written instead of in parts.
import { computed } from 'vue'

import ActionBlock from '../ActionBlock.vue'
import Markdown from '../Markdown.vue'
import SessionLine from '../SessionLine.vue'
import WorktreeLine from '../WorktreeLine.vue'
import type { BuildTicket, Ref } from './model.ts'
import PrLine from './PrLine.vue'
import { buildActions, launch, reveal, scene, state } from './store.ts'

const props = defineProps<{ ticket: BuildTicket }>()

const spec = computed(() => scene.value.specs.get(props.ticket.spec)!)
const ticked = computed(() => props.ticket.criteria.filter((c) => c.ticked).length)
const columns = computed<{ name: string; heading: string; items: ReadonlyArray<Ref> }[]>(() => [
  { name: 'waits', heading: 'Waits on', items: props.ticket.allBlockers },
  { name: 'clears', heading: 'Clears the way for', items: props.ticket.clearsWayFor },
])
const PLACE_WORDS = {
  claimed: 'claimed',
  frontier: 'takeable',
  blocked: 'blocked',
  held: 'held: needs info',
  closed: 'built',
} as const
</script>

<template>
  <article class="detail">
    <header class="head">
      <h1>
        <span class="num">#{{ ticket.number }}</span> {{ ticket.title }}
      </h1>
      <button type="button" class="open">↗ Open issue</button>
    </header>

    <dl class="facts">
      <div class="fact">
        <dt>Kind</dt>
        <dd>build ticket</dd>
      </div>
      <div class="fact">
        <dt>State</dt>
        <dd>{{ ticket.state }}</dd>
      </div>
      <div class="fact">
        <dt>Place</dt>
        <dd>{{ PLACE_WORDS[ticket.place] }}<template v-if="ticket.next"> · next</template></dd>
      </div>
      <div class="fact">
        <dt>Role</dt>
        <dd>
          {{ ticket.role ?? 'none' }}<template v-if="ticket.mode"> · {{ ticket.mode }}</template>
        </dd>
      </div>
      <div class="fact">
        <dt>Claim</dt>
        <dd>{{ ticket.claim.length === 0 ? 'unclaimed' : ticket.claim.join(', ') }}</dd>
      </div>
      <div v-if="ticket.session.kind !== 'none'" class="fact">
        <dt>Session</dt>
        <dd><SessionLine :session="ticket.session" /></dd>
      </div>
      <div v-if="ticket.worktree" class="fact">
        <dt>Worktree</dt>
        <dd><WorktreeLine :worktree="ticket.worktree" /></dd>
      </div>
      <div v-if="ticket.pr" class="fact">
        <dt>Pull request</dt>
        <dd><PrLine :pr="ticket.pr" /></dd>
      </div>
    </dl>

    <ActionBlock
      v-for="(entry, index) in buildActions(ticket)"
      :key="index"
      :action="entry"
      ticket-key="prototype"
      @launch="launch(entry)"
      @copy="launch(entry)"
    />

    <section class="neighbourhood" aria-label="Neighbourhood">
      <div class="column part-of">
        <h2>Part of</h2>
        <button type="button" class="neighbour" @click="reveal(`spec:${spec.number}`)">
          <span class="num">#{{ spec.number }}</span> {{ spec.title }}
        </button>
        <p class="muted small">
          {{ spec.built }}/{{ spec.total }} built<template v-if="spec.map">
            · from <span class="num">#{{ spec.map.number }}</span></template
          >
        </p>
      </div>
      <div v-for="column in columns" :key="column.name" class="column">
        <h2>{{ column.heading }}</h2>
        <p v-if="column.items.length === 0" class="muted">Nothing.</p>
        <ul v-else>
          <li v-for="other in column.items" :key="other.number">
            <button
              type="button"
              class="neighbour"
              :class="other.state"
              @click="reveal(`b:${other.number}`)"
            >
              <span class="num">#{{ other.number }}</span> {{ other.title }}
              <span class="state">{{ other.state === 'closed' ? 'built' : 'open' }}</span>
            </button>
          </li>
        </ul>
      </div>
    </section>

    <template v-if="state.detail === 'progress'">
      <section class="part">
        <h2>What to build</h2>
        <Markdown :source="ticket.whatToBuild" />
      </section>
      <section class="part">
        <h2>
          Acceptance criteria
          <span class="muted">{{ ticked }}/{{ ticket.criteria.length }} ticked</span>
        </h2>
        <ul class="criteria">
          <li v-for="(criterion, index) in ticket.criteria" :key="index">
            <input type="checkbox" :checked="criterion.ticked" disabled />
            <Markdown inline :source="criterion.text" />
          </li>
        </ul>
        <p class="muted small">
          The boxes as the issue holds them. A build ticket closes when its pull request merges, not
          when its boxes are ticked: 26 of the 28 closed build tickets here have every box empty.
        </p>
      </section>
    </template>
    <section v-else class="part">
      <h2>Body</h2>
      <Markdown :source="ticket.body" />
    </section>

    <section v-if="ticket.state === 'closed' && ticket.lastComment" class="resolution">
      <h2>Last comment</h2>
      <p class="muted small">
        {{ ticket.lastComment.author }} · {{ ticket.lastComment.at.slice(0, 10) }}
      </p>
      <Markdown :source="ticket.lastComment.body" />
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
.small {
  font-size: 0.9em;
}
dd {
  margin: 0;
}
.neighbourhood {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  margin: 16px 0 20px;
  padding: 10px 12px;
  border: 1px solid var(--vscode-editorWidget-border);
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
.neighbour.closed {
  color: var(--vscode-descriptionForeground);
}
.state {
  margin-left: 4px;
  font-size: 0.85em;
  color: var(--vscode-descriptionForeground);
}
.part {
  margin: 20px 0;
}
.criteria li {
  display: flex;
  gap: 6px;
  align-items: baseline;
  margin: 4px 0;
}
.resolution {
  padding: 8px 12px;
  border-left: 3px solid var(--vscode-focusBorder);
  background: var(--vscode-textBlockQuote-background);
}
</style>
