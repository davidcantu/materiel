import { useState } from 'react'
import { PLATFORMS, PLATFORM_LABELS, type Platform } from '../../../shared/platforms'
import { BrandLogo } from '../components/BrandLogo'

type OnboardingPageProps = {
  onComplete: () => void
}

export function OnboardingPage({ onComplete }: OnboardingPageProps): React.JSX.Element {
  const [platforms, setPlatforms] = useState<Platform[]>([...PLATFORMS])
  const [trackAmmo, setTrackAmmo] = useState(true)
  const [trackLoads, setTrackLoads] = useState(true)
  const [trackValue, setTrackValue] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function togglePlatform(platform: Platform): void {
    setPlatforms((prev) => {
      if (prev.includes(platform)) {
        if (prev.length === 1) return prev
        return prev.filter((p) => p !== platform)
      }
      return [...prev, platform]
    })
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)
    if (platforms.length === 0) {
      setError('Select at least one firearm type.')
      return
    }

    setBusy(true)
    try {
      await window.api.updateProfile({
        trackedPlatforms: platforms,
        trackAmmo,
        trackLoads,
        trackValue,
        onboardingComplete: true
      })
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save preferences')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="welcome-gate">
      <div className="welcome-panel onboarding-panel">
        <div className="welcome-brand welcome-brand-with-logo">
          <BrandLogo className="brand-logo-welcome" alt="" />
          <h1 className="welcome-title">Set up Materiel</h1>
          <p className="welcome-tagline">Tell us what you want to track</p>
        </div>

        <form className="welcome-form onboarding-form" onSubmit={(e) => void handleSubmit(e)}>
          <fieldset className="type-picker">
            <legend className="field-label">Which firearm types do you want to track?</legend>
            <div className="chip-row">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  className={`chip${platforms.includes(platform) ? ' active' : ''}`}
                  onClick={() => togglePlatform(platform)}
                >
                  {PLATFORM_LABELS[platform]}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="toggle-row onboarding-toggle">
            <input
              type="checkbox"
              checked={trackAmmo}
              onChange={(e) => setTrackAmmo(e.target.checked)}
            />
            <span>Track ammo use and inventory</span>
          </label>

          <label className="toggle-row onboarding-toggle">
            <input
              type="checkbox"
              checked={trackLoads}
              onChange={(e) => setTrackLoads(e.target.checked)}
            />
            <span>Track load details (reloaders)</span>
          </label>

          <label className="toggle-row onboarding-toggle">
            <input
              type="checkbox"
              checked={trackValue}
              onChange={(e) => setTrackValue(e.target.checked)}
            />
            <span>Track inventory and build values</span>
          </label>

          <p className="welcome-hint">
            You can change these anytime in Settings. Unused sections stay hidden until you turn
            them back on.
          </p>

          <div className="welcome-actions">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Continue'}
            </button>
          </div>
        </form>

        {error ? <p className="form-error welcome-error">{error}</p> : null}
      </div>
    </div>
  )
}
