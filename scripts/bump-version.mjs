#!/usr/bin/env node
/**
 * Bump package.json + lockfile root version + install.md examples only.
 * Never rewrite transitive dependency versions (e.g. tmp@0.2.7).
 *
 * Usage: node scripts/bump-version.mjs 0.2.9
 */
import { readFileSync, writeFileSync } from 'node:fs'

const next = process.argv[2]
if (!next || !/^\d+\.\d+\.\d+$/.test(next)) {
  console.error('Usage: node scripts/bump-version.mjs <semver>')
  process.exit(1)
}

function bumpPackageJson(path) {
  const pkg = JSON.parse(readFileSync(path, 'utf8'))
  const prev = pkg.version
  pkg.version = next
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`)
  return prev
}

function bumpLockfile(path, prev) {
  const lock = JSON.parse(readFileSync(path, 'utf8'))
  if (lock.version !== prev) {
    throw new Error(`lockfile version ${lock.version} != package.json ${prev}`)
  }
  lock.version = next
  if (lock.packages?.['']) {
    if (lock.packages[''].version !== prev) {
      throw new Error(`lock packages[""].version mismatch`)
    }
    lock.packages[''].version = next
  }
  writeFileSync(path, `${JSON.stringify(lock, null, 2)}\n`)
}

function bumpInstallDocs(path, prev) {
  let text = readFileSync(path, 'utf8')
  const needle = prev.replace(/\./g, '\\.')
  const re = new RegExp(needle, 'g')
  const updated = text.replace(re, next)
  if (updated === text) {
    console.warn(`warn: no ${prev} examples found in ${path}`)
  }
  writeFileSync(path, updated)
}

const prev = bumpPackageJson('package.json')
bumpLockfile('package-lock.json', prev)
bumpInstallDocs('docs/install.md', prev)
console.log(`bumped ${prev} -> ${next}`)
