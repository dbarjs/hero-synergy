<script setup lang="ts">
// PROTOTYPE (#202) — Variant C, "A section of its own". Two views in the Hero Synergy container,
// as VS Code stacks them: SPECS on top (where the building happens) and MAPS below, unchanged from
// today. Each view has its own badge, and VS Code lets the user collapse, resize or move either.
import { computed } from 'vue'

import Folds from './Folds.vue'
import MapBranchX from './MapBranchX.vue'
import type { MapModel, SpecModel } from './model.ts'
import { byUrgency } from './model.ts'
import Row from '../Row.vue'
import SpecBranch from './SpecBranch.vue'
import { isOpen, scene, toggle } from './store.ts'
import ViewHeader from './ViewHeader.vue'

const specs = computed(() =>
  byUrgency(
    [...scene.value.specs.values()].filter((s) => s.state === 'open' && s.status !== 'built'),
  ),
)
const built = computed(() =>
  [...scene.value.specs.values()].filter((s) => s.state === 'open' && s.status === 'built'),
)
const maps = computed(() =>
  byUrgency([...scene.value.maps.values()].filter((m) => m.state === 'open' && !m.finished)),
)
const finished = computed(() =>
  [...scene.value.maps.values()].filter((m) => m.state === 'open' && m.finished),
)

const from = (spec: SpecModel): string =>
  spec.map ? `← #${spec.map.number}${spec.map.state === 'closed' ? ' (closed)' : ''}` : 'no map'
const specWord = (map: MapModel): string | undefined => {
  const spec = map.specs.map((n) => scene.value.specs.get(n)!).find((s) => s.state === 'open')
  return spec ? `spec #${spec.number}` : undefined
}
const specsNeedYou = computed(() => specs.value.reduce((sum, s) => sum + s.needsYou, 0))
const mapsNeedYou = computed(() => maps.value.reduce((sum, m) => sum + m.needsYou, 0))
</script>

<template>
  <ViewHeader
    title="Specs"
    :expanded="isOpen('section:specs')"
    :count="specsNeedYou"
    @toggle="toggle('section:specs')"
  />
  <div v-if="isOpen('section:specs')" role="tree" class="section">
    <SpecBranch
      v-for="spec in specs"
      :key="spec.number"
      :spec="spec"
      :depth="0"
      :description="from(spec)"
    />
    <template v-if="built.length > 0">
      <Row
        :depth="0"
        :expanded="isOpen('specs-built')"
        icon="check-all"
        label="Built"
        muted
        @activate="toggle('specs-built')"
      >
        <span class="count">{{ built.length }}</span>
      </Row>
      <template v-if="isOpen('specs-built')">
        <SpecBranch
          v-for="spec in built"
          :key="spec.number"
          :spec="spec"
          :depth="1"
          :description="from(spec)"
          muted
        />
      </template>
    </template>
  </div>

  <ViewHeader
    title="Maps"
    icons
    :expanded="isOpen('section:maps')"
    :count="mapsNeedYou"
    @toggle="toggle('section:maps')"
  />
  <div v-if="isOpen('section:maps')" role="tree" class="section">
    <MapBranchX v-for="map in maps" :key="map.number" :map="map" :depth="0" />
    <Folds :finished-count="finished.length" :finished-label="`${finished.length} maps`">
      <MapBranchX
        v-for="map in finished"
        :key="map.number"
        :map="map"
        :depth="1"
        muted
        :description="specWord(map)"
      />
    </Folds>
  </div>
</template>

<style scoped>
.section {
  padding-bottom: 8px;
}
.count {
  color: var(--vscode-descriptionForeground);
}
</style>
