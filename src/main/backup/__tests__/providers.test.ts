import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { getBackupProvider, resolveProviderId } from '../providers'

const original = {
  provider: process.env.MAIN_VITE_BACKUP_PROVIDER,
  google: process.env.MAIN_VITE_GOOGLE_CLIENT_ID,
  onedrive: process.env.MAIN_VITE_ONEDRIVE_CLIENT_ID
}

afterEach(() => {
  if (original.provider === undefined) delete process.env.MAIN_VITE_BACKUP_PROVIDER
  else process.env.MAIN_VITE_BACKUP_PROVIDER = original.provider
  if (original.google === undefined) delete process.env.MAIN_VITE_GOOGLE_CLIENT_ID
  else process.env.MAIN_VITE_GOOGLE_CLIENT_ID = original.google
  if (original.onedrive === undefined) delete process.env.MAIN_VITE_ONEDRIVE_CLIENT_ID
  else process.env.MAIN_VITE_ONEDRIVE_CLIENT_ID = original.onedrive
})

test('resolveProviderId falls back to mock', () => {
  delete process.env.MAIN_VITE_BACKUP_PROVIDER
  assert.equal(resolveProviderId(null), 'mock')
  assert.equal(resolveProviderId('nope'), 'mock')
  assert.equal(resolveProviderId('google-drive'), 'google-drive')
})

test('real providers report unconfigured without client IDs', () => {
  delete process.env.MAIN_VITE_GOOGLE_CLIENT_ID
  delete process.env.MAIN_VITE_ONEDRIVE_CLIENT_ID
  assert.equal(getBackupProvider('google-drive').isConfigured(), false)
  assert.equal(getBackupProvider('onedrive').isConfigured(), false)
  assert.equal(getBackupProvider('mock').isConfigured(), true)
})

test('real providers report configured when client IDs set', () => {
  process.env.MAIN_VITE_GOOGLE_CLIENT_ID = 'test-google-client'
  process.env.MAIN_VITE_ONEDRIVE_CLIENT_ID = 'test-onedrive-client'
  assert.equal(getBackupProvider('google-drive').isConfigured(), true)
  assert.equal(getBackupProvider('onedrive').isConfigured(), true)
})
