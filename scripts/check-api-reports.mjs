import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const binary = join(root, 'packages/client/node_modules/.bin/api-extractor')
const client = ['api-extractor.json', ...['extended', 'errors', 'middleware', 'types', 'testing', 'realtime'].map((name) => `api-extractor.${name}.json`)]
const configs = client.map((name) => join(root, 'packages/client', name))
if (!process.argv.includes('--client-only')) configs.push(join(root, 'packages/codegen/api-extractor.json'))
for (const config of configs) {
    const args = ['run', '--config', config, ...(process.argv.includes('--local') ? ['--local'] : [])]
    const result = spawnSync(binary, args, { cwd: root, stdio: 'inherit' })
    if (result.status !== 0) process.exit(result.status ?? 1)
}
