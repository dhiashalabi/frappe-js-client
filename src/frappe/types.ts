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
 * Base interface for all Frappe documents.
 *
 * @interface FrappeDoc
 * @template T - Additional fields specific to the document type
 *
 * @example
 * ```typescript
 * interface User extends FrappeDoc<{
 *   first_name: string;
 *   email: string;
 * }> {}
 *
 * const user: User = {
 *   name: "USER001",
 *   first_name: "John",
 *   email: "john@example.com",
 *   owner: "Administrator",
 *   creation: "2024-03-10T12:00:00",
 *   modified: "2024-03-10T12:00:00",
 *   modified_by: "Administrator",
 *   idx: 1,
 *   docstatus: 0
 * };
 * ```
 */
export type FrappeDoc<T> = T & {
    /** The document type of the document */
    doctype: string
    /** User who created the document */
    owner: string
    /** Date and time when the document was created - ISO format */
    creation: string
    /** Date and time when the document was last modified - ISO format */
    modified: string
    /** User who last modified the document */
    modified_by: string
    /** Index of the document in its list */
    idx: number
    /** Document status: 0 - Saved, 1 - Submitted, 2 - Cancelled */
    docstatus: 0 | 1 | 2
    /** Parent document name for child tables */
    parent?: string
    /** Parent field name for child tables */
    parentfield?: string
    /** Parent document type for child tables */
    parenttype?: string
    /** The primary key of the DocType table */
    name: string
    /** The fields of the document */
    [key: string]: any
}
