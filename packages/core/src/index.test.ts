import { expect, test } from 'vite-plus/test'

import * as core from './index.ts'

test('the package exports the two edge services with their layers', () => {
  expect(core.ProcessRunner.live).toBeDefined()
  expect(typeof core.ProcessRunner.replay).toBe('function')
  expect(core.FileSystem.live).toBeDefined()
  expect(typeof core.FileSystem.inMemory).toBe('function')
})
