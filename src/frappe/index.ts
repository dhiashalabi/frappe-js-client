/**
 * @module frappe
 * @description Main entry point for the Frappe SDK. Provides the FrappeApp class
 * which serves as the primary interface for interacting with a Frappe instance.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { FrappeApp } from '@frappe/sdk';
 *
 * // Initialize without authentication
 * const app = new FrappeApp('https://example.com');
 *
 * // Initialize with token authentication
 * const authenticatedApp = new FrappeApp('https://example.com', {
 *   useToken: true,
 *   token: () => localStorage.getItem('token'),
 *   type: 'Bearer'
 * });
 * ```
 */

import { AxiosInstance } from 'axios'
import { FrappeAuth } from '../auth'
import { FrappeCall } from '../call'
import { FrappeDB } from '../db'
import { FrappeFileUpload } from '../file'
import { getAxiosClient } from '../utils/axios'
import { TokenParams } from './types'
import { FrappeClient } from '../client'

/**
 * Main class for interacting with a Frappe instance.
 *
 * @class FrappeApp
 * @description Provides a unified interface for all Frappe operations including
 * authentication, database operations, file uploads, and API calls.
 *
 * @example
 * ```typescript
 * const app = new FrappeApp('https://erp.example.com');
 *
 * // Authenticate
 * await app.auth().login('username', 'password');
 *
 * // Database operations
 * const doc = await app.db().getDoc('User', 'administrator');
 *
 * // File operations
 * await app.file().upload({
 *   file: fileBlob,
 *   filename: 'document.pdf'
 * });
 *
 * // API calls
 * const result = await app.call().get('api/method/ping');
 * ```
 */
export class FrappeApp {
    /** URL of the Frappe instance */
    readonly url: string

    /** Name of the Frappe App instance */
    readonly name: string

    /** Axios instance */
    readonly axios: AxiosInstance

    /** Whether to use token based auth */
    readonly useToken: boolean

    /** Function that returns the token to be used for authentication */
    readonly token?: () => string

    /** Type of token to be used for authentication */
    readonly tokenType?: 'Bearer' | 'token'

    /** Custom Headers to be passed in each request */
    readonly customHeaders?: object

    /**
     * Creates a new FrappeApp instance.
     *
     * @param url - The base URL of the Frappe instance
     * @param tokenParams - Optional configuration for token-based authentication
     * @param name - Optional name for the app instance
     * @param customHeaders - Optional custom headers to include in all requests
     *
     * @example
     * ```typescript
     * // Basic initialization
     * const app = new FrappeApp('https://erp.example.com');
     *
     * // With token auth and custom headers
     * const app = new FrappeApp(
     *   'https://erp.example.com',
     *   {
     *     useToken: true,
     *     token: () => localStorage.getItem('token'),
     *     type: 'Bearer'
     *   },
     *   'MyApp',
     *   { 'Custom-Header': 'value' }
     * );
     * ```
     */
    constructor(url: string, tokenParams?: TokenParams, name?: string, customHeaders?: object) {
        this.url = url
        this.name = name ?? 'FrappeApp'
        this.useToken = tokenParams?.useToken ?? false
        this.token = tokenParams?.token
        this.tokenType = tokenParams?.type ?? 'Bearer'
        this.customHeaders = customHeaders
        this.axios = getAxiosClient(this.url, this.useToken, this.token, this.tokenType, this.customHeaders)
    }

    /**
     * Returns a FrappeAuth object for authentication operations.
     *
     * @returns {FrappeAuth} An instance of FrappeAuth for handling authentication
     *
     * @example
     * ```typescript
     * const auth = app.auth();
     * await auth.login('username', 'password');
     * ```
     */
    auth(): FrappeAuth {
        return new FrappeAuth(this.url, this.axios, this.useToken, this.token, this.tokenType)
    }

    /**
     * Returns a FrappeDB object for database operations.
     *
     * @returns {FrappeDB} An instance of FrappeDB for handling database operations
     *
     * @example
     * ```typescript
     * const db = app.db();
     * const user = await db.getDoc('User', 'administrator');
     * ```
     */
    db(): FrappeDB {
        return new FrappeDB(this.url, this.axios, this.useToken, this.token, this.tokenType)
    }

    /**
     * Returns a FrappeFileUpload object for file operations.
     *
     * @returns {FrappeFileUpload} An instance of FrappeFileUpload for handling file operations
     *
     * @example
     * ```typescript
     * const fileUpload = app.file();
     * await fileUpload.upload({
     *   file: fileBlob,
     *   filename: 'document.pdf'
     * });
     * ```
     */
    file(): FrappeFileUpload {
        return new FrappeFileUpload(this.url, this.axios, this.useToken, this.token, this.tokenType, this.customHeaders)
    }

    /**
     * Returns a FrappeCall object for making API calls.
     *
     * @returns {FrappeCall} An instance of FrappeCall for making API calls
     *
     * @example
     * ```typescript
     * const call = app.call();
     * const response = await call.get('api/method/frappe.ping');
     * ```
     */
    call(): FrappeCall {
        return new FrappeCall(this.url, this.axios, this.useToken, this.token, this.tokenType)
    }

    /**
     * Returns a FrappeClient object for client operations.
     *
     * @returns {FrappeClient} An instance of FrappeClient for handling client operations
     *
     * @example
     * ```typescript
     * const client = app.client();
     * const response = await client.get('api/method/frappe.ping');
     * ```
     */
    client(): FrappeClient {
        return new FrappeClient(this.url, this.axios, this.useToken, this.token, this.tokenType)
    }
}
