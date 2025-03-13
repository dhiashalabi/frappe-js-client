/**
 * @module auth
 * @description Provides authentication functionality for Frappe.
 * This module handles user authentication, session management,
 * and password reset operations.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { FrappeApp } from '@frappe/sdk';
 *
 * const app = new FrappeApp('https://erp.example.com');
 * const auth = app.auth();
 *
 * await auth.loginWithUsernamePassword({
 *   username: 'admin',
 *   password: 'admin'
 * });
 *
 * const user = await auth.getLoggedInUser();
 * ```
 */

import { AxiosInstance } from 'axios'

import { AuthCredentials, AuthResponse, OTPCredentials, UserPassCredentials } from './types'
import { Error } from '../frappe/types'

/**
 * Handles authentication operations for Frappe.
 *
 * @class FrappeAuth
 * @description Provides methods for user authentication, session management,
 * and password reset functionality.
 *
 * @example
 * ```typescript
 * const auth = new FrappeAuth(
 *   'https://erp.example.com',
 *   axiosInstance,
 *   true,
 *   () => localStorage.getItem('token'),
 *   'Bearer'
 * );
 *
 * // Login
 * await auth.loginWithUsernamePassword({
 *   username: 'admin',
 *   password: 'admin'
 * });
 * ```
 */
export class FrappeAuth {
    /** URL of the Frappe App instance */
    // @ts-expect-error - This is a private property that is not used in the class
    private readonly appURL: string

    /** Axios instance for making HTTP requests */
    readonly axios: AxiosInstance

    /** Whether to use token based authentication */
    readonly useToken: boolean

    /** Function that returns the authentication token */
    readonly token?: () => string

    /** Type of token to be used for authentication */
    readonly tokenType?: 'Bearer' | 'token'

    /**
     * Creates a new FrappeAuth instance.
     *
     * @param appURL - Base URL of the Frappe instance
     * @param axios - Configured Axios instance for making requests
     * @param useToken - Whether to use token-based authentication
     * @param token - Function that returns the authentication token
     * @param tokenType - Type of token to use ('Bearer' or 'token')
     *
     * @example
     * ```typescript
     * const auth = new FrappeAuth(
     *   'https://erp.example.com',
     *   axiosInstance,
     *   true,
     *   () => localStorage.getItem('token'),
     *   'Bearer'
     * );
     * ```
     */
    constructor(
        appURL: string,
        axios: AxiosInstance,
        useToken?: boolean,
        token?: () => string,
        tokenType?: 'Bearer' | 'token',
    ) {
        this.appURL = appURL
        this.axios = axios
        this.useToken = useToken ?? false
        this.token = token
        this.tokenType = tokenType
    }

    /**
     * Authenticates a user using username/password or OTP.
     *
     * @param credentials - Authentication credentials (username/password or OTP)
     * @returns Promise resolving to the authentication response
     * @throws {Error} If authentication fails
     *
     * @example
     * ```typescript
     * // Login with username/password
     * const response = await auth.loginWithUsernamePassword({
     *   username: 'admin',
     *   password: 'admin',
     *   device: 'desktop'
     * });
     *
     * // Login with OTP
     * const otpResponse = await auth.loginWithUsernamePassword({
     *   otp: '123456',
     *   tmp_id: 'temp123',
     *   device: 'mobile'
     * });
     * ```
     */
    async loginWithUsernamePassword(credentials: AuthCredentials): Promise<AuthResponse> {
        return this.axios
            .post('/api/method/login', {
                usr: (credentials as UserPassCredentials).username,
                pwd: (credentials as UserPassCredentials).password,
                otp: (credentials as OTPCredentials).otp,
                tmp_id: (credentials as OTPCredentials).tmp_id,
                device: credentials.device,
            })
            .then((res) => res.data as AuthResponse)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: error.response.data.message ?? 'There was an error while logging in',
                    exception: error.response.data.exception ?? '',
                } as Error
            })
    }

    /**
     * Retrieves the currently logged-in user.
     *
     * @param method - The method to use to get the logged in user
     * @param withCredentials - Whether to include credentials in the request
     * @returns Promise resolving to the username of the logged-in user
     * @throws {Error} If the request fails or no user is logged in
     *
     * @example
     * ```typescript
     * const username = await auth.getLoggedInUser();
     * console.log(`Logged in as: ${username}`);
     * ```
     */
    async getLoggedInUser(method: 'frappe.auth.get_logged_user', withCredentials?: boolean): Promise<string> {
        return this.axios
            .get(`/api/method/${method}`, {
                withCredentials: withCredentials ?? false,
            })
            .then((res) => res.data.message)
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: 'There was an error while fetching the logged in user',
                    exception: error.response.data.exception ?? '',
                } as Error
            })
    }

    /**
     * Logs out the current user.
     *
     * @returns Promise resolving when logout is successful
     * @throws {Error} If logout fails
     *
     * @example
     * ```typescript
     * await auth.logout();
     * console.log('User logged out successfully');
     * ```
     */
    async logout(): Promise<void> {
        return this.axios
            .post('/api/method/logout', {})
            .then(() => {
                return
            })
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: error.response.data.message ?? 'There was an error while logging out',
                    exception: error.response.data.exception ?? '',
                } as Error
            })
    }

    /**
     * Initiates the password reset process for a user.
     *
     * @param user - Username or email of the user
     * @returns Promise resolving when the reset email is sent
     * @throws {Error} If the password reset request fails
     *
     * @example
     * ```typescript
     * await auth.forgetPassword('user@example.com');
     * console.log('Password reset email sent');
     * ```
     */
    async forgetPassword(user: string): Promise<void> {
        return this.axios
            .post('/', {
                cmd: 'frappe.core.doctype.user.user.reset_password',
                user,
            })
            .then(() => {
                return
            })
            .catch((error) => {
                throw {
                    ...error.response.data,
                    httpStatus: error.response.status,
                    httpStatusText: error.response.statusText,
                    message: error.response.data.message ?? 'There was an error sending password reset email.',
                    exception: error.response.data.exception ?? '',
                } as Error
            })
    }
}
