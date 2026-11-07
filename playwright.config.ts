import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.LEVV_E2E_PORT ?? 3310)

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/auth/login`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      LEVV_E2E: '1',
      LEVV_FIXED_NOW: '2026-10-20T09:00:00Z',
      LEVV_MOCK_AUTOCOMPLETE: '1',
      LEVV_SERVICE_TOKEN: 'e2e-service-token',
      LEVV_CRON_SECRET: 'e2e-cron-secret',
      FLOW_STUDIO_STORE: 'memory',
      LOCAL_BACKEND_URL: '',
      OPENAI_API_KEY: '',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
})
