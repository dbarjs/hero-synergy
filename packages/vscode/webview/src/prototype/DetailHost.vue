<script setup lang="ts">
// PROTOTYPE (#202) — the Detail editor tab, following the Tree's selection. Maps and decision
// tickets render through the real Detail.vue; a map with a spec gets a line above it (the map
// afterwards); specs and build tickets render through the prototype's SpecDetail and BuildDetail.
import { computed } from 'vue'

import type { Detail as DetailModel, DetailView } from '../../../src/protocol.ts'
import Detail from '../Detail.vue'
import Markdown from '../Markdown.vue'
import BuildDetail from './BuildDetail.vue'
import { STATUS_WORDS } from './model.ts'
import SpecDetail from './SpecDetail.vue'
import { mapActions, decisionActions, launch, reveal, scene, state } from './store.ts'

const target = computed(() => {
  const selected = state.selected
  if (!selected) return null
  const [kind, raw] = selected.split(':')
  const n = Number(raw)
  const s = scene.value
  if (kind === 'map' || kind === 'mapitem') {
    const map = s.maps.get(n)
    return map ? { kind: 'map' as const, map } : null
  }
  if (kind === 'spec' || kind === 'specitem') {
    const spec = s.specs.get(n)
    return spec ? { kind: 'spec' as const, spec } : null
  }
  if (kind === 'b') {
    const ticket = s.buildTickets.get(n)
    return ticket ? { kind: 'build' as const, ticket } : null
  }
  if (kind === 't') {
    const ticket = s.decisionTickets.get(n)
    return ticket ? { kind: 'decision' as const, ticket } : null
  }
  if (kind === 'lone') {
    const lone = s.lone.find((l) => l.number === n)
    return lone ? { kind: 'lone' as const, lone } : null
  }
  return null
})

const title = computed(() => {
  const t = target.value
  if (!t) return 'Cockpit Detail'
  const { number, title: name } =
    t.kind === 'map' ? t.map : t.kind === 'spec' ? t.spec : t.kind === 'lone' ? t.lone : t.ticket
  return `#${number} ${name}`
})
defineExpose({ title })

const realView = computed<DetailView | null>(() => {
  const t = target.value
  if (t?.kind === 'map') {
    const map = t.map
    const detail: DetailModel = {
      kind: 'map',
      key: `mapitem:${map.number}`,
      number: map.number,
      title: map.title,
      url: map.url,
      takeable: map.takeable,
      decided: map.decided,
      total: map.total,
      destination: map.destination,
      decisions: map.decisions.map((d) => ({
        key: d.number !== null && s().decisionTickets.has(d.number) ? `t:${d.number}` : null,
        number: d.number,
        title: d.title,
        gist: d.gist,
      })),
      fog: map.fog.map((text) => ({ text })),
      outOfScope: map.outOfScope.map((text) => ({ text })),
      freeForm: null,
      drift: [],
      actions: mapActions(map),
    }
    return { detail, section: null, scroll: 0 }
  }
  if (t?.kind === 'decision') {
    const ticket = t.ticket
    const neighbour = (r: { number: number; title: string; state: 'open' | 'closed' }) => ({
      ...r,
      key: s().decisionTickets.has(r.number) ? `t:${r.number}` : null,
    })
    const detail: DetailModel = {
      kind: 'ticket',
      key: `t:${ticket.number}`,
      number: ticket.number,
      title: ticket.title,
      state: ticket.state,
      place: ticket.place === 'held' ? 'blocked' : ticket.place,
      type: ticket.type as never,
      mode: ticket.mode as never,
      claim: ticket.claim.length > 0 ? ticket.claim : null,
      url: ticket.url,
      body: ticket.body,
      resolution:
        ticket.state === 'closed' && ticket.lastComment
          ? {
              body: ticket.lastComment.body,
              author: ticket.lastComment.author,
              at: ticket.lastComment.at.slice(0, 10),
            }
          : null,
      waitsOn: ticket.allBlockers.map(neighbour),
      clearsWayFor: ticket.clearsWayFor.map(neighbour),
      session: ticket.session,
      disagreement: null,
      worktree: ticket.worktree,
      actions: decisionActions(ticket),
      drift: [],
    }
    return { detail, section: null, scroll: 0 }
  }
  return null
})
const s = () => scene.value

/** The real Detail's Action buttons: the prototype shows the command instead of running it. */
const runFirst = (): void => {
  const first = realView.value?.detail?.actions[0]
  if (first) launch(first)
}

const mapSpecs = computed(() =>
  target.value?.kind === 'map'
    ? target.value.map.specs.map((n) => scene.value.specs.get(n)!).filter(Boolean)
    : [],
)
</script>

<template>
  <div class="host">
    <p v-if="!target" class="empty">Select a ticket, a spec or a map in the Tree.</p>

    <template v-else-if="target.kind === 'map'">
      <div v-for="spec in mapSpecs" :key="spec.number" class="banner">
        <span class="codicon codicon-file-text" />
        <span>Spec</span>
        <button type="button" class="link" @click="reveal(`spec:${spec.number}`)">
          <span class="num">#{{ spec.number }}</span> {{ spec.title }}
        </button>
        <span class="muted">
          {{ spec.state === 'closed' ? 'closed' : STATUS_WORDS[spec.status]
          }}<template v-if="spec.total > 0"> · {{ spec.built }}/{{ spec.total }} built</template>
        </span>
        <span v-if="target.map.finished && spec.state === 'open'" class="muted note">
          To spec is not offered again: this map's spec exists.
        </span>
      </div>
      <Detail
        v-if="realView"
        :view="realView"
        @reveal="reveal"
        @launch="runFirst"
        @copy="runFirst"
      />
    </template>

    <Detail
      v-else-if="target.kind === 'decision' && realView"
      :view="realView"
      @reveal="reveal"
      @launch="runFirst"
      @copy="runFirst"
    />

    <SpecDetail v-else-if="target.kind === 'spec'" :spec="target.spec" />
    <BuildDetail v-else-if="target.kind === 'build'" :ticket="target.ticket" />

    <article v-else-if="target.kind === 'lone'" class="lone">
      <h1>
        <span class="num">#{{ target.lone.number }}</span> {{ target.lone.title }}
      </h1>
      <p class="muted">{{ target.lone.role }} · no spec, no map: it sits in Unmapped.</p>
      <Markdown :source="'(body not pulled)'" />
    </article>
  </div>
</template>

<style scoped>
.empty {
  padding: 16px;
  color: var(--vscode-descriptionForeground);
}
.banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  max-width: 920px;
  margin: 12px 20px 0;
  padding: 6px 10px;
  border: 1px solid var(--vscode-editorWidget-border);
  border-left: 3px solid var(--vscode-charts-blue);
  border-radius: 3px;
}
.note {
  flex-basis: 100%;
  font-size: 0.9em;
}
.num {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 0.9em;
  color: var(--vscode-descriptionForeground);
}
.muted {
  color: var(--vscode-descriptionForeground);
}
.link {
  border: 0;
  padding: 0;
  background: none;
  color: var(--vscode-textLink-foreground);
  font: inherit;
  cursor: pointer;
}
.lone {
  padding: 16px 20px;
}
h1 {
  font-size: 1.5em;
  font-weight: 600;
}
</style>
