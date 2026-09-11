import type { AuthStrategy } from '../../core/auth'
import type { RequestOptions } from '../../core/types'
import type { ModuleDeps } from '../deps'
import type { AuthCredentials, AuthResponse } from './types'

/**
 * Login, logout, session identity, and password reset. These hit Frappe's classic
 * `/api/method/...` endpoints regardless of `apiVersion`.
 */
class FrappeAuthImpl {
    private readonly adapter: ModuleDeps['adapter']
    private readonly executor: ModuleDeps['executor']
    private readonly authStrategy: AuthStrategy

    /** @internal */
    constructor(deps: ModuleDeps, authStrategy: AuthStrategy) {
        this.adapter = deps.adapter
        this.executor = deps.executor
        this.authStrategy = authStrategy
    }

    /** OTP + `tmpId` may be sent on this same request after the first factor. */
    login(credentials: AuthCredentials, options?: RequestOptions): Promise<AuthResponse> {
        return this.executor.call<AuthResponse>(
            {
                method: 'POST',
                url: this.adapter.classicMethod('login'),
                data: {
                    usr: credentials.username,
                    pwd: credentials.password,
                    otp: credentials.otp,
                    tmp_id: credentials.tmpId,
                    device: credentials.device,
                },
            },
            'none',
            options,
        )
    }

    getLoggedUser(options?: RequestOptions): Promise<string> {
        return this.executor.call<string>(
            { method: 'GET', url: this.adapter.method('frappe.auth.get_logged_user') },
            'envelope',
            options,
        )
    }

    /** End the server session, then `reset()` the auth strategy (clears cookie jars / cached tokens). */
    async logout(options?: RequestOptions): Promise<void> {
        try {
            await this.executor.call<unknown>(
                { method: 'POST', url: this.adapter.classicMethod('logout'), data: {} },
                'none',
                options,
            )
        } finally {
            await this.authStrategy.reset?.()
        }
    }

    async forgetPassword(user: string, options?: RequestOptions): Promise<void> {
        await this.executor.call<unknown>(
            {
                method: 'POST',
                url: this.adapter.classicMethod('frappe.core.doctype.user.user.reset_password'),
                data: { user },
            },
            'message',
            options,
        )
    }

    /** Health check. Uses `ping` on v2 and `frappe.ping` on classic REST. */
    ping(options?: RequestOptions): Promise<string> {
        const path = this.adapter.version === 2 ? this.adapter.method('ping') : this.adapter.method('frappe.ping')
        return this.executor.call<string>({ method: 'GET', url: path }, 'envelope', options)
    }
}

/** Login, logout, session identity, and password reset. */
export type FrappeAuth = FrappeAuthImpl

/** @internal */
export function createFrappeAuth(deps: ModuleDeps, authStrategy: AuthStrategy): FrappeAuth {
    return new FrappeAuthImpl(deps, authStrategy)
}

export * from './types'
