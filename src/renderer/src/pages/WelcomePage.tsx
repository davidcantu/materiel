import { useState } from 'react'
import { buildShareMailto, MATERIEL_DOWNLOAD_URL } from '../../../shared/config'
import { isValidEmailIdentity } from '../../../shared/profile'
import { BrandLogo } from '../components/BrandLogo'
import { Icon } from '../components/icons/Icon'

type WelcomePageProps = {
  onComplete: () => void
}

export function WelcomePage({ onComplete }: WelcomePageProps): React.JSX.Element {
  const [email, setEmail] = useState('')
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
          — all encrypted on your machine. Free and unlimited. No cloud lock-in.
        </p>

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
            No password — this is a single-user local install. Your email is your username.
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
