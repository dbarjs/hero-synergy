export function createWorkspace(parent: string): string
export function createGitHubWorkspace(
  parent: string,
  recording: string,
): { workspace: string; bin: string }
export function createBareWorkspace(parent: string): string
