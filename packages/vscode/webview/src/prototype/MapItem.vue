<script setup lang="ts">
// PROTOTYPE (#202) — a map's ⚑ row and its Focus pane. Under a map it reads "Map" with the
// destination; inside a spec (variant D) it carries the map's own number and title.
import Row from '../Row.vue'
import type { MapModel } from './model.ts'
import { STATUS_WORDS } from './model.ts'
import ProtoFocus from './ProtoFocus.vue'
import { launch, mapActions, play, scene, select, state } from './store.ts'

const props = defineProps<{ map: MapModel; depth: number; titled?: boolean }>()

const key = `mapitem:${props.map.number}`
const action = (): ReturnType<typeof play> => play(mapActions(props.map))
const specWord = (): string | undefined => {
  const spec = props.map.specs.map((n) => scene.value.specs.get(n)).find((s) => s?.state === 'open')
  return spec ? `spec #${spec.number} · ${STATUS_WORDS[spec.status]}` : undefined
}
</script>

<template>
  <Row
    :depth="depth"
    icon="flag"
    :number="titled ? map.number : undefined"
    :label="titled ? map.title : 'Map'"
    :description="
      titled
        ? map.state === 'closed'
          ? 'closed map'
          : 'map'
        : (specWord() ?? map.destination ?? undefined)
    "
    :title="map.destination ?? undefined"
    muted
    :selected="state.selected === key"
    opens-detail
    @activate="select(key)"
  >
    <button
      v-if="action()"
      type="button"
      class="play codicon codicon-play"
      :title="action()!.command ?? ''"
      @click.stop="launch(action()!)"
    />
  </Row>
  <ProtoFocus v-if="state.selected === key" :item="{ kind: 'map', map }" :depth="depth" />
</template>

<style scoped>
.play {
  border: 0;
  padding: 0 2px;
  background: none;
  color: var(--vscode-icon-foreground);
  cursor: pointer;
}
</style>
