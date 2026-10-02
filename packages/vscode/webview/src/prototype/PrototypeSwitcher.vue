<script setup lang="ts">
// PROTOTYPE — floating bar, not part of any design being judged.
import { computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  variants: { key: string; name: string; scene: string }[]
  current: string
  /** The single-map variant drawing an opened map, or '' when no map is open. */
  inside: string
  width: string
  theme: string
}>()
const emit = defineEmits<{ set: [param: string, value: string] }>()

const scene = computed(() => props.variants.find((v) => v.key === props.current)!.scene)
const inScene = computed(() => props.variants.filter((v) => v.scene === scene.value))
const firstOf = (name: string): string => props.variants.find((v) => v.scene === name)!.key

function step(delta: number): void {
  const index = inScene.value.findIndex((v) => v.key === props.current)
  const size = inScene.value.length
  emit('set', 'variant', inScene.value[(index + delta + size) % size]!.key)
}
function onKey(event: KeyboardEvent): void {
  const target = event.target as HTMLElement
  if (target.closest('input, textarea, select, [contenteditable]')) return
  if (event.key === 'ArrowLeft') step(-1)
  if (event.key === 'ArrowRight') step(1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="switcher">
    <button :class="{ on: scene === 'maps' }" @click="emit('set', 'variant', firstOf('maps'))">many maps</button>
    <button :class="{ on: scene === 'map' }" @click="emit('set', 'variant', firstOf('map'))">one map</button>
    <span class="sep" />
    <button title="Previous variant (←)" @click="step(-1)">←</button>
    <span class="label"> {{ current }} — {{ variants.find((v) => v.key === current)?.name }} </span>
    <button title="Next variant (→)" @click="step(1)">→</button>
    <template v-if="inside">
      <span class="sep" />
      opened map as
      <button
        v-for="v in variants.filter((v) => v.scene === 'map')"
        :key="v.key"
        :class="{ on: inside === v.key }"
        :title="v.name"
        @click="emit('set', 'inside', v.key)"
      >
        {{ v.key }}
      </button>
    </template>
    <span class="sep" />
    <button
      :class="{ on: width === 'sidebar' }"
      title="Frame the Cockpit at sidebar width"
      @click="emit('set', 'width', 'sidebar')"
    >
      sidebar
    </button>
    <button
      :class="{ on: width === 'panel' }"
      title="Frame the Cockpit at editor-tab width"
      @click="emit('set', 'width', 'panel')"
    >
      editor tab
    </button>
    <span class="sep" />
    <button @click="emit('set', 'theme', theme === 'dark' ? 'light' : 'dark')">
      {{ theme }}
    </button>
  </div>
</template>

<style scoped>
.switcher {
  position: fixed;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  border-radius: 999px;
  background: #f5d90a;
  color: #111;
  box-shadow: 0 4px 18px rgb(0 0 0 / 50%);
  font-size: 12px;
  white-space: nowrap;
}
.label {
  min-width: 190px;
  text-align: center;
  font-weight: 600;
}
button {
  border: 0;
  border-radius: 999px;
  padding: 2px 9px;
  background: rgb(0 0 0 / 10%);
  color: #111;
}
button.on {
  background: #111;
  color: #f5d90a;
}
.sep {
  width: 1px;
  height: 14px;
  margin: 0 4px;
  background: rgb(0 0 0 / 30%);
}
</style>
