import { useState } from 'react'
import { buildShareMailto, MATERIEL_DOWNLOAD_URL } from '../../../shared/config'
import { isValidEmailIdentity } from '../../../shared/profile'
import { BrandLogo } from '../components/BrandLogo'
import { Icon } from '../components/icons/Icon'

type WelcomePageProps = {
  onComplete: () => void
}

type Mode = 'start' | 'restore'

export function WelcomePage({ onComplete }: WelcomePageProps): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('start')
  const [email, setEmail] = useState('')
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleContinue(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)
    const nextEmail = email.trim()
    if (!isValidEmailIdentity(nextEmail)) {
      setError('Enter a valid email address.')
      return
    }

    setBusy(true)
    try {
      await window.api.updateProfile({ email: nextEmail })
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile')
    } finally {
      setBusy(false)
    }
  }

  async function handleRestore(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)
    const nextEmail = email.trim()
    const nextKey = key.trim()
    if (!isValidEmailIdentity(nextEmail) || !nextKey) {
      setError('Email and license key are required to restore paid access.')
      return
    }

    setBusy(true)
    try {
      const result = await window.api.activateLicense({
        email: nextEmail,
        key: nextKey
      })
      if (!result.ok) {
        setError(`${result.code}: ${result.message}`)
        return
      }
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore license')
    } finally {
      setBusy(false)
    }
  }

  function handleShare(): void {
    const href = buildShareMailto()
    window.open(href, '_blank')
  }

  return (
    <div className="welcome-gate">
      <div className="welcome-panel">
        <div className="welcome-brand welcome-brand-with-logo">
          <BrandLogo className="brand-logo-welcome" alt="" />
          <h1 className="welcome-title">Materiel</h1>
          <p className="welcome-tagline">Firearms tracker — gear, tracked locally</p>
        </div>

        <p className="welcome-pitch">
          Inventory every part, lock in complete builds, log range days, track ammo and maintenance
          — all encrypted on your machine. No cloud lock-in. Free for two firearms; unlock more with
          a license key.
        </p>

        <div className="welcome-mode-tabs" role="tablist" aria-label="Get started">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'start'}
            className={`welcome-tab${mode === 'start' ? ' active' : ''}`}
            onClick={() => {
              setMode('start')
              setError(null)
            }}
          >
            Get started
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'restore'}
            className={`welcome-tab${mode === 'restore' ? ' active' : ''}`}
            onClick={() => {
              setMode('restore')
              setError(null)
            }}
          >
            Restore license
          </button>
        </div>

        {mode === 'start' ? (
          <form className="welcome-form" onSubmit={(e) => void handleContinue(e)}>
            <label className="field">
              <span className="field-label">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </label>
            <p className="welcome-hint">
              No password — this is a single-user local install. Your email is your username and
              pairs with a license key so paid access survives reinstall.
            </p>
            <div className="welcome-actions">
              <button type="submit" className="btn-primary" disabled={busy}>
                Continue
              </button>
              <button
                type="button"
                className="btn-ghost btn-with-icon"
                disabled={busy}
                onClick={handleShare}
              >
                <Icon name="share" size={16} />
                Share via email
              </button>
            </div>
          </form>
        ) : (
          <form className="welcome-form" onSubmit={(e) => void handleRestore(e)}>
            <label className="field">
              <span className="field-label">License email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="Email the key was issued for"
                required
              />
            </label>
            <label className="field">
              <span className="field-label">License key</span>
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="MAT-1.…"
                required
                spellCheck={false}
              />
            </label>
            <p className="welcome-hint">
              After reinstall, enter the same email and paste the email-bound key to restore paid
              status.
            </p>
            <div className="welcome-actions">
              <button type="submit" className="btn-primary btn-with-icon" disabled={busy}>
                <Icon name="licenseLocked" size={16} />
                Activate &amp; continue
              </button>
              <button
                type="button"
                className="btn-ghost btn-with-icon"
                disabled={busy}
                onClick={handleShare}
              >
                <Icon name="share" size={16} />
                Share via email
              </button>
            </div>
          </form>
        )}

        {error ? <p className="form-error welcome-error">{error}</p> : null}

        <p className="welcome-download muted">
          Downloads:{' '}
          <a href={MATERIEL_DOWNLOAD_URL} target="_blank" rel="noreferrer">
            GitHub Releases
          </a>
        </p>
      </div>
    </div>
  )
}
