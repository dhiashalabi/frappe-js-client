/**
 * @module env
 * @description Ambient `Window.csrf_token` used by `cookieAuth()` in the browser. Frappe's desk
 * UI sets this global; the client copies it into the `X-Frappe-CSRF-Token` header.
 */

declare global {
    interface Window {
        csrf_token?: string
    }
}

export {}
