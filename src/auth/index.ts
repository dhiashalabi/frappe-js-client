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
 * const app = new FrappeApp('https://instance.example.com');
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
import { handleRequest } from '../utils/axios'

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
 *   'https://instance.example.com',
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
     *   'https://instance.example.com',
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
     * @throws {FrappeError} If authentication fails
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
    loginWithUsernamePassword<T extends AuthResponse = AuthResponse>(credentials: AuthCredentials): Promise<T> {
        return handleRequest<{ data: T }, T>({
            axios: this.axios,
            config: {
                method: 'POST',
                url: '/api/method/login',
                data: {
                    usr: (credentials as UserPassCredentials).username,
                    pwd: (credentials as UserPassCredentials).password,
                    otp: (credentials as OTPCredentials).otp,
                    tmp_id: (credentials as OTPCredentials).tmp_id,
                    device: credentials.device,
                },
            },
            errorMessage: 'There was an error while logging in',
            transformResponse: (response: { data: T }) => response.data,
        })
    }

    /**
     * Retrieves the currently logged-in user.
     *
     * @param method - The method to use to get the logged in user
     * @returns Promise resolving to the username of the logged-in user
     * @throws {FrappeError} If the request fails or no user is logged in
     *
     * @example
     * ```typescript
     * const username = await auth.getLoggedInUser();
     * console.log(`Logged in as: ${username}`);
     * ```
     */
    getLoggedInUser<T = any>(method?: string): Promise<T> {
        return handleRequest<{ message: T }, T>({
            axios: this.axios,
            config: {
                url: `/api/method/${method ?? 'frappe.auth.get_logged_user'}`,
            },
            errorMessage: 'There was an error while fetching the logged in user',
            transformResponse: (response: { message: T }) => response.message,
        })
    }

    /**
     * Logs out the current user.
     *
     * @returns Promise resolving when logout is successful
     * @throws {FrappeError} If logout fails
     *
     * @example
     * ```typescript
     * await auth.logout();
     * console.log('User logged out successfully');
     * ```
     */
    logout<T extends AuthResponse = AuthResponse>(): Promise<T> {
        return handleRequest<{ data: T }, T>({
            axios: this.axios,
            config: {
                method: 'POST',
                url: '/api/method/logout',
                data: {},
            },
            errorMessage: 'There was an error while logging out',
            transformResponse: (response: { data: T }) => response.data,
        })
    }

    /**
     * Initiates the password reset process for a user.
     *
     * @param user - Username or email of the user
     * @returns Promise resolving when the reset email is sent
     * @throws {FrappeError} If the password reset request fails
     *
     * @example
     * ```typescript
     * await auth.forgetPassword('user@example.com');
     * console.log('Password reset email sent');
     * ```
     */
    forgetPassword<T = any>(user: string): Promise<T> {
        return handleRequest<{ data: T }, T>({
            axios: this.axios,
            config: {
                method: 'POST',
                url: '/',
                data: {
                    cmd: 'frappe.core.doctype.user.user.reset_password',
                    user,
                },
            },
            errorMessage: 'There was an error while sending password reset email',
            transformResponse: (response: { data: T }) => response.data,
        })
    }
}
