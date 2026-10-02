<script setup lang="ts">
// PROTOTYPE (ticket #7, "How do maps render in the Cockpit?"), on the webview's only page.
// Two scenes, switchable via `?variant=`:
//   many maps — M1, M2, M3: a repo with 45 maps, 38 finished (only this repo's map is real);
//   one map   — A, B, C, D: this repo's own map on its own.
// In M1 and M3 a click opens a map (`?map=<number>`), drawn with the variant in `?inside=`.
// `?width=sidebar|panel` and `?theme=dark|light` frame it.
import { computed, ref, watchEffect } from 'vue'

import './prototype/theme.css'
import { openMap } from './prototype/data.ts'
import { allMaps, realMap } from './prototype/maps.ts'
import MapsFrontier from './prototype/MapsFrontier.vue'
import MapsList from './prototype/MapsList.vue'
import MapsTree from './prototype/MapsTree.vue'
import MapsTreeFocus from './prototype/MapsTreeFocus.vue'
import PrototypeSwitcher from './prototype/PrototypeSwitcher.vue'
import VariantA from './prototype/VariantA.vue'
import VariantB from './prototype/VariantB.vue'
import VariantC from './prototype/VariantC.vue'
import VariantD from './prototype/VariantD.vue'

const variants = [
  { key: 'M1', name: 'Maps, then drill in', component: MapsList, width: 'sidebar', scene: 'maps' },
  { key: 'M2', name: 'One tree', component: MapsTree, width: 'sidebar', scene: 'maps' },
  { key: 'M3', name: 'Frontier across maps', component: MapsFrontier, width: 'sidebar', scene: 'maps' },
  { key: 'M4', name: 'Tree + focus (M2 + C)', component: MapsTreeFocus, width: 'panel', scene: 'maps' },
  { key: 'A', name: 'Frontier list', component: VariantA, width: 'sidebar', scene: 'map' },
  { key: 'B', name: 'Graph', component: VariantB, width: 'panel', scene: 'map' },
  { key: 'C', name: 'List + focus', component: VariantC, width: 'panel', scene: 'map' },
  { key: 'D', name: 'Route', component: VariantD, width: 'sidebar', scene: 'map' },
]
const byKey = (key: string | null) => variants.find((v) => v.key === key)

const params = ref(new URLSearchParams(location.search))
const current = computed(() => byKey(params.value.get('variant')) ?? byKey('M4')!)
/** The map opened from a many-maps variant, if any. */
const opened = computed(() =>
  current.value.scene === 'maps'
    ? allMaps.find((m) => m.number === Number(params.value.get('map')))
    : undefined,
)
const inside = computed(() => byKey(params.value.get('inside')) ?? byKey('D')!)

// The single-map variants read module-level bindings, so point them at the right map before
// they mount; the `:key` below remounts them when it changes.
const sync = (): void => openMap(opened.value ?? realMap)
sync()

function set(param: string, value: string): void {
  const next = new URLSearchParams(params.value)
  if (value) next.set(param, value)
  else next.delete(param)
  // A variant opens at the width it was designed for; the width buttons override it.
  if (param === 'variant' || param === 'inside') next.delete('width')
  if (param === 'variant') next.delete('map')
  history.replaceState(null, '', `?${next}`)
  params.value = next
  sync()
}

const shown = computed(() => (opened.value ? inside.value : current.value))
const width = computed(() => params.value.get('width') ?? shown.value.width)
const theme = computed(() => params.value.get('theme') ?? 'dark')
watchEffect(() => (document.documentElement.dataset.theme = theme.value))

const dev: boolean = import.meta.env.DEV
</script>

<template>
  <div class="frame" :class="width">
    <template v-if="opened">
      <button class="crumb" @click="set('map', '')">
        ‹ Maps <span class="num">#{{ opened.number }}</span>
      </button>
      <component :is="inside.component" :key="opened.number" :narrow="width === 'sidebar'" />
    </template>
    <component
      :is="current.component"
      v-else
      :narrow="width === 'sidebar'"
      @open="set('map', String($event))"
    />
  </div>
  <PrototypeSwitcher
    v-if="dev"
    :variants="variants"
    :current="current.key"
    :inside="opened ? inside.key : ''"
    :width="width"
    :theme="theme"
    @set="set"
  />
</template>

<style scoped>
.frame {
  --frame-w: 100vw;
  height: 100%;
  overflow: auto;
  background: var(--bg);
  padding-bottom: 60px;
}
.frame.sidebar {
  --frame-w: 339px;
  width: 340px;
  border-right: 1px solid var(--border);
}
.crumb {
  position: sticky;
  left: 0;
  display: block;
  width: var(--frame-w);
  padding: 6px 12px;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  color: var(--accent);
  text-align: left;
}
</style>
