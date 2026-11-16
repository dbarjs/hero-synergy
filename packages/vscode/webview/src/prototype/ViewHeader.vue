<script setup lang="ts">
// PROTOTYPE (#202) — a VS Code view's title bar, so the Tree is judged in its real frame.
defineProps<{ title: string; expanded?: boolean; icons?: boolean; count?: number }>()
const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <div class="view-header" @click="emit('toggle')">
    <span
      class="codicon"
      :class="expanded === false ? 'codicon-chevron-right' : 'codicon-chevron-down'"
    />
    <span class="name">{{ title }}</span>
    <span v-if="count !== undefined && count > 0" class="badge">{{ count }}</span>
    <span class="spacer" />
    <template v-if="icons">
      <span class="codicon codicon-compass" title="Chart a map" />
      <span class="codicon codicon-terminal" title="Run skill…" />
      <span class="codicon codicon-refresh" title="Refresh" />
    </template>
  </div>
</template>

<style scoped>
.view-header {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px 0 2px;
  border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
  color: var(--vscode-sideBarTitle-foreground);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
  user-select: none;
}
.spacer {
  flex: 1;
}
.codicon {
  font-size: 14px;
  color: var(--vscode-icon-foreground);
}
.badge {
  padding: 0 5px;
  border-radius: 8px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  font-size: 10px;
  line-height: 14px;
}
</style>
