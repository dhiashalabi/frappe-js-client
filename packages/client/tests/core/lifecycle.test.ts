import { describe, expect, it, vi } from 'vitest'

import { raceOperation } from '../../src/core/lifecycle'

describe('operation lifecycle', () => {
    it('refuses already expired work without invoking the hook', async () => {
        const hook = vi.fn(() => 1)
        const deadline = new AbortController()
        deadline.abort()
        await expect(raceOperation(hook, { deadlineSignal: deadline.signal })).rejects.toMatchObject({ name: 'TimeoutError' })
        const timeout = new AbortController()
        timeout.abort()
        await expect(raceOperation(hook, { timeoutSignal: timeout.signal })).rejects.toMatchObject({ name: 'TimeoutError' })
        expect(hook).not.toHaveBeenCalled()
    })

    it('maps a synchronous hook failure and observes a rejection after cancellation', async () => {
        const failed = new Error('hook failed')
        await expect(raceOperation(() => { throw failed }, {})).rejects.toBe(failed)
        const controller = new AbortController()
        let rejectLate!: (error: Error) => void
        const pending = raceOperation(new Promise<void>((_resolve, reject) => { rejectLate = reject }), { signal: controller.signal })
        controller.abort()
        await expect(pending).rejects.toMatchObject({ name: 'CancelledError' })
        rejectLate(new Error('late'))
        await Promise.resolve()
    })
})
