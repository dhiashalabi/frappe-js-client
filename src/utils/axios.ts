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

import axios, { AxiosInstance, RawAxiosRequestHeaders } from 'axios'

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
 * const client = getAxiosClient('https://erp.example.com');
 *
 * // With Bearer token authentication
 * const authenticatedClient = getAxiosClient(
 *   'https://erp.example.com',
 *   true,
 *   () => localStorage.getItem('token'),
 *   'Bearer'
 * );
 *
 * // With custom headers
 * const clientWithHeaders = getAxiosClient(
 *   'https://erp.example.com',
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
        headers: getRequestHeaders(useToken, tokenType, token, appURL, customHeaders),
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
 *   'https://erp.example.com',
 *   { 'Custom-Header': 'value' }
 * );
 * ```
 *
 * @internal
 */
export function getRequestHeaders(
    useToken: boolean = false,
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

    // in case of browser environments
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        if (window.location) {
            if (appURL && appURL !== window.location.origin) {
                // Do not set X-Frappe-Site-Name
            } else {
                headers['X-Frappe-Site-Name'] = window.location.hostname
            }
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
