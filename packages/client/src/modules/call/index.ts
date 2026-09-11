import type { RequestOptions } from '../../core/types'
import type { ModuleDeps } from '../deps'
import type { ApiArgs } from './types'

/**
 * Call arbitrary `/api/method` paths that this client does not wrap (custom apps, third-party
 * APIs).
 *
 * `delete` here destroys a server-side resource identified by a method path. Reversible
 * associations (tags, assignments) live on `desk` and use `remove*`.
 */
class FrappeCallImpl {
    private readonly adapter: ModuleDeps['adapter']
    private readonly executor: ModuleDeps['executor']

    /** @internal */
    constructor(deps: ModuleDeps) {
        this.adapter = deps.adapter
        this.executor = deps.executor
    }

    get<T = unknown>(path: string, args?: ApiArgs, options?: RequestOptions): Promise<T> {
        return this.executor.call<T>(
            { method: 'GET', url: this.adapter.method(path), params: args },
            'envelope',
            options,
        )
    }

    post<T = unknown>(path: string, args?: ApiArgs, options?: RequestOptions): Promise<T> {
        return this.executor.call<T>(
            { method: 'POST', url: this.adapter.method(path), data: args },
            'envelope',
            options,
        )
    }

    put<T = unknown>(path: string, args?: ApiArgs, options?: RequestOptions): Promise<T> {
        return this.executor.call<T>({ method: 'PUT', url: this.adapter.method(path), data: args }, 'envelope', options)
    }

    delete<T = unknown>(path: string, args?: ApiArgs, options?: RequestOptions): Promise<T> {
        return this.executor.call<T>(
            { method: 'DELETE', url: this.adapter.method(path), params: args },
            'envelope',
            options,
        )
    }

    /**
     * `/api/v2/method/{Doctype}/{method}`. Requires `apiVersion: 2`.
     * @throws FeatureNotSupportedError on classic REST.
     */
    async doctypeMethod<T = unknown>(
        doctype: string,
        method: string,
        args?: ApiArgs,
        options?: RequestOptions,
    ): Promise<T> {
        return this.executor.run<T>(this.adapter.controllerMethod(doctype, method, args), options)
    }

    /**
     * `run_doc_method`. Requires `apiVersion: 2`.
     * @throws FeatureNotSupportedError on classic REST.
     */
    async runDocMethod<T = unknown>(
        method: string,
        document: Record<string, unknown>,
        args?: Record<string, unknown>,
        options?: RequestOptions,
    ): Promise<T> {
        return this.executor.run<T>(this.adapter.runDocMethod(method, document, args), options)
    }
}

export type FrappeCall = FrappeCallImpl

/** @internal */
export function createFrappeCall(deps: ModuleDeps): FrappeCall {
    return new FrappeCallImpl(deps)
}

export * from './types'
