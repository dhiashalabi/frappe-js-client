import { CancelledError, type FrappeRequestContext, TimeoutError } from './errors'

/** Race asynchronous preparation and hooks against the same cancellation controls as network I/O. */
export function raceOperation<T>(
    operation: Promise<T> | (() => T | Promise<T>),
    controls: {
        signal?: AbortSignal
        deadline?: number
        deadlineSignal?: AbortSignal
        timeoutSignal?: AbortSignal
        request?: FrappeRequestContext
    },
): Promise<T> {
    const { signal, deadline, deadlineSignal, timeoutSignal, request } = controls
    return new Promise<T>((resolve, reject) => {
        let settled = false
        let deadlineTimer: ReturnType<typeof setTimeout> | undefined
        const cleanup = () => {
            signal?.removeEventListener('abort', onCancel)
            deadlineSignal?.removeEventListener('abort', onDeadline)
            timeoutSignal?.removeEventListener('abort', onTimeout)
            clearTimeout(deadlineTimer)
        }
        const finish = (callback: () => void) => {
            if (settled) return
            settled = true
            cleanup()
            callback()
        }
        const onCancel = () =>
            finish(() => reject(new CancelledError({ status: 0, message: 'Request was cancelled', request })))
        const onDeadline = () =>
            finish(() => reject(new TimeoutError({ status: 0, message: 'Request deadline exceeded', request })))
        const onTimeout = () =>
            finish(() => reject(new TimeoutError({ status: 0, message: 'Request timed out', request })))
        if (signal?.aborted) return onCancel()
        if (deadlineSignal?.aborted || (deadline !== undefined && deadline <= Date.now())) return onDeadline()
        if (timeoutSignal?.aborted) return onTimeout()
        signal?.addEventListener('abort', onCancel, { once: true })
        deadlineSignal?.addEventListener('abort', onDeadline, { once: true })
        timeoutSignal?.addEventListener('abort', onTimeout, { once: true })
        if (deadline !== undefined) deadlineTimer = setTimeout(onDeadline, Math.max(0, deadline - Date.now()))
        let pending: Promise<T>
        try {
            pending = typeof operation === 'function' ? Promise.resolve(operation()) : operation
        } catch (error) {
            finish(() => reject(error))
            return
        }
        pending.then(
            (value) => finish(() => resolve(value)),
            (error) => finish(() => reject(error)),
        )
    })
}
