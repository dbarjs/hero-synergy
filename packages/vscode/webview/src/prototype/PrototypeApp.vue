<script setup lang="ts">
// PROTOTYPE (#202, "How do specs and build tickets render in the Tree and the Detail?").
// Four variants of where a spec sits, switchable via `?variant=A|B|C|D`, each drawn in a VS Code
// frame: the Tree in the side bar (real Row.vue rows) and the Detail in an editor tab, sharing one
// selection. `?when=oct7` replays this repo mid-build of #37 (26 build tickets); `?detail=issue`
// swaps the spec and build-ticket Detail for the body-as-written shape; `?theme=light`.
import { computed, useTemplateRef } from 'vue'

import DetailHost from './DetailHost.vue'
import PrototypeSwitcher from './PrototypeSwitcher.vue'
import { VARIANTS, scene, state } from './store.ts'
import VariantA from './VariantA.vue'
import VariantB from './VariantB.vue'
import VariantC from './VariantC.vue'
import VariantD from './VariantD.vue'

const COMPONENTS = { A: VariantA, B: VariantB, C: VariantC, D: VariantD } as const
const current = computed(() => COMPONENTS[state.variant as keyof typeof COMPONENTS] ?? VariantA)
const detail = useTemplateRef<{ title: string }>('detail')

const counts = computed(() => {
  const specs = [...scene.value.specs.values()].filter((s) => s.state === 'open')
  const maps = [...scene.value.maps.values()].filter((m) => m.state === 'open')
  return `${maps.length} open maps · ${specs.length} open specs · ${scene.value.label}`
})
void VARIANTS
</script>

<template>
  <div class="window" :style="{ '--sidebar': state.width === 'wide' ? '440px' : '320px' }">
    <nav class="activity">
      <span class="codicon codicon-files" />
      <span class="codicon codicon-search" />
      <span class="codicon codicon-source-control" />
      <span class="hero">
        <span class="codicon codicon-compass" />
      </span>
    </nav>
    <aside class="sidebar">
      <div class="sidebar-title">Hero Synergy</div>
      <div class="views">
        <component :is="current" :key="`${state.variant}-${state.when}`" />
      </div>
    </aside>
    <main class="editor">
      <div class="tabs">
        <div class="tab active">
          <span class="codicon codicon-compass" />
          <span class="tab-title">{{ detail?.title ?? 'Cockpit Detail' }}</span>
          <span class="codicon codicon-close" />
        </div>
      </div>
      <div class="editor-body">
        <DetailHost ref="detail" />
      </div>
    </main>
    <div class="status">{{ counts }}</div>
    <pre v-if="state.toast" class="toast">{{ state.toast }}</pre>
    <PrototypeSwitcher />
  </div>
</template>

<style scoped>
.window {
  display: grid;
  grid-template-columns: 48px var(--sidebar, 320px) 1fr;
  grid-template-rows: 1fr 22px;
  height: 100vh;
  overflow: hidden;
}
.activity {
  grid-row: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding-top: 12px;
  background: var(--vscode-activityBar-background);
  border-right: 1px solid var(--vscode-sideBarSectionHeader-border);
}
.activity .codicon {
  font-size: 22px;
  color: var(--vscode-descriptionForeground);
}
.activity .hero {
  position: relative;
  padding-left: 0;
  border-left: 2px solid var(--vscode-focusBorder);
}
.activity .hero .codicon {
  color: var(--vscode-foreground);
}
.sidebar {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--vscode-sideBar-background);
  border-right: 1px solid var(--vscode-sideBarSectionHeader-border);
}
.sidebar-title {
  flex: none;
  height: 35px;
  padding: 0 12px 0 20px;
  line-height: 35px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--vscode-sideBarTitle-foreground);
}
.views {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 80px;
}
.editor {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--vscode-editor-background);
}
.tabs {
  flex: none;
  display: flex;
  height: 35px;
  background: var(--vscode-sideBar-background);
}
.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 420px;
  padding: 0 10px;
  border-top: 1px solid var(--vscode-focusBorder);
  background: var(--vscode-editor-background);
}
.tab-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.editor-body {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 80px;
}
.status {
  grid-column: 1 / -1;
  padding: 0 10px;
  line-height: 22px;
  font-size: 12px;
  background: var(--vscode-statusBar-background);
  color: var(--vscode-statusBar-foreground);
  white-space: nowrap;
  overflow: hidden;
}
.toast {
  position: fixed;
  top: 44px;
  right: 16px;
  z-index: 1000;
  max-width: 560px;
  margin: 0;
  padding: 8px 12px;
  border: 1px solid var(--vscode-focusBorder);
  border-radius: 4px;
  background: var(--vscode-editorWidget-background);
  white-space: pre-wrap;
  word-break: break-all;
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 40%);
}
</style>
