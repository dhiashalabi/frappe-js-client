/**
 * @module auth/types
 * @description Type definitions for Frappe authentication operations.
 * These types define the structure of authentication requests and responses.
 *
 * @packageDocumentation
 */

/**
 * Union type for different authentication credential types.
 * Can be either username/password or OTP-based authentication.
 *
 * @example
 * ```typescript
 * // Username/password authentication
 * const credentials: AuthCredentials = {
 *   username: "john@example.com",
 *   password: "secret123",
 *   device: "mobile"
 * };
 *
 * // OTP authentication
 * const otpCredentials: AuthCredentials = {
 *   otp: "123456",
 *   tmp_id: "temp123",
 *   device: "mobile"
 * };
 * ```
 */
export type AuthCredentials = UserPassCredentials | OTPCredentials

/**
 * Response structure for authentication requests.
 *
 * @interface AuthResponse
 * @description Contains authentication result details including success messages,
 * user information, and any verification requirements.
 *
 * @example
 * ```typescript
 * const response: AuthResponse = {
 *   message: "Logged In",
 *   home_page: "/app",
 *   full_name: "John Doe"
 * };
 * ```
 */
export interface AuthResponse {
    /** Success or error message */
    message?: string
    /** URL of the home page after successful login */
    home_page?: string
    /** Full name of the authenticated user */
    full_name?: string
    /** Temporary ID for two-factor authentication */
    tmp_id?: string
    /** Verification details if additional authentication is required */
    verification?: {
        method: string
        message?: string
        status?: boolean
    }
    /** Type of exception if authentication fails */
    exc_type?: string
}

/**
 * Credentials for username/password authentication.
 *
 * @interface UserPassCredentials
 * @description Used for standard username and password authentication.
 *
 * @example
 * ```typescript
 * const credentials: UserPassCredentials = {
 *   username: "john@example.com",
 *   password: "secret123",
 *   device: "desktop"
 * };
 * ```
 */
export interface UserPassCredentials {
    /** User's email or username */
    username: string
    /** User's password */
    password: string
    /** Device type or identifier (optional) */
    device?: string
}

/**
 * Credentials for OTP-based authentication.
 *
 * @interface OTPCredentials
 * @description Used for two-factor or OTP-based authentication.
 *
 * @example
 * ```typescript
 * const credentials: OTPCredentials = {
 *   otp: "123456",
 *   tmp_id: "temp123",
 *   device: "mobile"
 * };
 * ```
 */
export interface OTPCredentials {
    /** One-time password */
    otp: string
    /** Temporary ID received from initial authentication request */
    tmp_id: string
    /** Device type or identifier (optional) */
    device?: string
}
