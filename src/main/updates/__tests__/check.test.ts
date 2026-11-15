import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkForUpdate, evaluateLatestRelease } from '../check'

test('evaluateLatestRelease reports available when tag is newer', () => {
  const result = evaluateLatestRelease('0.1.0', {
    tag_name: 'v0.2.0',
    html_url: 'https://github.com/davidcantu/materiel/releases/tag/v0.2.0',
    name: 'Materiel 0.2.0'
  })
  assert.equal(result.status, 'available')
  if (result.status === 'available') {
    assert.equal(result.latestVersion, '0.2.0')
    assert.equal(result.currentVersion, '0.1.0')
    assert.equal(result.releaseUrl, 'https://github.com/davidcantu/materiel/releases/tag/v0.2.0')
    assert.equal(result.releaseName, 'Materiel 0.2.0')
  }
})

test('evaluateLatestRelease reports up-to-date for same or older tag', () => {
  assert.equal(
    evaluateLatestRelease('0.2.0', { tag_name: 'v0.2.0', html_url: 'https://example.com' }).status,
    'up-to-date'
  )
  assert.equal(
    evaluateLatestRelease('0.3.0', { tag_name: 'v0.2.0', html_url: 'https://example.com' }).status,
    'up-to-date'
  )
})

test('evaluateLatestRelease skips draft / invalid payloads', () => {
  assert.equal(
    evaluateLatestRelease('0.1.0', { tag_name: 'v0.2.0', draft: true }).status,
    'skipped'
  )
  assert.equal(evaluateLatestRelease('0.1.0', null).status, 'skipped')
  assert.equal(evaluateLatestRelease('0.1.0', { html_url: 'x' }).status, 'skipped')
})

test('checkForUpdate soft-fails on network errors', async () => {
  const result = await checkForUpdate('0.1.0', {
    fetchImpl: async () => {
      throw new TypeError('fetch failed')
    }
  })
  assert.equal(result.status, 'skipped')
  if (result.status === 'skipped') {
    assert.equal(result.reason, 'offline')
  }
})

test('checkForUpdate soft-fails on 404 (no releases yet)', async () => {
  const result = await checkForUpdate('0.1.0', {
    fetchImpl: async () => new Response(null, { status: 404, statusText: 'Not Found' }) as Response
  })
  assert.equal(result.status, 'skipped')
  if (result.status === 'skipped') {
    assert.equal(result.reason, 'no-release')
  }
})

test('checkForUpdate returns available from a successful API body', async () => {
  const result = await checkForUpdate('0.1.0', {
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          tag_name: 'v0.9.0',
          html_url: 'https://github.com/davidcantu/materiel/releases/tag/v0.9.0',
          name: '0.9.0'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      ) as Response
  })
  assert.equal(result.status, 'available')
  if (result.status === 'available') {
    assert.equal(result.latestVersion, '0.9.0')
  }
})
