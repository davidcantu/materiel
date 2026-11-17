import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildShareMailto,
  MATERIEL_DOWNLOAD_URL,
  SHARE_EMAIL_BODY,
  SHARE_EMAIL_SUBJECT
} from '../config'

test('share mailto includes subject, body, and download URL', () => {
  const href = buildShareMailto()
  assert.ok(href.startsWith('mailto:'))
  assert.ok(href.includes(`subject=${encodeURIComponent(SHARE_EMAIL_SUBJECT)}`))
  assert.ok(href.includes(encodeURIComponent(SHARE_EMAIL_BODY)))
  assert.ok(SHARE_EMAIL_BODY.includes(MATERIEL_DOWNLOAD_URL))
  assert.equal(MATERIEL_DOWNLOAD_URL, 'https://github.com/davidcantu/materiel/releases')
})
