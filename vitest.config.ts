import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const root = __dirname

export default defineConfig({
  // Route pages are read by tests/api; the root tsconfig's `jsx: preserve` would leave their JSX unparsed.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@flow-studio-ui': resolve(root, 'src/components/flow-studio'),
      '@flow-studio-runs': resolve(root, 'src/components/runs'),
      '@flow-studio': resolve(root, 'src/flow-studio'),
      '@/lib': resolve(root, 'lib'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/engine/**/*.test.ts', 'tests/api/**/*.test.ts'],
  },
})
