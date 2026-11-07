import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const root = __dirname;

/** tests/django talks to a running apps.flowstudio on local Postgres. scripts/flow-studio-django-proof.sh starts one and runs this. */
export default defineConfig({
  resolve: {
    alias: {
      '@flow-studio': resolve(root, 'src/flow-studio'),
      '@/lib': resolve(root, 'lib'),
    },
  },
  test: { environment: 'node', include: ['tests/django/**/*.test.ts'], testTimeout: 300_000, hookTimeout: 120_000 },
});
