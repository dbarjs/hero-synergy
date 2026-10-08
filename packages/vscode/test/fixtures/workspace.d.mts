export function createWorkspace(parent: string): string
export function createClaudeStub(parent: string): {
  claude: string
  argvFile: string
  envFile: string
  cwdFile: string
  scriptFile: string
  writtenFile: string
}
export function createLaunchableWorkspace(parent: string): {
  workspace: string
  claude: string
  argvFile: string
  envFile: string
  cwdFile: string
  scriptFile: string
  writtenFile: string
}
export function writeUserSettings(userDataDir: string, settings: Record<string, unknown>): void
export function createGitHubWorkspace(
  parent: string,
  recording: string,
): { workspace: string; bin: string }
export function createBareWorkspace(parent: string): string
