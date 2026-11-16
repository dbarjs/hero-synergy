<script setup lang="ts">
// PROTOTYPE (#202) — a build ticket's pull request, as a row chip or as a Focus/Detail line.
// Whether the Cockpit shows it at all, and what it reads, is #209's to decide.
import type { Pr } from './issues.ts'

defineProps<{ pr: Pr; chip?: boolean }>()

const icon = (pr: Pr): string =>
  pr.state === 'merged'
    ? 'git-merge'
    : pr.state === 'closed'
      ? 'git-pull-request-closed'
      : pr.draft
        ? 'git-pull-request-draft'
        : 'git-pull-request'

const words = (pr: Pr): string =>
  pr.state === 'merged'
    ? 'merged'
    : pr.state === 'closed'
      ? 'closed unmerged'
      : `${pr.draft ? 'draft' : 'open'}${pr.checks ? ` · checks ${pr.checks}` : ''}`
</script>

<template>
  <span
    v-if="chip"
    class="chip"
    :class="[pr.state, pr.checks]"
    :title="`#${pr.number} ${pr.title}: ${words(pr)}`"
  >
    <span class="codicon" :class="`codicon-${icon(pr)}`" />{{ pr.number
    }}<span
      v-if="pr.state === 'open' && pr.checks === 'failing'"
      class="codicon codicon-error"
    /><span
      v-else-if="pr.state === 'open' && pr.checks === 'passing'"
      class="codicon codicon-check"
    />
  </span>
  <span v-else class="line" :class="[pr.state, pr.checks]">
    <span class="codicon" :class="`codicon-${icon(pr)}`" />
    <span class="num">#{{ pr.number }}</span> {{ words(pr) }}
    <span class="branch">{{ pr.branch }}</span>
  </span>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  color: var(--vscode-descriptionForeground);
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 0.9em;
}
.chip .codicon {
  font-size: 13px;
}
.open.passing {
  color: var(--vscode-charts-green);
}
.open.failing {
  color: var(--vscode-errorForeground);
}
.merged {
  color: var(--vscode-charts-purple);
}
.line .codicon {
  vertical-align: middle;
  font-size: 13px;
}
.num,
.branch {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: 0.9em;
}
.branch {
  margin-left: 4px;
  color: var(--vscode-descriptionForeground);
}
</style>
