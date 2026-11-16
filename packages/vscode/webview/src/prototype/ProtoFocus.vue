<script setup lang="ts">
// PROTOTYPE (#202) — the Focus pane for every kind of row, modelled on the real FocusPane.vue:
// a map's ⚑ row, a decision ticket, a spec, a build ticket, an issue with no spec.
import { computed } from 'vue'

import ActionBlock from '../ActionBlock.vue'
import SessionLine from '../SessionLine.vue'
import WorktreeLine from '../WorktreeLine.vue'
import type { BuildTicket, DecisionTicket, LoneModel, MapModel, SpecModel } from './model.ts'
import { STATUS_WORDS } from './model.ts'
import PrLine from './PrLine.vue'
import {
  buildActions,
  decisionActions,
  launch,
  loneActions,
  mapActions,
  reveal,
  scene,
  select,
  specActions,
} from './store.ts'

const props = defineProps<{
  item:
    | { kind: 'map'; map: MapModel }
    | { kind: 'decision'; ticket: DecisionTicket }
    | { kind: 'spec'; spec: SpecModel }
    | { kind: 'build'; ticket: BuildTicket }
    | { kind: 'lone'; lone: LoneModel }
  depth: number
}>()

const head = computed(() => {
  const item = props.item
  if (item.kind === 'map') return { number: item.map.number, title: item.map.title }
  if (item.kind === 'spec') return { number: item.spec.number, title: item.spec.title }
  if (item.kind === 'lone') return { number: item.lone.number, title: item.lone.title }
  return { number: item.ticket.number, title: item.ticket.title }
})

const actions = computed(() => {
  const item = props.item
  if (item.kind === 'map') return mapActions(item.map)
  if (item.kind === 'decision') return decisionActions(item.ticket)
  if (item.kind === 'spec') return specActions(item.spec)
  if (item.kind === 'build') return buildActions(item.ticket)
  return loneActions(item.lone)
})

const specOf = (ticket: BuildTicket): SpecModel | undefined => scene.value.specs.get(ticket.spec)
const specsOf = (map: MapModel): SpecModel[] =>
  map.specs.map((n) => scene.value.specs.get(n)).filter((s): s is SpecModel => s !== undefined)

const counts = (spec: SpecModel): string => {
  if (spec.status === 'no-tickets') return 'no build tickets yet'
  const takeable = spec.takeable === 0 ? 'nothing takeable' : `${spec.takeable} takeable`
  return spec.status === 'built'
    ? `every build ticket closed · ${spec.built}/${spec.total} built`
    : `${takeable} · ${spec.built}/${spec.total} built`
}

const ticked = (ticket: BuildTicket): string => {
  const done = ticket.criteria.filter((c) => c.ticked).length
  return `${ticket.criteria.length} ${ticket.criteria.length === 1 ? 'box' : 'boxes'}, ${done} ticked`
}
</script>

