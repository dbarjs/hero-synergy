/**
 * The refresh policy: when a trigger starts a collect, waits behind one, joins
 * one or is dropped. Pure over a clock the caller reads, so tests move time by
 * hand and the extension reads it from Effect's `Clock`. Times are epoch
 * milliseconds.
 */

/** An automatic trigger needs this long since the last successful collect. */
export const AUTOMATIC_GAP_MS = 60_000
/** Below this many points left, automatic triggers pause until the reset. */
export const BUDGET_FLOOR = 1_000
/** The first secondary-limit wait when GitHub sends no `retry-after`; each repeat doubles it. */
export const SECONDARY_WAIT_MS = 60_000

/** What the budget keeps of the last good request: the points left and when they come back. */
export interface RateBudget {
  readonly remaining: number
  readonly resetAt: number
}

/** The part of a failed collect the policy acts on. */
export interface FailureFacts {
  readonly reason: string
  /** Seconds, for a secondary limit that sent `retry-after`. */
  readonly retryAfter?: number | undefined
  /** ISO time, for a primary limit that said when it resets. */
  readonly resetAt?: string | undefined
}

export interface PolicyState {
  /** When the last collect succeeded; null before the first. */
  readonly lastSuccessAt: number | null
  readonly lastFailed: boolean
  readonly budget: RateBudget | null
  /** The secondary-limit wait in force: when it ends and how long it was, for doubling. */
  readonly secondary: { readonly until: number; readonly wait: number } | null
  readonly running: boolean
  /** A trigger arrived during the running collect and waits behind it. */
  readonly queued: boolean
}

export const initialPolicy: PolicyState = {
  lastSuccessAt: null,
  lastFailed: false,
  budget: null,
  secondary: null,
  running: false,
  queued: false,
}

export type Trigger = 'automatic' | 'button'
/** A local tracker has no gap and no budget. */
export type TrackerKind = 'github' | 'local'

export type Decision =
  /** Run a collect now. */
  | { readonly action: 'start' }
  /** Run one after the current collect. */
  | { readonly action: 'queue' }
  /** A collect is already queued; this trigger joins it. */
  | { readonly action: 'coalesced' }
  /** The button joins the running collect instead of starting another. */
  | { readonly action: 'attach' }
  | { readonly action: 'skip'; readonly reason: 'gap' | 'paused' | 'rate-limited' | 'backoff' }
  /** The button at 0 remaining: say so without calling. */
  | { readonly action: 'refuse'; readonly until: number }

/** What holds automatic triggers back right now, and until when. */
export interface BudgetStatus {
  readonly kind: 'paused' | 'rate-limited' | 'backoff'
  readonly until: number
}

export const budgetStatus = (state: PolicyState, now: number): BudgetStatus | null => {
  const { budget, secondary } = state
  if (budget !== null && now < budget.resetAt) {
    if (budget.remaining <= 0) return { kind: 'rate-limited', until: budget.resetAt }
    if (budget.remaining < BUDGET_FLOOR) return { kind: 'paused', until: budget.resetAt }
  }
  if (secondary !== null && now < secondary.until)
    return { kind: 'backoff', until: secondary.until }
  return null
}

/**
 * Decides one trigger and returns the state it leaves behind. Admission is the
 * only place the gap and the budget are checked, so a queued collect, once
 * admitted, runs after the one in flight.
 */
export const admit = (
  state: PolicyState,
  trigger: Trigger,
  now: number,
  tracker: TrackerKind,
): readonly [Decision, PolicyState] => {
  const github = tracker === 'github'
  const status = github ? budgetStatus(state, now) : null

  if (github && trigger === 'button' && status?.kind === 'rate-limited') {
    return [{ action: 'refuse', until: status.until }, state]
  }
  if (trigger === 'button') {
    if (state.running) return [{ action: 'attach' }, state]
    return [{ action: 'start' }, { ...state, running: true }]
  }

  if (github) {
    if (status !== null) return [{ action: 'skip', reason: skipReason(status) }, state]
    if (state.lastSuccessAt !== null && now - state.lastSuccessAt < AUTOMATIC_GAP_MS) {
      return [{ action: 'skip', reason: 'gap' }, state]
    }
  }
  if (state.running) {
    return state.queued
      ? [{ action: 'coalesced' }, state]
      : [{ action: 'queue' }, { ...state, queued: true }]
  }
  return [{ action: 'start' }, { ...state, running: true }]
}

const skipReason = (status: BudgetStatus): 'paused' | 'rate-limited' | 'backoff' => status.kind

/** The running collect succeeded: stamp it, take its budget and forget any secondary wait. */
export const afterSuccess = (
  state: PolicyState,
  now: number,
  budget: RateBudget | null,
): PolicyState => ({ ...state, lastSuccessAt: now, lastFailed: false, budget, secondary: null })

/** The running collect failed: only the two limits change what happens next. */
export const afterFailure = (
  state: PolicyState,
  now: number,
  failure: FailureFacts,
): PolicyState => {
  const failed = { ...state, lastFailed: true }
  if (failure.reason === 'rate-limited') {
    const reset = failure.resetAt === undefined ? Number.NaN : Date.parse(failure.resetAt)
    return {
      ...failed,
      budget: { remaining: 0, resetAt: Number.isFinite(reset) ? reset : now + SECONDARY_WAIT_MS },
    }
  }
  if (failure.reason === 'secondary-limit') {
    const wait =
      failure.retryAfter !== undefined
        ? failure.retryAfter * 1000
        : state.secondary === null
          ? SECONDARY_WAIT_MS
          : state.secondary.wait * 2
    return { ...failed, secondary: { until: now + wait, wait } }
  }
  return failed
}

/**
 * The running collect ended: whether the queued one runs now. It does after a
 * success while the budget allows; after a failure it is dropped, because
 * nothing retries on its own.
 */
export const drain = (
  state: PolicyState,
  now: number,
  tracker: TrackerKind,
): readonly [boolean, PolicyState] => {
  const blocked = tracker === 'github' && budgetStatus(state, now) !== null
  const again = state.queued && !state.lastFailed && !blocked
  return [again, { ...state, queued: false, running: again }]
}
