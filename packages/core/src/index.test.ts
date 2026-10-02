import { expect, test } from 'vite-plus/test'

import { name } from './index.ts'

test('the package exports its name', () => {
  expect(name).toBe('@hero-synergy/core')
})
