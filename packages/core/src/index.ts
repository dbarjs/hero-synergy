export {
  chartMap,
  installPlugin,
  installWithNpx,
  launchFresh,
  type Launch,
  type LaunchContext,
  refText,
  renderCommand,
  type Resume,
  resumeById,
  resumeByName,
  resumeEnded,
  runSkill,
  setup,
  shellQuote,
  type SkillCommands,
  type TicketTarget,
  toSpec,
  workTicket,
} from './claude/actions.ts'
export type { Decoded } from './claude/decode.ts'
export {
  commandOf,
  type DiscoveredSkill,
  discoverSkills,
  discoverSkillsPromise,
  type DiscoverSkillsInput,
  type SkillInventory,
  type SkillSource,
  userInvokedSkills,
} from './claude/discover-skills.ts'
export {
  type PluginInstall,
  type PluginManifest,
  pluginNameOf,
  readPluginList,
  readPluginManifest,
} from './claude/plugins.ts'
export {
  readRegistry,
  type RegistryEntry,
  type RegistryStatus,
  type RegistryStatusWord,
  registryStatusWord,
} from './claude/registry.ts'
export { readSkillFrontmatter, type SkillFrontmatter } from './claude/skill.ts'
export {
  type HookPayload,
  readStatusEvent,
  readStatusEvents,
  type StatusEvent,
} from './claude/status-event.ts'
export {
  checkClaudeVersion,
  formatVersion,
  HEALTH_TABLE,
  type HealthContext,
  healthEntryList,
  healthEntryOf,
  healthLabel,
  healthLevel,
  raise,
  type Raised,
  SEEN_LIMIT,
  skillOfDetail,
  type VersionRun,
} from './claude/health.ts'
export {
  type ClaudeVersion,
  claudeVersionFloor,
  compareClaudeVersions,
  isBelowClaudeFloor,
  readClaudeVersion,
} from './claude/version.ts'
export {
  collectGitHubMaps,
  type GitHubCollect,
  ghTimeout,
  type RateLimit,
} from './github/collect.ts'
export { type GitHubRepo, mapsPerRequest } from './github/query.ts'
export { collectGitHub, findGitHubRepo, parseRemote } from './github/remote.ts'
export { GitHubCollectFailed, type GitHubFailureReason } from './github/response.ts'
export { collectGitHubPromise } from './github/run.ts'
export { readGitHubTracker } from './github/snapshot.ts'
export {
  FileSystem,
  FileSystemError,
  type FileSystemErrorCode,
  type FileSystemOperation,
  type FileSystemShape,
} from './file-system.ts'
export {
  decidedOfTotal,
  frontierOf,
  isClaimed,
  isFinished,
  type Mode,
  modeOf,
  type Neighbourhood,
  neighbourhoodOf,
  needsYouIn,
  nextOf,
  openBlockers,
  orderMaps,
  orderTickets,
  placeOf,
  type SessionFacts,
  type TicketPlace,
  type Urgency,
  urgencyOf,
} from './snapshot/derive.ts'
export {
  type Blocker,
  type Claim,
  type Decision,
  decodeSnapshot,
  encodeSnapshot,
  snapshotSchemaVersion,
  type Outcome,
  type Ref,
  type Resolution,
  type SectionEntry,
  type Snapshot,
  type SnapshotJson,
  type Ticket,
  type TicketState,
  type TicketType,
  type Tracker,
  type WayfinderMap,
} from './snapshot/model.ts'
export {
  type Collected,
  type CollectedMap,
  type CollectedTicket,
  readSnapshot,
} from './snapshot/read.ts'
export { DRIFT_TABLE, driftEntryOf } from './snapshot/drift-table.ts'
export {
  type DriftWarning,
  type HealthCode,
  healthCodes,
  type HealthWarning,
  isHealthCode,
  isLoud,
  isWarningCode,
  type Warning,
  type WarningCode,
  warningCodes,
  type WarningEntry,
  type WarningLevel,
} from './snapshot/warnings.ts'
export {
  defaultTimeout,
  type ProcessError,
  ProcessNotRecorded,
  type ProcessRecording,
  type ProcessRequest,
  type ProcessResult,
  ProcessRunner,
  type ProcessRunnerShape,
  ProcessSpawnFailed,
  toRecording,
} from './process-runner.ts'
export {
  NoRemote,
  NoRepoFound,
  NoTrackerDoc,
  type ScoutError,
  UnsupportedTracker,
} from './scout/errors.ts'
export { findRepo, ownerAndRepo, type RepoTracker } from './scout/find-repo.ts'
export {
  collectLocal,
  type LocalEffort,
  readLocalTracker,
  SCRATCH_DIRECTORY,
} from './scout/local.ts'
export {
  linkedTrackerDoc,
  locateTrackerDoc,
  readTrackerHeading,
  TRACKER_DOC_PATH,
  type TrackerDoc,
  type TrackerHeading,
  type TrackerKind,
} from './scout/tracker-doc.ts'
export { groupByTicket, ticketOfName } from './session/registry-sessions.ts'
export {
  CLAIM_PENDING_TEXT,
  claimedByOtherText,
  type DisagreementView,
  disagreementOf,
  NOT_CLAIMED_TEXT,
  WRAPPING_UP_TEXT,
} from './session/disagreements.ts'
export {
  afterReload,
  ageSince,
  describeExit,
  describeReason,
  HINT_AFTER_MS,
  isRunning,
  type Listed,
  listedOf,
  NO_STATUS_HINT,
  needsYou,
  needsYouNow,
  STATUS_UNKNOWN,
  reduceSession,
  type SessionInput,
  type SessionState,
  type SessionStatus,
  type SessionView,
  sessionLeft,
  sessionsOf,
  sessionText,
  sessionTitleOf,
  sessionView,
  shownStatus,
  STATUS_WORDS,
  type TerminalExit,
  ticketOfTerminalName,
} from './session/session.ts'
export {
  type ListedWorktree,
  parseWorktreeList,
  readWorktrees,
  readWorktreesPromise,
  ticketOfBranch,
  type WorktreeState,
  worktreeText,
} from './worktree/worktrees.ts'