<template>
  <section class="pane" :class="`depth-${depth}`" :aria-label="`#${head.number} ${head.title}`">
    <header class="head">
      <a class="title" role="link" tabindex="0" :title="head.title">
        <span class="num">#{{ head.number }}</span> {{ head.title }}
      </a>
      <button type="button" class="detail" title="The Detail follows the selection">
        ↗ Detail
      </button>
      <button type="button" class="close" aria-label="Close" @click="select(null)">✕</button>
    </header>

    <dl class="facts">
      <template v-if="item.kind === 'map'">
        <div class="fact">
          <dt>Counts</dt>
          <dd>
            {{ item.map.takeable === 0 ? 'nothing takeable' : `${item.map.takeable} takeable` }} ·
            {{ item.map.decided }}/{{ item.map.total }} decided
          </dd>
        </div>
        <div class="fact">
          <dt>Destination</dt>
          <dd class="clamp">{{ item.map.destination ?? 'not written down' }}</dd>
        </div>
        <div v-for="spec in specsOf(item.map)" :key="spec.number" class="fact">
          <dt>Spec</dt>
          <dd>
            <button type="button" class="link" @click="reveal(`spec:${spec.number}`)">
              <span class="num">#{{ spec.number }}</span> {{ spec.title }}
            </button>
            <span class="muted">
              ·
              {{
                spec.state === 'closed'
                  ? 'closed'
                  : spec.status === 'no-tickets'
                    ? 'no build tickets'
                    : `${spec.built}/${spec.total} built`
              }}</span
            >
          </dd>
        </div>
        <div v-if="item.map.state === 'closed'" class="fact">
          <dt>State</dt>
          <dd>closed</dd>
        </div>
      </template>

      <template v-else-if="item.kind === 'decision'">
        <div class="fact">
          <dt>State</dt>
          <dd>{{ item.ticket.state }}</dd>
        </div>
        <div class="fact">
          <dt>Claim</dt>
          <dd>{{ item.ticket.claim.length === 0 ? 'unclaimed' : item.ticket.claim.join(', ') }}</dd>
        </div>
        <div v-if="item.ticket.session.kind !== 'none'" class="fact">
          <dt>Session</dt>
          <dd><SessionLine :session="item.ticket.session" /></dd>
        </div>
        <div v-if="item.ticket.worktree" class="fact">
          <dt>Worktree</dt>
          <dd><WorktreeLine :worktree="item.ticket.worktree" /></dd>
        </div>
        <div v-if="item.ticket.gist" class="fact">
          <dt>Decided</dt>
          <dd class="clamp">{{ item.ticket.gist }}</dd>
        </div>
      </template>

      <template v-else-if="item.kind === 'spec'">
        <div class="fact">
          <dt>Map</dt>
          <dd>
            <button
              v-if="item.spec.map"
              type="button"
              class="link"
              @click="reveal(`mapitem:${item.spec.map.number}`)"
            >
              <span class="num">#{{ item.spec.map.number }}</span> {{ item.spec.map.title }}
            </button>
            <span v-if="item.spec.map?.state === 'closed'" class="muted"> · closed</span>
            <span v-if="!item.spec.map" class="muted">none: it came from a grilling</span>
          </dd>
        </div>
        <div class="fact">
          <dt>Counts</dt>
          <dd>{{ counts(item.spec) }}</dd>
        </div>
        <div v-if="item.spec.live > 0" class="fact">
          <dt>Sessions</dt>
          <dd>
            {{ item.spec.live }} live<template v-if="item.spec.needsYou > 0"
              >, <span class="needs">{{ item.spec.needsYou }} need you</span></template
            >
          </dd>
        </div>
        <div class="fact">
          <dt>Problem</dt>
          <dd class="clamp">{{ item.spec.problem }}</dd>
        </div>
        <div class="fact">
          <dt>Stories</dt>
          <dd>{{ item.spec.stories.length }} user stories</dd>
        </div>
        <div v-if="item.spec.status === 'built'" class="fact">
          <dt>State</dt>
          <dd class="muted">
            open, every build ticket closed: nothing left for the Cockpit to launch
          </dd>
        </div>
      </template>

      <template v-else-if="item.kind === 'build'">
        <div class="fact">
          <dt>State</dt>
          <dd>
            {{ item.ticket.state }}<template v-if="item.ticket.place === 'held'"> · held</template>
          </dd>
        </div>
        <div class="fact">
          <dt>Spec</dt>
          <dd>
            <button type="button" class="link" @click="reveal(`spec:${item.ticket.spec}`)">
              <span class="num">#{{ item.ticket.spec }}</span> {{ specOf(item.ticket)?.title }}
            </button>
          </dd>
        </div>
        <div class="fact">
          <dt>Role</dt>
          <dd>
            {{ item.ticket.role ?? 'no triage role'
            }}<template v-if="item.ticket.mode"> · {{ item.ticket.mode }}</template>
          </dd>
        </div>
        <div class="fact">
          <dt>Claim</dt>
          <dd>{{ item.ticket.claim.length === 0 ? 'unclaimed' : item.ticket.claim.join(', ') }}</dd>
        </div>
        <div v-if="item.ticket.waitsOn.length > 0" class="fact">
          <dt>Waits on</dt>
          <dd>
            <button
              v-for="blocker in item.ticket.waitsOn"
              :key="blocker.number"
              type="button"
              class="link block"
              @click="reveal(`b:${blocker.number}`)"
            >
              <span class="num">#{{ blocker.number }}</span> {{ blocker.title }}
            </button>
          </dd>
        </div>
        <div v-if="item.ticket.session.kind !== 'none'" class="fact">
          <dt>Session</dt>
          <dd><SessionLine :session="item.ticket.session" /></dd>
        </div>
        <div v-if="item.ticket.worktree" class="fact">
          <dt>Worktree</dt>
          <dd><WorktreeLine :worktree="item.ticket.worktree" /></dd>
        </div>
        <div v-if="item.ticket.pr" class="fact">
          <dt>PR</dt>
          <dd><PrLine :pr="item.ticket.pr" /></dd>
        </div>
        <div class="fact">
          <dt>Criteria</dt>
          <dd
            class="muted"
            title="Boxes say nothing of state: 26 of 28 closed build tickets here have every box empty"
          >
            {{ ticked(item.ticket) }}
          </dd>
        </div>
      </template>

      <template v-else>
        <div class="fact">
          <dt>Role</dt>
          <dd>{{ item.lone.role }} · no spec, no map</dd>
        </div>
      </template>
    </dl>

    <ActionBlock
      v-for="(entry, index) in actions"
      :key="index"
      :action="entry"
      ticket-key="prototype"
      @launch="launch(entry)"
      @copy="launch(entry)"
    />
  </section>
</template>

<style scoped>
.pane {
  margin: 2px 8px 4px 0;
  padding: 6px 8px;
  border-left: 2px solid var(--vscode-focusBorder);
  background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
}
.depth-0 {
  margin-left: 20px;
}
.depth-1 {
  margin-left: 34px;
}
.depth-2 {
  margin-left: 50px;
}
.depth-3 {
  margin-left: 66px;
}
.head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--vscode-textLink-foreground);
  cursor: pointer;
}
.num {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 0.9em;
}
.detail,
.close {
  flex: none;
  border: 0;
  border-radius: 2px;
  padding: 1px 6px;
  color: var(--vscode-button-secondaryForeground);
  background: var(--vscode-button-secondaryBackground);
  cursor: pointer;
}
.close {
  background: none;
  color: var(--vscode-icon-foreground);
}
.facts {
  margin: 4px 0 0;
}
.fact {
  display: flex;
  gap: 8px;
}
dt {
  flex: none;
  width: 72px;
  color: var(--vscode-descriptionForeground);
}
dd {
  margin: 0;
  min-width: 0;
}
.clamp {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.muted {
  color: var(--vscode-descriptionForeground);
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
.link.block {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
