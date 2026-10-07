// The repo's test convention: Effect tests import from `@effect/vitest`, plain tests from
// `vite-plus/test`. Both must resolve to the one Vitest that `vp test` runs, or `expect`
// in one file would not be the `expect` the runner collects. Proven on `task/effect-vitest`.
import { describe, expect, it } from '@effect/vitest'
import { Effect, Fiber } from 'effect'
import { TestClock } from 'effect/testing'
import { describe as vpDescribe, expect as vpExpect, it as vpIt } from 'vite-plus/test'

describe('one Vitest instance', () => {
  vpIt('vite-plus/test and @effect/vitest share it', () => {
    // `it` is extended by @effect/vitest, so compare what it re-exports unchanged.
    vpExpect(vpExpect).toBe(expect)
    vpExpect(vpDescribe).toBe(describe)
  })

  it.effect('runs an Effect with the TestClock', () =>
    Effect.gen(function* () {
      const fiber = yield* Effect.sleep('1 hour').pipe(Effect.as('done'), Effect.forkChild)
      yield* TestClock.adjust('1 hour')
      expect(yield* Fiber.join(fiber)).toBe('done')
    }),
  )
})
