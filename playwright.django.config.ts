import { defineConfig, devices } from '@playwright/test';

/** Run by scripts/flow-studio-django-proof.sh, which starts `next start` with FLOW_STUDIO_STORE=django against local Django. */
export default defineConfig({
  testDir: './tests/django-e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: process.env.FLOW_STUDIO_PROOF_OUTPUT ?? 'test-results/django',
  use: {
    baseURL: process.env.NEXT_URL,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
});
