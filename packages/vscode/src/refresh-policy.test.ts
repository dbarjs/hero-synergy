import { describe, expect, it } from 'vite-plus/test'

import {
  admit,
  afterFailure,
  afterSuccess,
  budgetStatus,
  drain,
  initialPolicy,
  type PolicyState,
} from './refresh-policy.ts'

const SECOND = 1000
const reset = (seconds: number) => ({ remaining: 4000, resetAt: seconds * SECOND })

/** A policy that last collected successfully at `at` seconds. */
const collectedAt = (at: number, state: PolicyState = initialPolicy): PolicyState =>
  afterSuccess(state, at * SECOND, reset(3600))

describe('the gap between automatic collects', () => {
  it('lets the first automatic trigger start a collect', () => {
    expect(admit(initialPolicy, 'automatic', 0, 'github')[0]).toEqual({ action: 'start' })
  })

  it('skips an automatic trigger 30 s after a success and starts one at 61 s', () => {
    const state = collectedAt(100)
    expect(admit(state, 'automatic', 130 * SECOND, 'github')[0]).toEqual({
      action: 'skip',
      reason: 'gap',
    })
    expect(admit(state, 'automatic', 161 * SECOND, 'github')[0]).toEqual({ action: 'start' })
  })

  it('lets the button ignore the gap', () => {
    expect(admit(collectedAt(100), 'button', 101 * SECOND, 'github')[0]).toEqual({
      action: 'start',
    })
  })

  it('has no gap on a local tracker', () => {
    expect(admit(collectedAt(100), 'automatic', 101 * SECOND, 'local')[0]).toEqual({
      action: 'start',
    })
  })

  it('does not count a failed collect as a success', () => {
    const failed = afterFailure(collectedAt(0), 200 * SECOND, { reason: 'network' })
    expect(admit(failed, 'automatic', 201 * SECOND, 'github')[0]).toEqual({ action: 'start' })
  })
})

describe('one collect at a time', () => {
  const running = admit(initialPolicy, 'automatic', 0, 'github')[1]

  it('coalesces automatic triggers during a collect into one queued collect', () => {
    const [first, afterFirst] = admit(running, 'automatic', 5 * SECOND, 'github')
    const [second] = admit(afterFirst, 'automatic', 6 * SECOND, 'github')
    expect(first).toEqual({ action: 'queue' })
    expect(second).toEqual({ action: 'coalesced' })
  })

  it('attaches the button to the running collect', () => {
    expect(admit(running, 'button', 5 * SECOND, 'github')[0]).toEqual({ action: 'attach' })
  })

  it('runs the queued collect after a success, gap or not, and then stops', () => {
    const queued = admit(running, 'automatic', 5 * SECOND, 'github')[1]
    const finished = afterSuccess(queued, 10 * SECOND, reset(3600))
    const [again, next] = drain(finished, 10 * SECOND, 'github')
    expect(again).toBe(true)
    const [stop, idle] = drain(afterSuccess(next, 11 * SECOND, reset(3600)), 11 * SECOND, 'github')
    expect(stop).toBe(false)
    expect(idle.running).toBe(false)
  })

  it('drops the queued collect when the collect failed: nothing retries on its own', () => {
    const queued = admit(running, 'automatic', 5 * SECOND, 'github')[1]
    const failed = afterFailure(queued, 10 * SECOND, { reason: 'network' })
    const [again, idle] = drain(failed, 10 * SECOND, 'github')
    expect(again).toBe(false)
    expect(idle).toMatchObject({ running: false, queued: false })
  })
})

describe('the budget', () => {
  it('pauses automatic triggers on 999 remaining until resetAt, and the button still works', () => {
    const state = afterSuccess(initialPolicy, 0, {
      remaining: 999,
      resetAt: 1800 * SECOND,
    })
    expect(admit(state, 'automatic', 120 * SECOND, 'github')[0]).toEqual({
      action: 'skip',
      reason: 'paused',
    })
    expect(admit(state, 'button', 120 * SECOND, 'github')[0]).toEqual({ action: 'start' })
    expect(budgetStatus(state, 120 * SECOND)).toEqual({ kind: 'paused', until: 1800 * SECOND })
    expect(admit(state, 'automatic', 1801 * SECOND, 'github')[0]).toEqual({ action: 'start' })
    expect(budgetStatus(state, 1801 * SECOND)).toBeNull()
  })

  it('does not pause at 1,000 remaining', () => {
    const state = afterSuccess(initialPolicy, 0, {
      remaining: 1000,
      resetAt: 1800 * SECOND,
    })
    expect(admit(state, 'automatic', 120 * SECOND, 'github')[0]).toEqual({ action: 'start' })
  })

  it('stops automatic triggers at 0 remaining and refuses the button without calling', () => {
    const state = afterSuccess(initialPolicy, 0, {
      remaining: 0,
      resetAt: 1800 * SECOND,
    })
    expect(admit(state, 'automatic', 120 * SECOND, 'github')[0]).toEqual({
      action: 'skip',
      reason: 'rate-limited',
    })
    expect(admit(state, 'button', 120 * SECOND, 'github')[0]).toEqual({
      action: 'refuse',
      until: 1800 * SECOND,
    })
    expect(budgetStatus(state, 120 * SECOND)).toEqual({
      kind: 'rate-limited',
      until: 1800 * SECOND,
    })
  })

  it('treats a spent-limit failure like 0 remaining until its resetAt', () => {
    const state = afterFailure(initialPolicy, 0, {
      reason: 'rate-limited',
      resetAt: new Date(900 * SECOND).toISOString(),
    })
    expect(admit(state, 'button', 10 * SECOND, 'github')[0]).toEqual({
      action: 'refuse',
      until: 900 * SECOND,
    })
  })

  it('ignores the budget on a local tracker', () => {
    const state = afterSuccess(initialPolicy, 0, {
      remaining: 0,
      resetAt: 1800 * SECOND,
    })
    expect(admit(state, 'automatic', 1 * SECOND, 'local')[0]).toEqual({ action: 'start' })
  })

  it('backs a secondary limit off 60, 120 and 240 s and resets after a success', () => {
    let state: PolicyState = initialPolicy
    const waits: number[] = []
    let now = 0
    for (let i = 0; i < 3; i += 1) {
      state = afterFailure(state, now, { reason: 'secondary-limit' })
      const status = budgetStatus(state, now)
      waits.push(((status?.until ?? 0) - now) / SECOND)
      now = status?.until ?? now
    }
    expect(waits).toEqual([60, 120, 240])
    expect(admit(state, 'automatic', now - SECOND, 'github')[0]).toEqual({
      action: 'skip',
      reason: 'backoff',
    })
    state = afterSuccess(state, now, reset(7200))
    state = afterFailure(state, now + 100 * SECOND, {
      reason: 'secondary-limit',
    })
    expect(
      ((budgetStatus(state, now + 100 * SECOND)?.until ?? 0) - (now + 100 * SECOND)) / SECOND,
    ).toBe(60)
  })

  it('waits for retry-after when GitHub sends it', () => {
    const state = afterFailure(initialPolicy, 0, {
      reason: 'secondary-limit',
      retryAfter: 90,
    })
    expect(budgetStatus(state, 0)).toEqual({ kind: 'backoff', until: 90 * SECOND })
  })
})
