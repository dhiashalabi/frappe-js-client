import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.BROWSER_TEST_PORT ?? 4173)
const origin = `http://127.0.0.1:${port}`

export default defineConfig({
    testDir: './test/browser',
    fullyParallel: false,
    workers: 1,
    timeout: 30_000,
    reporter: 'line',
    use: { baseURL: origin, trace: 'retain-on-failure' },
    webServer: {
        command: 'node test/browser/server.mjs',
        url: origin,
        reuseExistingServer: false,
        env: Object.fromEntries(
            Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
        ),
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ],
})
