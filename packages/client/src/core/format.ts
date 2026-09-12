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

function zonedParts(date: Date, timeZone: string): Record<string, string> {
    return Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        })
            .formatToParts(date)
            .filter((part) => part.type !== 'literal')
            .map((part) => [part.type, part.value]),
    )
}

/** `YYYY-MM-DD`, in local time or in the supplied Frappe site timezone. */
export function formatFrappeDate(date: Date, timeZone?: string): string {
    if (timeZone) {
        const parts = zonedParts(date, timeZone)
        return `${parts.year}-${parts.month}-${parts.day}`
    }
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** `YYYY-MM-DD HH:mm:ss`, in local time or in the supplied Frappe site timezone. */
export function formatFrappeDatetime(date: Date, timeZone?: string): string {
    if (timeZone) {
        const parts = zonedParts(date, timeZone)
        return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
    }
    return `${formatFrappeDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
