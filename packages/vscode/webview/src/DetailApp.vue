<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'

import type { DetailView, HostMessage } from '../../src/protocol.ts'
import Detail from './Detail.vue'
import { post } from './host.ts'

const view = shallowRef<DetailView>({ detail: null, section: null, scroll: 0 })

// The host derived the view; the webview trusts it (ADR 0002).
const onMessage = (event: MessageEvent<HostMessage>): void => {
  if (event.data.type === 'detail') view.value = event.data.view
}

onMounted(() => {
  window.addEventListener('message', onMessage)
  // A message posted before this page loaded is lost, so ask for the current view.
  post({ type: 'ready' })
})
onBeforeUnmount(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <Detail
    :view="view"
    @reveal="(key) => post({ type: 'reveal', key })"
    @open="(key) => post({ type: 'open', key })"
    @link="(url) => post({ type: 'open-link', url })"
    @launch="(key) => post({ type: 'launch', key })"
    @focus-terminal="(key) => post({ type: 'focus-terminal', key })"
    @copy="(key) => post({ type: 'copy', key })"
    @dismiss="(dismissKey) => post({ type: 'dismiss-drift', dismissKey })"
  />
</template>
