import { cookieAuth, createFrappeClient } from '/dist/index.mjs'

const config = await fetch('/browser-test-config.json').then(async (res) => {
    if (!res.ok) throw new Error(`browser test config failed: ${res.status}`)
    return res.json()
})

const auth = cookieAuth()
const client = createFrappeClient({
    url: window.location.origin,
    apiVersion: config.apiVersion,
    frappeVersion: config.frappeVersion,
    ...(config.siteName ? { siteName: config.siteName } : {}),
    auth,
})

function usableToken(value) {
    return value && value !== '{{ csrf_token }}' ? value : undefined
}

function csrfFromCookie() {
    const match = document.cookie?.match(/(?:^|;\s*)csrf_token=([^;]*)/)
    if (!match) return undefined
    try {
        return usableToken(decodeURIComponent(match[1]))
    } catch {
        return usableToken(match[1])
    }
}

function csrfFromHtml(html) {
    const patterns = [
        /frappe\.csrf_token\s*=\s*"([^"]+)"/,
        /frappe\.csrf_token\s*=\s*'([^']+)'/,
        /["']csrf_token["']\s*:\s*"([^"]+)"/,
        /["']csrf_token["']\s*:\s*'([^']+)'/,
        /<meta[^>]+name=["']csrf[_-]token["'][^>]+content=["']([^"]+)["']/i,
        /<meta[^>]+content=["']([^"]+)["'][^>]+name=["']csrf[_-]token["']/i,
    ]
    for (const pattern of patterns) {
        const match = html.match(pattern)
        const token = usableToken(match?.[1])
        if (token) return token
    }
    return undefined
}

function looksLoggedOut(html) {
    return /\/login\?redirect-to=|id=["']login_email["']|class=["'][^"']*login-content/.test(html)
}

async function captureCsrf() {
    const fromCookie = csrfFromCookie()
    if (fromCookie) {
        window.csrf_token = fromCookie
        return
    }

    let lastHtml = ''
    for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 250 * attempt))
        }
        const desk = await fetch('/app', { credentials: 'include', redirect: 'follow' })
        lastHtml = await desk.text()
        if (looksLoggedOut(lastHtml)) continue
        const token = csrfFromHtml(lastHtml)
        if (token) {
            window.csrf_token = token
            return
        }
    }

    const fallback = csrfFromHtml(lastHtml)
    if (fallback) {
        window.csrf_token = fallback
        return
    }
    throw new Error('Frappe desk did not expose the authenticated CSRF token')
}

window.frappeBrowserTest = {
    async login() {
        await client.auth.login({ username: config.username, password: config.password })
        return client.auth.getLoggedUser()
    },
    async cancel() {
        const controller = new AbortController()
        const pending = client.call.get('browser_test.delay', undefined, { signal: controller.signal })
        controller.abort()
        try {
            await pending
            return 'resolved'
        } catch (error) {
            return error.name
        }
    },
    async binaryError() {
        try {
            await client.call.get('browser_test.binary_error')
            return null
        } catch (error) {
            return `${error.name}: ${error.message}`
        }
    },
    async upload() {
        await captureCsrf()
        const progress = []
        let uploaded
        try {
            uploaded = await client.file.upload(
                new Blob(['browser integration']),
                { isPrivate: true },
                { filename: `frappe-js-client-${Date.now()}.txt`, onProgress: (event) => progress.push(event.loaded) },
            )
            const downloaded = await client.file.download(uploaded.file_url)
            return { progress, content: await downloaded.text() }
        } finally {
            if (uploaded?.name) {
                await client.db.deleteDoc('File', uploaded.name).catch(() => {})
            }
        }
    },
}
