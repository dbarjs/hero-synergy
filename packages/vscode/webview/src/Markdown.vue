<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import { computed } from 'vue'

/**
 * A tracker's Markdown, rendered. Raw HTML in the source is escaped, not passed through, and
 * markdown-it refuses `javascript:` and similar link targets; the page's policy also blocks
 * images and inline scripts. A click on a link never navigates the page: it asks the host.
 */
const props = defineProps<{ source: string; inline?: boolean }>()

const emit = defineEmits<{ link: [url: string] }>()

const markdown = new MarkdownIt({ html: false, linkify: false })

const html = computed(() =>
  props.inline ? markdown.renderInline(props.source) : markdown.render(props.source),
)

const follow = (event: MouseEvent): void => {
  const anchor = (event.target as Element | null)?.closest('a')
  if (!anchor) return
  event.preventDefault()
  const href = anchor.getAttribute('href')
  if (href !== null) emit('link', href)
}
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- markdown-it escapes raw HTML (`html: false`) -->
  <span v-if="inline" class="markdown inline" @click="follow" v-html="html" />
  <div v-else class="markdown" @click="follow" v-html="html" />
</template>

<style scoped>
.markdown :deep(:first-child) {
  margin-top: 0;
}
.markdown :deep(:last-child) {
  margin-bottom: 0;
}
.markdown :deep(a) {
  color: var(--vscode-textLink-foreground);
  cursor: pointer;
}
.markdown :deep(code) {
  padding: 0 3px;
  border-radius: 3px;
  font-family: var(--vscode-editor-font-family, monospace);
  background: var(--vscode-textCodeBlock-background);
}
.markdown :deep(pre) {
  overflow-x: auto;
  padding: 8px;
  border-radius: 3px;
  background: var(--vscode-textCodeBlock-background);
}
.markdown :deep(pre code) {
  padding: 0;
  background: none;
}
.markdown :deep(blockquote) {
  margin: 8px 0;
  padding: 0 12px;
  border-left: 3px solid var(--vscode-textBlockQuote-border);
  background: var(--vscode-textBlockQuote-background);
}
.markdown :deep(table) {
  border-collapse: collapse;
}
.markdown :deep(th),
.markdown :deep(td) {
  padding: 2px 8px;
  border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border));
}
</style>
