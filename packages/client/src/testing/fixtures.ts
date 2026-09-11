/**
 * @module testing/fixtures
 * @description Sample Frappe response shapes for use with `MemoryTransport` in consumer tests.
 */

import type { FrappeDoc } from '../core/types'

export const fixtureUser: FrappeDoc<{ email: string; first_name: string; user_type: string }> = {
    doctype: 'User',
    name: 'test.user@example.com',
    email: 'test.user@example.com',
    first_name: 'Test',
    user_type: 'System User',
    owner: 'Administrator',
    creation: '2024-01-01 00:00:00.000000',
    modified: '2024-01-01 00:00:00.000000',
    modified_by: 'Administrator',
    idx: 0,
    docstatus: 0,
}

export const fixtureValidationErrorBody = {
    exception: 'frappe.exceptions.ValidationError: Field is required',
    exc_type: 'ValidationError',
    _server_messages: JSON.stringify([
        JSON.stringify({ message: 'Field is required', title: 'Validation Error', indicator: 'red' }),
    ]),
}

export const fixturePermissionErrorBody = {
    exception: 'frappe.exceptions.PermissionError: Not permitted',
    exc_type: 'PermissionError',
}
