<script setup lang="ts">
// PROTOTYPE (#202) — Variant A, "Under its map". A spec unfolds inside the map it came from, after
// the map's open tickets. A finished map whose spec is still being built stays out of Finished and
// shows the spec's counts on its row. A closed map comes back, muted, to carry its open spec. A spec
// with no map sits at the top level beside the maps.
import { computed } from 'vue'

import Folds from './Folds.vue'
import MapBranchX from './MapBranchX.vue'
import type { MapModel, SpecModel } from './model.ts'
import { urgency } from './model.ts'
import SpecBranch from './SpecBranch.vue'
import { scene } from './store.ts'
import ViewHeader from './ViewHeader.vue'

const specsOf = (map: MapModel): SpecModel[] =>
  map.specs.map((n) => scene.value.specs.get(n)!).filter((s) => s.state === 'open')
const activeSpec = (map: MapModel): SpecModel | undefined =>
  specsOf(map).find((s) => s.status !== 'built')

type Top = { kind: 'map'; map: MapModel; spec?: SpecModel } | { kind: 'spec'; spec: SpecModel }

const rank = (top: Top): number =>
  top.kind === 'spec'
    ? urgency(top.spec)
    : Math.min(top.map.finished ? 9 : urgency(top.map), top.spec ? urgency(top.spec) : 9)

const top = computed<Top[]>(() => {
  const items: Top[] = []
  for (const map of scene.value.maps.values()) {
    const spec = activeSpec(map)
    if (map.state === 'open' && (!map.finished || spec)) items.push({ kind: 'map', map, spec })
    if (map.state === 'closed' && spec) items.push({ kind: 'map', map, spec })
  }
  for (const spec of scene.value.specs.values()) {
    if (spec.state === 'open' && !spec.map && spec.status !== 'built')
      items.push({ kind: 'spec', spec })
  }
  return items.sort((a, b) => rank(a) - rank(b) || numberOf(a) - numberOf(b))
})
const numberOf = (top: Top): number => (top.kind === 'map' ? top.map.number : top.spec.number)

const finishedMaps = computed(() =>
  [...scene.value.maps.values()].filter((m) => m.state === 'open' && m.finished && !activeSpec(m)),
)
const finishedSpecs = computed(() =>
  [...scene.value.specs.values()].filter(
    (s) => s.state === 'open' && !s.map && s.status === 'built',
  ),
)
const needsYou = computed(() =>
  top.value.reduce(
    (sum, t) =>
      sum + (t.kind === 'map' ? t.map.needsYou + (t.spec?.needsYou ?? 0) : t.spec.needsYou),
    0,
  ),
)
</script>

<template>
  <ViewHeader title="Maps" icons :count="needsYou" />
  <div role="tree">
    <template
      v-for="item in top"
      :key="`${item.kind}:${item.kind === 'map' ? item.map.number : item.spec.number}`"
    >
      <MapBranchX
        v-if="item.kind === 'map'"
        :map="item.map"
        :depth="0"
        :muted="item.map.state === 'closed'"
        :description="item.map.state === 'closed' ? 'closed' : undefined"
        :spec-trail="item.map.finished ? item.spec : undefined"
      >
        <template #after-tickets>
          <SpecBranch
            v-for="spec in specsOf(item.map)"
            :key="spec.number"
            :spec="spec"
            :depth="1"
          />
        </template>
      </MapBranchX>
      <SpecBranch v-else :spec="item.spec" :depth="0" description="no map" />
    </template>
    <Folds :finished-count="finishedMaps.length + finishedSpecs.length">
      <MapBranchX v-for="map in finishedMaps" :key="map.number" :map="map" :depth="1" muted>
        <template #after-tickets>
          <SpecBranch v-for="spec in specsOf(map)" :key="spec.number" :spec="spec" :depth="2" />
        </template>
      </MapBranchX>
      <SpecBranch v-for="spec in finishedSpecs" :key="spec.number" :spec="spec" :depth="1" muted />
    </Folds>
  </div>
</template>
