<script setup lang="ts">
// PROTOTYPE (ticket #7, "How do maps render in the Cockpit?"):
// four variants of the Cockpit's map view, switchable via `?variant=A|B|C|D`, on the webview's
// only page, fed by this repo's own map. `?width=sidebar|panel` and `?theme=dark|light` frame it.
import { computed, ref, watchEffect } from 'vue'

import './prototype/theme.css'
import PrototypeSwitcher from './prototype/PrototypeSwitcher.vue'
import VariantA from './prototype/VariantA.vue'
import VariantB from './prototype/VariantB.vue'
import VariantC from './prototype/VariantC.vue'
import VariantD from './prototype/VariantD.vue'

const variants = [
  { key: 'A', name: 'Frontier list', component: VariantA, width: 'sidebar' },
  { key: 'B', name: 'Graph', component: VariantB, width: 'panel' },
  { key: 'C', name: 'List + focus', component: VariantC, width: 'panel' },
  { key: 'D', name: 'Route', component: VariantD, width: 'sidebar' },
]

const params = ref(new URLSearchParams(location.search))
function set(param: string, value: string): void {
  const next = new URLSearchParams(params.value)
  next.set(param, value)
  // A variant opens at the width it was designed for; the width buttons override it.
  if (param === 'variant') next.delete('width')
  history.replaceState(null, '', `?${next}`)
  params.value = next
}

const current = computed(
  () => variants.find((v) => v.key === params.value.get('variant')) ?? variants[0]!,
)
const width = computed(() => params.value.get('width') ?? current.value.width)
const theme = computed(() => params.value.get('theme') ?? 'dark')
watchEffect(() => (document.documentElement.dataset.theme = theme.value))

const dev: boolean = import.meta.env.DEV
</script>

<template>
  <div class="frame" :class="width">
    <component :is="current.component" :narrow="width === 'sidebar'" />
  </div>
  <PrototypeSwitcher
    v-if="dev"
    :variants="variants"
    :current="current.key"
    :width="width"
    :theme="theme"
    @set="set"
  />
</template>

<style scoped>
.frame {
  height: 100%;
  overflow: auto;
  background: var(--bg);
  padding-bottom: 60px;
}
.frame {
  --frame-w: 100vw;
}
.frame.sidebar {
  --frame-w: 339px;
  width: 340px;
  border-right: 1px solid var(--border);
}
</style>
