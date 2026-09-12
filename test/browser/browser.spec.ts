import { expect, test } from '@playwright/test'

declare global {
    interface Window {
        frappeBrowserTest: {
            login(): Promise<string>
            cancel(): Promise<string>
            binaryError(): Promise<string | null>
            upload(): Promise<{ progress: number[]; content: string }>
        }
    }
}

test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => typeof window.frappeBrowserTest)).toBe('object')
})

test('cookie login works in a real browser', async ({ page }) => {
    await expect(page.evaluate(() => window.frappeBrowserTest.login())).resolves.toBe('Administrator')
})

test('browser cancellation stops an in-flight request', async ({ page }) => {
    await expect(page.evaluate(() => window.frappeBrowserTest.cancel())).resolves.toBe('CancelledError')
})

test('binary error responses remain readable', async ({ page }) => {
    await expect(page.evaluate(() => window.frappeBrowserTest.binaryError())).resolves.toContain('binary failure')
})

test('XHR upload progress and authenticated download work', async ({ page }) => {
    await page.evaluate(() => window.frappeBrowserTest.login())
    const result = await page.evaluate(() => window.frappeBrowserTest.upload())
    expect(result.content).toBe('browser integration')
    expect(result.progress.at(-1)).toBeGreaterThan(0)
})
