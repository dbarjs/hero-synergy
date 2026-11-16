<script setup lang="ts">
// PROTOTYPE — floating bar, not part of any design being judged.
import { computed, onMounted, onUnmounted } from 'vue'

import { VARIANTS, setWhen, state } from './store.ts'

const index = computed(() =>
  Math.max(
    0,
    VARIANTS.findIndex((v) => v.key === state.variant),
  ),
)
const step = (delta: number): void => {
  const size = VARIANTS.length
  state.variant = VARIANTS[(index.value + delta + size) % size]!.key
}
const onKey = (event: KeyboardEvent): void => {
  if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return
  if (event.key === 'ArrowLeft') step(-1)
  if (event.key === 'ArrowRight') step(1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="switcher">
    <button title="Previous variant (←)" @click="step(-1)">←</button>
    <span class="label">{{ VARIANTS[index]!.key }} — {{ VARIANTS[index]!.name }}</span>
    <button title="Next variant (→)" @click="step(1)">→</button>
    <span class="sep" />
    <button
      :class="{ on: state.when === 'now' }"
      title="This repo today: #163 with 11 build tickets"
      @click="setWhen('now')"
    >
      today
    </button>
    <button
      :class="{ on: state.when === 'oct7' }"
      title="This repo on 2026-10-07 18:40: #37 mid-build, 26 build tickets"
      @click="setWhen('oct7')"
    >
      oct 7
    </button>
    <span class="sep" />
    <button
      :class="{ on: state.detail === 'progress' }"
      title="Spec Detail: build tickets first, sections, stories folded"
      @click="state.detail = 'progress'"
    >
      detail: progress
    </button>
    <button
      :class="{ on: state.detail === 'issue' }"
      title="Spec Detail: list, then the body as written"
      @click="state.detail = 'issue'"
    >
      detail: issue
    </button>
    <span class="sep" />
    <button @click="state.width = state.width === 'narrow' ? 'wide' : 'narrow'">
      {{ state.width === 'narrow' ? '320px' : '440px' }}
    </button>
    <button @click="state.theme = state.theme === 'dark' ? 'light' : 'dark'">
      {{ state.theme }}
    </button>
  </div>
</template>

<style scoped>
.switcher {
  position: fixed;
  bottom: 30px;
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
  font:
    12px/1.4 -apple-system,
    'Segoe UI',
    system-ui,
    sans-serif;
  white-space: nowrap;
}
.label {
  min-width: 230px;
  text-align: center;
  font-weight: 600;
}
button {
  border: 0;
  border-radius: 999px;
  padding: 2px 9px;
  background: rgb(0 0 0 / 10%);
  color: #111;
  font: inherit;
  cursor: pointer;
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
