import { useState } from 'react'
import { UNLOCK_MIN_LENGTH } from '../../../shared/unlock'
import { BrandLogo } from '../components/BrandLogo'

type UnlockPageProps = {
  onUnlocked: () => void
}

export function UnlockPage({ onUnlocked }: UnlockPageProps): React.JSX.Element {
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(): Promise<void> {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.unlockAttempt({ passphrase })
      if (!result.ok) {
        setError(result.error)
        return
      }
      onUnlocked()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="welcome-gate unlock-gate">
      <BrandLogo className="brand-logo-welcome" alt="Materiel" />
      <h1>Unlock Materiel</h1>
      <p className="muted">
        Enter your app passphrase to open the encrypted database on this computer.
      </p>
      <form
        className="unlock-form"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label className="field">
          <span className="field-label">Passphrase</span>
          <input
            type="password"
            autoComplete="current-password"
            value={passphrase}
            disabled={busy}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder={`At least ${UNLOCK_MIN_LENGTH} characters`}
            autoFocus
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" className="btn-primary" disabled={busy || !passphrase}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </div>
  )
}
