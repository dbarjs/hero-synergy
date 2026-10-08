<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'

import type { HostMessage, ViewModel } from '../../src/protocol.ts'
import { post } from './host.ts'
import Tree from './Tree.vue'

const viewModel = shallowRef<ViewModel>({ kind: 'loading' })

// The host validated the view model before sending it; the webview trusts it (ADR 0002).
const onMessage = (event: MessageEvent<HostMessage>): void => {
  if (event.data.type === 'view-model') viewModel.value = event.data.viewModel
}

onMounted(() => {
  window.addEventListener('message', onMessage)
  // A message posted before this page loaded is lost, so ask for the current view model.
  post({ type: 'ready' })
})
onBeforeUnmount(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <Tree
    :view-model="viewModel"
    @expand="(key) => post({ type: 'expand', key })"
    @collapse="(key) => post({ type: 'collapse', key })"
    @select="(key) => post({ type: 'select', key })"
    @open="(key) => post({ type: 'open', key })"
    @refresh="post({ type: 'refresh' })"
    @open-detail="(key, section) => post({ type: 'open-detail', key, section })"
    @launch="(key, action) => post({ type: 'launch', key, action })"
    @focus-terminal="(key) => post({ type: 'focus-terminal', key })"
    @copy="(key, action) => post({ type: 'copy', key, action })"
    @dismiss-health="(dismissKey) => post({ type: 'dismiss-health', dismissKey })"
  />
</template>
