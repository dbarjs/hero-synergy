<script setup lang="ts">
// PROTOTYPE (#202) — Variant B, "Beside the maps". One list of two kinds: maps still deciding and
// specs still building, ordered together by urgency. A spec names where it came from (`from #130`).
// Once its spec exists a finished map goes to Finished and points at it (`→ #163`); a built spec
// joins it there.
import { computed } from 'vue'

import Folds from './Folds.vue'
import MapBranchX from './MapBranchX.vue'
import type { MapModel, SpecModel } from './model.ts'
import { urgency } from './model.ts'
import SpecBranch from './SpecBranch.vue'
import { scene } from './store.ts'
import ViewHeader from './ViewHeader.vue'

type Top = MapModel | SpecModel

const top = computed<Top[]>(() => {
  const maps = [...scene.value.maps.values()].filter((m) => m.state === 'open' && !m.finished)
  const specs = [...scene.value.specs.values()].filter(
    (s) => s.state === 'open' && s.status !== 'built',
  )
  return [...maps, ...specs].sort((a, b) => urgency(a) - urgency(b) || a.number - b.number)
})

const from = (spec: SpecModel): string =>
  spec.map ? `from #${spec.map.number}${spec.map.state === 'closed' ? ' (closed)' : ''}` : 'no map'
const pointsAt = (map: MapModel): string | undefined => {
  const spec = map.specs.map((n) => scene.value.specs.get(n)!).find((s) => s.state === 'open')
  return spec ? `→ #${spec.number}` : undefined
}

const finishedMaps = computed(() =>
  [...scene.value.maps.values()].filter((m) => m.state === 'open' && m.finished),
)
const builtSpecs = computed(() =>
  [...scene.value.specs.values()].filter((s) => s.state === 'open' && s.status === 'built'),
)
const needsYou = computed(() => top.value.reduce((sum, t) => sum + t.needsYou, 0))
</script>

<template>
  <ViewHeader title="Maps and specs" icons :count="needsYou" />
  <div role="tree">
    <template v-for="item in top" :key="`${item.kind}:${item.number}`">
      <MapBranchX v-if="item.kind === 'map'" :map="item" :depth="0" />
      <SpecBranch v-else :spec="item" :depth="0" :description="from(item)" />
    </template>
    <Folds
      :finished-count="finishedMaps.length + builtSpecs.length"
      :finished-label="`${finishedMaps.length} maps · ${builtSpecs.length} specs`"
    >
      <SpecBranch
        v-for="spec in builtSpecs"
        :key="`s${spec.number}`"
        :spec="spec"
        :depth="1"
        :description="from(spec)"
        muted
      />
      <MapBranchX
        v-for="map in finishedMaps"
        :key="map.number"
        :map="map"
        :depth="1"
        muted
        :description="pointsAt(map)"
      />
    </Folds>
  </div>
</template>
