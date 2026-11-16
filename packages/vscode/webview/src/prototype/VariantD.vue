<script setup lang="ts">
// PROTOTYPE (#202) — Variant D, "The spec takes over its map". One row per effort. While the map
// decides, the row is the map, as today. Once `/to-spec` publishes, the row becomes the spec: its
// number and title lead, the build tickets are its children, and the map moves inside as a ⚑ item
// with its decisions folded. The map never sits in Finished while its spec is open, and a closed
// map simply rides inside its spec.
import { computed } from 'vue'

import Folds from './Folds.vue'
import MapBranchX from './MapBranchX.vue'
import type { MapModel, SpecModel } from './model.ts'
import { urgency } from './model.ts'
import SpecBranch from './SpecBranch.vue'
import { scene } from './store.ts'
import ViewHeader from './ViewHeader.vue'

const openSpecOf = (map: MapModel): SpecModel | undefined =>
  map.specs.map((n) => scene.value.specs.get(n)!).find((s) => s.state === 'open')

type Top = MapModel | SpecModel

const top = computed<Top[]>(() => {
  const maps = [...scene.value.maps.values()].filter(
    (m) => m.state === 'open' && !m.finished && !openSpecOf(m),
  )
  const specs = [...scene.value.specs.values()].filter(
    (s) => s.state === 'open' && s.status !== 'built',
  )
  return [...maps, ...specs].sort((a, b) => urgency(a) - urgency(b) || a.number - b.number)
})

const mapOf = (spec: SpecModel): MapModel | undefined =>
  spec.map ? scene.value.maps.get(spec.map.number) : undefined

const finishedMaps = computed(() =>
  [...scene.value.maps.values()].filter((m) => m.state === 'open' && m.finished && !openSpecOf(m)),
)
const builtSpecs = computed(() =>
  [...scene.value.specs.values()].filter((s) => s.state === 'open' && s.status === 'built'),
)
const needsYou = computed(() => top.value.reduce((sum, t) => sum + t.needsYou, 0))
</script>

<template>
  <ViewHeader title="Maps" icons :count="needsYou" />
  <div role="tree">
    <template v-for="item in top" :key="`${item.kind}:${item.number}`">
      <MapBranchX v-if="item.kind === 'map'" :map="item" :depth="0" />
      <SpecBranch
        v-else
        :spec="item"
        :depth="0"
        :map="mapOf(item)"
        :description="mapOf(item) ? undefined : 'no map'"
      />
    </template>
    <Folds :finished-count="finishedMaps.length + builtSpecs.length">
      <SpecBranch
        v-for="spec in builtSpecs"
        :key="`s${spec.number}`"
        :spec="spec"
        :depth="1"
        :map="mapOf(spec)"
        muted
      />
      <MapBranchX v-for="map in finishedMaps" :key="map.number" :map="map" :depth="1" muted />
    </Folds>
  </div>
</template>
