#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const budget = JSON.parse(readFileSync(resolve(root, 'test/bundle-budget.json'), 'utf8'))
const dist = resolve(root, 'packages/client/dist')
const files = readdirSync(dist).filter((name) => name.endsWith('.mjs') && !name.endsWith('.mjs.map'))
const bytes = files.reduce((total, name) => total + statSync(resolve(dist, name)).size, 0)

assert.ok(
    bytes <= budget.maximumEsmBytes,
    `ESM output is ${bytes} bytes; budget is ${budget.maximumEsmBytes} bytes (baseline ${budget.baselineEsmBytes})`,
)
console.log(`bundle-size: ${bytes}/${budget.maximumEsmBytes} ESM bytes`)
