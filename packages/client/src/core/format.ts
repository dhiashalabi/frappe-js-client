/**
 * @module core/format
 * @description Frappe's wire format for dates is a fixed string shape (`YYYY-MM-DD` /
 * `YYYY-MM-DD HH:mm:ss`), always in the site's local time, never an ISO instant with a `Z`
 * suffix or offset. Passing a `Date` object directly through `JSON.stringify` produces a UTC
 * ISO string, which is not what Frappe expects — callers must format explicitly with these
 * helpers instead of relying on filter/value types accepting `Date`.
 */

function pad(value: number, length = 2): string {
    return String(value).padStart(length, '0')
}

/** `YYYY-MM-DD`, in local time. */
export function formatFrappeDate(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** `YYYY-MM-DD HH:mm:ss`, in local time. */
export function formatFrappeDatetime(date: Date): string {
    return `${formatFrappeDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
