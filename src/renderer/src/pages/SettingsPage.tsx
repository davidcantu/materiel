import { useState } from 'react'
import type { LicenseStatusInfo } from '../../../shared/license'
import type { ProfileInfo } from '../../../shared/profile'

type SettingsPageProps = {
  license: LicenseStatusInfo | null
  profile: ProfileInfo | null
  onRefresh: () => void
}

export function SettingsPage({
  license,
  profile,
  onRefresh
}: SettingsPageProps): React.JSX.Element {
  const [email, setEmail] = useState(profile?.email ?? '')
  const [key, setKey] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleActivate(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      const result = await window.api.activateLicense({ email: email.trim(), key: key.trim() })
      if (!result.ok) {
        setError(`${result.code}: ${result.message}`)
      } else {
        setMessage('License activated.')
        setKey('')
        onRefresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleClear(): Promise<void> {
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      await window.api.clearLicense()
      setMessage('License cleared — free tier restored.')
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clear failed')
    } finally {
      setBusy(false)
    }
  }

  async function toggleTrackValue(): Promise<void> {
    if (!profile) return
    await window.api.updateProfile({ trackValue: !profile.trackValue })
    onRefresh()
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Settings</h1>
          <p>License and local preferences.</p>
        </div>
      </header>

      <section className="settings-panel">
        <h2>License</h2>
        {license ? (
          <dl className="meta-list">
            <div>
              <dt>Tier</dt>
              <dd>
                {license.tier}
                {license.mode === 'unlocked' ? ' · unlocked' : ''}
              </dd>
            </div>
            <div>
              <dt>Rifles</dt>
              <dd>
                {license.completeRifleCount} / {license.freeRifleLimit} free
              </dd>
            </div>
            <div>
              <dt>Key</dt>
              <dd>{license.keyPresent ? (license.activatedEmail ?? 'Present') : 'None'}</dd>
            </div>
          </dl>
        ) : (
          <p className="muted">Loading license…</p>
        )}

        <form className="form-grid settings-form" onSubmit={(e) => void handleActivate(e)}>
          <label className="field">
            <span className="field-label">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span className="field-label">License key</span>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="MAT-1...."
              required
            />
          </label>
          <div className="row-actions field-span">
            <button type="submit" className="btn-primary" disabled={busy}>
              Activate
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy || !license?.keyPresent}
              onClick={() => void handleClear()}
            >
              Clear license
            </button>
          </div>
        </form>
        {message ? <p className="form-success">{message}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </section>

      <section className="settings-panel">
        <h2>Inventory preferences</h2>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={profile?.trackValue ?? true}
            onChange={() => void toggleTrackValue()}
          />
          <span>Track part values</span>
        </label>
      </section>
    </div>
  )
}
