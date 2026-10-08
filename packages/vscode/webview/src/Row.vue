<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'

/**
 * One row of the Tree, at the Tree's width: a twisty or a gap, an icon, the
 * `#number` in a muted monospace run before the name, then whatever trails.
 * Every kind of row in the Tree is this component.
 */
const props = withDefaults(
  defineProps<{
    /** How far the row is indented: 0 for a map, 1 for what is under it, 2 for what is under a fold. */
    depth: number
    /** Present when the row folds: whether it is open. Absent for a row that does not fold. */
    expanded?: boolean
    /** The codicon name of the row's mark, without the `codicon-` prefix. */
    icon?: string
    number?: number | null
    label: string
    /** Muted trailing text next to the label; it gives way first when the row is narrow. */
    description?: string
    muted?: boolean
    /** The row the Focus pane is open under. */
    selected?: boolean
    /** The tooltip, for text the row has to cut. */
    title?: string
    /** Loud drift: a ⚠ after the label, with this text on hover. Absent leaves the row unmarked. */
    warn?: string
    /** Enter and a double-click open the Detail on the row; a click or Space still activates it. */
    opensDetail?: boolean
  }>(),
  // Vue casts an absent boolean prop to `false`, which would make every leaf row a closed fold.
  { expanded: undefined },
)

const emit = defineEmits<{ activate: []; openDetail: [] }>()

// A row selected from elsewhere (a neighbour clicked in the Detail) may be out of sight.
const row = useTemplateRef<HTMLElement>('row')
watch(
  () => props.selected,
  async (selected) => {
    if (!selected) return
    await nextTick()
    row.value?.scrollIntoView?.({ block: 'nearest' })
  },
)
</script>

<template>
  <div
    ref="row"
    class="row"
    :class="[`depth-${depth}`, { muted, selected }]"
    role="treeitem"
    tabindex="0"
    :aria-level="depth + 1"
    :aria-expanded="expanded === undefined ? undefined : expanded"
    :aria-selected="selected"
    :title="title"
    @click="emit('activate')"
    @dblclick="opensDetail && emit('openDetail')"
    @keydown.enter.prevent="opensDetail ? emit('openDetail') : emit('activate')"
    @keydown.space.prevent="emit('activate')"
  >
    <span
      v-if="expanded !== undefined"
      class="codicon twisty"
      :class="expanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"
    />
    <span v-else class="twisty" />
    <span v-if="icon" class="codicon mark" :class="`codicon-${icon}`" />
    <span class="label">
      <span v-if="number != null" class="num">#{{ number }}</span>
      {{ label }}
      <span
        v-if="warn"
        class="codicon codicon-warning warn"
        role="img"
        aria-label="Warning"
        :title="warn"
      />
      <span v-if="description" class="description">{{ description }}</span>
    </span>
    <span class="trail"><slot /></span>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding-right: 8px;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}
.row:hover {
  background: var(--vscode-list-hoverBackground);
}
.row.selected {
  background: var(--vscode-list-inactiveSelectionBackground);
}
.row:focus-visible {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: -1px;
}
.depth-0 {
  padding-left: 4px;
}
.depth-1 {
  padding-left: 18px;
}
.depth-2 {
  padding-left: 34px;
}
.twisty {
  flex: none;
  width: 16px;
  text-align: center;
  color: var(--vscode-icon-foreground);
}
.mark {
  flex: none;
  color: var(--vscode-icon-foreground);
}
.label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.num {
  margin-right: 2px;
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 0.9em;
  color: var(--vscode-descriptionForeground);
}
.warn {
  margin-left: 4px;
  vertical-align: middle;
  color: var(--vscode-editorWarning-foreground);
}
.description {
  margin-left: 6px;
  font-size: 0.9em;
  color: var(--vscode-descriptionForeground);
}
.trail {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9em;
}
.muted .label {
  color: var(--vscode-descriptionForeground);
}
</style>
