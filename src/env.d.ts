/**
 * @module env
 * @description TypeScript declaration file that extends the global Window interface
 * to include Frappe-specific properties. This module provides type safety for
 * global variables used across the application.
 *
 * @remarks
 * The csrf_token is used for Cross-Site Request Forgery protection in API requests.
 * It's automatically included in request headers by the axios utility module.
 */

declare global {
    interface Window {
        csrf_token?: string
    }
}

export {}
