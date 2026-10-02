import { describe, expect, it, layer } from '@effect/vitest'
import { Context, Effect, Exit, Fiber, Layer, Schema } from 'effect'
import { TestClock } from 'effect/testing'
import { describe as vpDescribe, expect as vpExpect, it as vpIt } from 'vite-plus/test'

class Greeter extends Context.Service<Greeter, { readonly greet: (name: string) => string }>()(
  'Greeter',
) {
  static layer = Layer.succeed(Greeter, { greet: (name) => `hello, ${name}` })
}

describe('@effect/vitest under Vite+', () => {
  it.effect('runs an Effect as a test', () =>
    Effect.gen(function* () {
      const value = yield* Effect.succeed(21).pipe(Effect.map((n) => n * 2))
      expect(value).toBe(42)
    }),
  )

  it.effect('provides the TestClock', () =>
    Effect.gen(function* () {
      const fiber = yield* Effect.sleep('1 hour').pipe(Effect.as('done'), Effect.forkChild)
      yield* TestClock.adjust('1 hour')
      expect(yield* Fiber.join(fiber)).toBe('done')
    }),
  )

  it.effect('closes the test scope and sees failures as exits', () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(Effect.fail('boom'))
      expect(Exit.isFailure(exit)).toBe(true)
    }),
  )

  it.live('runs against the live clock', () =>
    Effect.gen(function* () {
      const before = Date.now()
      yield* Effect.sleep('10 millis')
      expect(Date.now() - before).toBeGreaterThanOrEqual(5)
    }),
  )

  it.effect.each([1, 2, 3])('runs each case (%i)', (n) =>
    Effect.sync(() => {
      expect(n).toBeGreaterThan(0)
    }),
  )

  it.effect.fails('reports a failing Effect as a failed test', () => Effect.fail('expected'))

  it.effect.skip('skips', () => Effect.die('never runs'))

  it.effect.prop('runs property tests from a Schema', [Schema.Int], ([n]) =>
    Effect.sync(() => Number.isInteger(n)),
  )

  it.effect('gets the Vitest test context', (ctx) =>
    Effect.sync(() => {
      ctx.expect(ctx.task.name).toBe('gets the Vitest test context')
    }),
  )
})

layer(Greeter.layer)('a shared layer', (it) => {
  it.effect('provides the service', () =>
    Effect.gen(function* () {
      const greeter = yield* Greeter
      expect(greeter.greet('core')).toBe('hello, core')
    }),
  )
})

describe('one Vitest instance', () => {
  vpIt('vite-plus/test and @effect/vitest share it', () => {
    // `it` is extended by @effect/vitest, so compare what it re-exports unchanged.
    vpExpect(vpExpect).toBe(expect)
    vpExpect(vpDescribe).toBe(describe)
  })
})
