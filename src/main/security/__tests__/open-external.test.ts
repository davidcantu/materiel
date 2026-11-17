import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluateExternalUrl, isAllowedExternalUrl, safeOpenExternal } from '../open-external'

test('allows mailto and Materiel GitHub https paths', () => {
  assert.equal(isAllowedExternalUrl('mailto:friend@example.com?subject=Hi'), true)
  assert.equal(isAllowedExternalUrl('https://github.com/davidcantu/materiel'), true)
  assert.equal(isAllowedExternalUrl('https://github.com/davidcantu/materiel/releases'), true)
  assert.equal(
    isAllowedExternalUrl('https://github.com/davidcantu/materiel/releases/tag/v0.2.3'),
    true
  )
})

test('allows Google and Microsoft OAuth authorize hosts', () => {
  assert.equal(
    isAllowedExternalUrl('https://accounts.google.com/o/oauth2/v2/auth?client_id=x'),
    true
  )
  assert.equal(
    isAllowedExternalUrl(
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=x'
    ),
    true
  )
})

test('denies other schemes, hosts, and GitHub repos', () => {
  assert.equal(isAllowedExternalUrl('http://github.com/davidcantu/materiel'), false)
  assert.equal(isAllowedExternalUrl('file:///etc/passwd'), false)
  assert.equal(isAllowedExternalUrl('https://evil.example/phish'), false)
  assert.equal(isAllowedExternalUrl('https://github.com/evil/materiel'), false)
  assert.equal(isAllowedExternalUrl('https://github.com/davidcantu/other'), false)
  assert.equal(isAllowedExternalUrl('not-a-url'), false)
})

test('safeOpenExternal opens allowlisted URLs and rejects others', async () => {
  const opened: string[] = []
  await safeOpenExternal('https://github.com/davidcantu/materiel/releases', async (url) => {
    opened.push(url)
  })
  assert.deepEqual(opened, ['https://github.com/davidcantu/materiel/releases'])

  await assert.rejects(
    () => safeOpenExternal('https://evil.example/', async () => undefined),
    /allowlist/
  )
  assert.equal(evaluateExternalUrl('').ok, false)
})
