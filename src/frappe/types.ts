/**
 * @module frappe/types
 * @description Core type definitions for Frappe API responses and configuration options.
 * These types are used throughout the SDK to ensure type safety and provide better
 * developer experience.
 *
 * @packageDocumentation
 */

/**
 * Represents a Frappe API error response.
 *
 * @interface Error
 * @description Standardized error structure returned by Frappe backend services.
 * Contains both HTTP-level and application-level error details.
 *
 * @example
 * ```typescript
 * try {
 *   // API call
 * } catch (err) {
 *   const frappeError = err as Error;
 *   console.error(`${frappeError.httpStatus}: ${frappeError.message}`);
 * }
 * ```
 */
export interface FrappeError {
    /** HTTP status code of the error response */
    httpStatus: number
    /** HTTP status text corresponding to the status code */
    httpStatusText: string
    /** Human-readable error message */
    message: string
    /** Exception identifier or name */
    exception: string
    /** Raw exception details (if available) */
    exc?: string
    /** Type of the exception that occurred */
    exc_type?: string
    /** Server-side messages in JSON string format */
    _server_messages?: string
}

/**
 * Configuration options for token-based authentication.
 *
 * @interface TokenParams
 * @description Defines the structure for configuring token-based authentication
 * in the Frappe SDK. This is used when initializing the FrappeApp instance.
 *
 * @example
 * ```typescript
 * const tokenParams: TokenParams = {
 *   useToken: true,
 *   token: () => localStorage.getItem('auth_token'),
 *   type: 'Bearer'
 * };
 *
 * const app = new FrappeApp('https://example.com', tokenParams);
 * ```
 */
export interface TokenParams {
    /** Whether to use token for API calls */
    useToken: boolean
    /** Function that returns the token as a string - this could be fetched from LocalStorage or auth providers like Firebase, Auth0 etc. */
    token?: () => string
    /** Type of token to be used for authentication */
    type: 'Bearer' | 'token'
}

/**
 * Represents a Frappe document.
 *
 * @interface Document
 * @description Standardized document structure returned by Frappe backend services.
 * Contains all fields of the document.
 */
export type FrappeDocument<T = any> = T & {
    /** The document type of the document */
    doctype?: string
    /** The name of the document */
    name?: string
    /** The owner of the document */
    owner?: string
    /** The creation date of the document */
    creation?: string
    /** The modified date of the document */
    modified?: string
    /** The modified by of the document */
    modified_by?: string
    /** The document status of the document */
    docstatus?: number
    /** The fields of the document */
    [key: string]: any
}
