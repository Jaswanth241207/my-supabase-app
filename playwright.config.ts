import { defineConfig, devices } from '@playwright/test'

const base = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: base, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev -- --port 5173',
    url: base,
    reuseExistingServer: true,
    // Smoke tests need no backend; real values are used when provided in the environment.
    env: { VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'test-anon-key' },
  },
})
