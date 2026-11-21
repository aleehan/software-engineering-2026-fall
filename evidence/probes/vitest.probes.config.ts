import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// Audit probes are NOT product tests: they document behaviour of a reviewed version
// and are run explicitly with
//   npm test -- --config evidence/probes/vitest.probes.config.ts
// The default `npm test` (src/**/*.test.ts) does not pick them up (*.probe.ts).
export default defineConfig({
  test: {
    root: resolve(__dirname, '../..'),
    include: ['evidence/probes/**/*.probe.ts']
  }
})
