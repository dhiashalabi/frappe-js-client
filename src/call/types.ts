/** Base response type for Frappe API calls */
export interface FrappeResponse {
    message: any
}

/**
 * Typed response for Frappe API calls
 * @template T - The type of the message data
 */
export interface TypedResponse<T> extends FrappeResponse {
    message: T
}

/**
 * Generic parameter type for API calls
 * @template K - Key type, must be string
 * @template V - Value type, must be string, number, boolean, or object
 */
export type ApiParams = Record<string, string | number | boolean | object>
