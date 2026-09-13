import { createReadStream, existsSync } from 'node:fs'
import { createServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const distEntry = join(root, 'packages/client/dist/index.mjs')
const live = process.env.BROWSER_LIVE === '1'
if (live && !process.env.FRAPPE_TEST_URL) {
    throw new Error('Live browser tests require FRAPPE_TEST_URL.')
}
const target = new URL(process.env.FRAPPE_TEST_URL ?? 'http://127.0.0.1:8000')
const port = Number(process.env.BROWSER_TEST_PORT ?? 4173)
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.map': 'application/json' }

if (!existsSync(distEntry)) {
    console.error(`browser tests need a built client at ${distEntry}. Run pnpm build first.`)
    process.exit(1)
}

const siteName = process.env.FRAPPE_TEST_SITE_NAME || (isLoopbackHost(target.hostname) ? undefined : target.hostname)

const config = {
    siteName: siteName ?? null,
    apiVersion: 2,
    frappeVersion: 16,
    username: process.env.FRAPPE_TEST_ADMIN_USER ?? 'Administrator',
    password: process.env.FRAPPE_TEST_ADMIN_PASSWORD ?? 'admin',
}

const hopByHop = new Set([
    'connection',
    'keep-alive',
    'proxy-connection',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
])

function isLoopbackHost(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function connectHostname() {
    if (target.hostname === 'localhost' || target.hostname.endsWith('.localhost')) {
        return '127.0.0.1'
    }
    return target.hostname
}

function pathnameOf(req) {
    return new URL(req.url ?? '/', `http://127.0.0.1:${port}`).pathname
}

function copyHeaders(source, extra = {}) {
    const headers = {}
    for (const [name, value] of Object.entries(source)) {
        if (value === undefined || hopByHop.has(name.toLowerCase())) continue
        headers[name] = value
    }
    return { ...headers, ...extra }
}

function sendFile(res, filePath, contentType) {
    const stream = createReadStream(filePath)
    stream.on('open', () => {
        res.writeHead(200, { 'content-type': contentType })
        stream.pipe(res)
    })
    stream.on('error', () => {
        if (!res.headersSent) {
            res.writeHead(404).end()
            return
        }
        res.destroy()
    })
}

function proxy(req, res) {
    const send = target.protocol === 'https:' ? httpsRequest : httpRequest
    const headers = copyHeaders(req.headers, {
        host: target.host,
        ...(siteName ? { 'x-frappe-site-name': siteName } : {}),
    })
    const upstream = send(
        {
            protocol: target.protocol,
            hostname: connectHostname(),
            port: target.port || (target.protocol === 'https:' ? 443 : 80),
            path: req.url,
            method: req.method,
            headers,
        },
        (response) => {
            res.writeHead(response.statusCode ?? 502, copyHeaders(response.headers))
            response.pipe(res)
        },
    )
    req.pipe(upstream)
    upstream.on('error', (error) => {
        if (!res.headersSent) {
            res.writeHead(502, { 'content-type': 'text/plain' })
        }
        res.end(error.message)
    })
}

function probe(path) {
    return new Promise((resolve) => {
        const send = target.protocol === 'https:' ? httpsRequest : httpRequest
        const req = send(
            {
                protocol: target.protocol,
                hostname: connectHostname(),
                port: target.port || (target.protocol === 'https:' ? 443 : 80),
                path,
                method: 'GET',
                headers: {
                    host: target.host,
                    ...(siteName ? { 'x-frappe-site-name': siteName } : {}),
                    accept: 'application/json',
                },
            },
            (response) => {
                response.resume()
                resolve(response.statusCode ?? 0)
            },
        )
        req.setTimeout(2000, () => req.destroy())
        req.on('error', () => resolve(0))
        req.end()
    })
}

function parseVersion(raw, allowed) {
    if (raw === undefined || raw === '') return undefined
    const value = Number(raw)
    return allowed.includes(value) ? value : undefined
}

async function resolveApi() {
    const fromEnv = parseVersion(process.env.FRAPPE_TEST_API_VERSION, [1, 2])
    if (fromEnv) return fromEnv
    const status = await probe('/api/v2/method/ping')
    if (status === 404 || status === 0) return 1
    return 2
}

const apiVersion = live ? await resolveApi() : 2
if (live && (await probe('/api/method/ping')) === 0) {
    throw new Error(`Live Frappe backend at ${target.origin} is unavailable.`)
}
const frappeVersion = live
    ? (parseVersion(process.env.FRAPPE_TEST_FRAPPE_VERSION, [14, 15, 16]) ?? (apiVersion === 1 ? 14 : 16))
    : 16
config.apiVersion = apiVersion
config.frappeVersion = frappeVersion

createServer((req, res) => {
    const pathname = pathnameOf(req)
    if (pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html' })
        res.end('<!doctype html><script type="module" src="/fixture.mjs"></script>')
        return
    }
    if (pathname === '/browser-test-config.json') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(config))
        return
    }
    if (pathname === '/fixture.mjs') {
        sendFile(res, join(root, 'test/browser/fixture.mjs'), 'text/javascript')
        return
    }
    if (pathname.startsWith('/dist/')) {
        const relative = normalize(pathname.slice(1))
        if (!relative.startsWith('dist/')) {
            res.writeHead(400).end()
            return
        }
        sendFile(res, join(root, 'packages/client', relative), types[extname(relative)] ?? 'application/octet-stream')
        return
    }
    if (pathname === '/api/method/browser_test.delay' || pathname === '/api/v2/method/browser_test.delay') {
        setTimeout(() => {
            res.writeHead(200, { 'content-type': 'application/json' })
            res.end(pathname.includes('/api/v2/') ? '{"data":"late"}' : '{"message":"late"}')
        }, 5_000)
        return
    }
    if (
        pathname === '/api/method/browser_test.binary_error' ||
        pathname === '/api/v2/method/browser_test.binary_error'
    ) {
        res.writeHead(422, { 'content-type': 'application/octet-stream' })
        res.end(
            Buffer.from(
                pathname.includes('/api/v2/')
                    ? '{"errors":[{"type":"ValidationError","message":"binary failure"}]}'
                    : '{"exc_type":"ValidationError","message":"binary failure"}',
            ),
        )
        return
    }
    if (!live) {
        const json = (status, body, headers = {}) => {
            res.writeHead(status, { 'content-type': 'application/json', ...headers })
            res.end(JSON.stringify(body))
        }
        if (pathname === '/api/method/login' && req.method === 'POST') {
            json(
                200,
                { message: 'Logged In', full_name: 'Administrator' },
                { 'set-cookie': 'sid=browser-fixture; HttpOnly; Path=/' },
            )
            return
        }
        if (pathname === '/api/v2/method/frappe.auth.get_logged_user') {
            json(200, { data: req.headers.cookie?.includes('sid=browser-fixture') ? 'Administrator' : 'Guest' })
            return
        }
        if (pathname === '/app') {
            res.writeHead(200, { 'content-type': 'text/html' })
            res.end('<html><meta name="csrf_token" content="browser-csrf-token"></html>')
            return
        }
        if (pathname === '/api/method/upload_file' && req.method === 'POST') {
            if (
                !req.headers.cookie?.includes('sid=browser-fixture') ||
                req.headers['x-frappe-csrf-token'] !== 'browser-csrf-token'
            ) {
                json(403, { exc_type: 'PermissionError', message: 'Missing browser session or CSRF token' })
                return
            }
            req.resume()
            req.on('end', () =>
                json(200, { message: { name: 'FILE-1', file_url: '/private/files/browser-integration.txt' } }),
            )
            return
        }
        if (pathname === '/api/method/download_file') {
            res.writeHead(200, { 'content-type': 'application/octet-stream' })
            res.end('browser integration')
            return
        }
        if (pathname === '/api/v2/document/File/FILE-1' && req.method === 'DELETE') {
            json(200, {})
            return
        }
        json(404, { exc_type: 'DoesNotExistError', message: `No browser fixture for ${req.method} ${pathname}` })
        return
    }
    proxy(req, res)
}).listen(port, '127.0.0.1', () => {
    console.log(
        `browser fixture listening at http://127.0.0.1:${port} (mode=${live ? 'live' : 'local'} api=${apiVersion} frappe=${frappeVersion})`,
    )
})
