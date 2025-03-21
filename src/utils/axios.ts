/**
 * @module utils/axios
 * @description Provides utility functions for creating and configuring Axios instances
 * with Frappe-specific headers and authentication. This module handles CSRF token management,
 * site name headers, and authentication token configuration for API requests.
 *
 * @packageDocumentation
 * @preferred
 *
 * @example
 * ```typescript
 * import { getAxiosClient } from '@frappe/axios'
 *
 * // Create a client with Bearer token authentication
 * const client = getAxiosClient(
 *   'https://api.example.com',
 *   true,
 *   () => 'your-token',
 *   'Bearer'
 * );
 *
 * // Create a client without authentication
 * const basicClient = getAxiosClient('https://api.example.com');
 * ```
 */

import axios, {
    AxiosError,
    AxiosInstance,
    AxiosRequestConfig,
    AxiosResponse,
    isAxiosError,
    RawAxiosRequestHeaders,
} from 'axios'
import { FrappeError } from '../frappe/types'

/**
 * Creates and configures an Axios instance with Frappe-specific settings.
 *
 * @param appURL - The base URL for API requests
 * @param useToken - Optional flag to enable token-based authentication
 * @param token - Optional function that returns the authentication token
 * @param tokenType - Optional token type, either 'Bearer' or 'token'
 * @param customHeaders - Optional additional headers to include in requests
 *
 * @returns An configured Axios instance
 *
 * @example
 * ```typescript
 * // Basic usage without authentication
 * const client = getAxiosClient('https://instance.example.com');
 *
 * // With Bearer token authentication
 * const authenticatedClient = getAxiosClient(
 *   'https://instance.example.com',
 *   true,
 *   () => localStorage.getItem('token'),
 *   'Bearer'
 * );
 *
 * // With custom headers
 * const clientWithHeaders = getAxiosClient(
 *   'https://instance.example.com',
 *   false,
 *   undefined,
 *   undefined,
 *   { 'Custom-Header': 'value' }
 * );
 * ```
 */
export function getAxiosClient(
    appURL: string,
    useToken?: boolean,
    token?: () => string,
    tokenType?: 'Bearer' | 'token',
    customHeaders?: object,
): AxiosInstance {
    return axios.create({
        baseURL: appURL,
        headers: {
            ...getRequestHeaders(useToken, tokenType, token, appURL, customHeaders),
            'Content-Type': 'application/json; charset=utf-8',
        },
        withCredentials: true,
    })
}

/**
 * Generates request headers for Frappe API requests.
 *
 * @param useToken - Whether to include authentication token in headers
 * @param tokenType - The type of authentication token ('Bearer' or 'token')
 * @param token - Function that returns the authentication token
 * @param appURL - The base URL of the application
 * @param customHeaders - Additional custom headers to include
 *
 * @returns An object containing the configured request headers
 *
 * @remarks
 * This function automatically handles:
 * - Content-Type and Accept headers for JSON
 * - Authentication token headers when specified
 * - Frappe-specific headers (X-Frappe-Site-Name)
 * - CSRF token headers in browser environments
 *
 * @example
 * ```typescript
 * const headers = getRequestHeaders(
 *   true,
 *   'Bearer',
 *   () => 'your-token',
 *   'https://instance.example.com',
 *   { 'Custom-Header': 'value' }
 * );
 * ```
 *
 * @internal
 */
export function getRequestHeaders(
    useToken = false,
    tokenType?: 'Bearer' | 'token',
    token?: () => string,
    appURL?: string,
    customHeaders?: object,
): RawAxiosRequestHeaders {
    const headers: RawAxiosRequestHeaders = {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
    }

    if (useToken && tokenType && token) {
        headers.Authorization = `${tokenType} ${token()}`
    }

    // Extract site name from appURL if provided
    const siteName = getSiteName(appURL)

    // in case of browser environments
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        // Only set X-Frappe-Site-Name if appURL matches window origin
        if (!appURL || new URL(appURL).origin === window.location.origin) {
            headers['X-Frappe-Site-Name'] = siteName || window.location.hostname
        }

        if (window.csrf_token && window.csrf_token !== '{{ csrf_token }}') {
            headers['X-Frappe-CSRF-Token'] = window.csrf_token
        }
    }

    return {
        ...headers,
        ...(customHeaders ?? {}),
    }
}

export function getCSRFToken(): string | undefined {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return undefined
    }

    const meta = document.querySelector('meta[name="csrf_token"]')
    if (meta) {
        const content = meta.getAttribute('content')
        return content ?? undefined
    }

    return undefined
}

/**
 * Interface for the request handler options
 */
export interface RequestHandlerOptions<T = any, R = any> {
    /** The axios instance to use for the request */
    axios: AxiosInstance
    /** The request configuration */
    config: AxiosRequestConfig
    /** Optional error message to use when request fails */
    errorMessage?: string
    /** Optional function to transform the response data */
    transformResponse?: (response: T) => R
}

/**
 * Handles a request and returns the transformed response data.
 *
 * @param axios - The axios instance to use for the request
 * @param config - The request configuration
 * @param errorMessage - Optional error message to use when request fails
 * @param transformResponse - Optional function to transform the response data
 * @returns The transformed response data
 *
 * @example
 * ```typescript
 * const response = await handleRequest({
 *   axios,
 *   config,
 *   errorMessage: 'An error occurred while processing the request.',
 *   transformResponse: (data: T): R => data as any as R,
 * });
 * ```
 */
export async function handleRequest<T = any, R = T>({
    axios,
    config,
    errorMessage = 'An error occurred while processing the request.',
    transformResponse = (response: T): R => response as any as R,
}: RequestHandlerOptions<T, R>): Promise<R> {
    try {
        const response: AxiosResponse<T> = await axios.request(config)
        return transformResponse(response.data)
    } catch (error) {
        if (isAxiosError(error)) {
            const axiosError = error as AxiosError<Partial<FrappeError>>
            throw {
                ...axiosError.response?.data,
                httpStatus: axiosError.response?.status ?? 500,
                httpStatusText: axiosError.response?.statusText ?? 'Internal Server Error',
                message: axiosError.response?.data?.message ?? errorMessage,
                exception:
                    axiosError.response?.data?.exception ?? axiosError.response?.data?.exc_type ?? 'UnknownException',
                _server_messages: axiosError.response?.data?._server_messages ?? '',
            } as FrappeError
        }
        throw error
    }
}

export function getSiteName(appURL: string | undefined): string | undefined {
    if (!appURL) {
        return undefined
    }

    try {
        const url = new URL(appURL)
        return url.hostname
    } catch (error) {
        console.warn(`Invalid appURL provided: ${appURL}`, error)
        return undefined
    }
}
