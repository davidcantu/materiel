import { useEffect, useState } from 'react'
import type { LicenseStatusInfo } from '../../../shared/license'
import type { MilestoneStatus, MilestonesSummary } from '../../../shared/milestones'
import type { ProfileInfo } from '../../../shared/profile'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/toast-context'

type SettingsPageProps = {
  license: LicenseStatusInfo | null
  profile: ProfileInfo | null
  onRefresh: () => void
}

function MilestoneCard({ milestone }: { milestone: MilestoneStatus }): React.JSX.Element {
  return (
    <article
      className={`milestone-card${milestone.unlocked ? ' unlocked' : ' locked'}`}
      aria-label={`${milestone.name}: ${milestone.unlocked ? 'Unlocked' : 'Locked'}`}
    >
      <div className="milestone-card-top">
        <h3>{milestone.name}</h3>
        <span className={`milestone-status${milestone.unlocked ? ' is-unlocked' : ''}`}>
          <span className="milestone-dot" aria-hidden="true" />
          {milestone.unlocked ? 'Unlocked' : 'Locked'}
        </span>
      </div>
      <p>{milestone.description}</p>
    </article>
  )
}

export function SettingsPage({
  license,
  profile,
  onRefresh
}: SettingsPageProps): React.JSX.Element {
  const toast = useToast()
  const [emailDraft, setEmailDraft] = useState<string | null>(null)
  const email = emailDraft ?? profile?.email ?? ''
  const [key, setKey] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [milestones, setMilestones] = useState<MilestonesSummary | null>(null)
  const [milestonesError, setMilestonesError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api
      .getMilestones()
      .then((next) => {
        if (!cancelled) {
          setMilestones(next)
          setMilestonesError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setMilestonesError(err instanceof Error ? err.message : 'Failed to load milestones')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleActivate(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      const result = await window.api.activateLicense({ email: email.trim(), key: key.trim() })
      if (!result.ok) {
        setError(`${result.code}: ${result.message}`)
        toast.error(result.message)
      } else {
        setMessage('License activated.')
        toast.success('License activated.')
        setKey('')
        onRefresh()
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Activation failed'
      setError(text)
      toast.error(text)
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
      toast.success('License cleared.')
      onRefresh()
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Clear failed'
      setError(text)
      toast.error(text)
    } finally {
      setBusy(false)
    }
  }

  async function toggleTrackValue(): Promise<void> {
    if (!profile) return
    try {
      await window.api.updateProfile({ trackValue: !profile.trackValue })
      onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update preference')
    }
  }

  async function toggleTrackAmmo(): Promise<void> {
    if (!profile) return
    try {
      await window.api.updateProfile({ trackAmmo: !profile.trackAmmo })
      onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update preference')
    }
  }

  const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim()

  return (
    <div className="page">
      <PageHeader title="Settings" description="Profile, milestones, license, and preferences." />

      <section className="settings-panel settings-panel-wide">
        <h2>Profile</h2>
        {profile ? (
          <dl className="meta-list">
            <div>
              <dt>Name</dt>
              <dd>{displayName || '—'}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>
                {[profile.city, profile.state, profile.country].filter(Boolean).join(', ') || '—'}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="muted">Loading profile…</p>
        )}
      </section>

      <section className="settings-panel settings-panel-wide">
        <div className="section-header">
          <h2>Milestones</h2>
          {milestones ? (
            <span className="muted">
              {milestones.unlockedCount} / {milestones.milestones.length} unlocked
            </span>
          ) : null}
        </div>
        {milestonesError ? <p className="form-error">{milestonesError}</p> : null}
        {!milestones && !milestonesError ? <p className="muted">Loading milestones…</p> : null}
        {milestones ? (
          <div className="milestone-grid">
            {milestones.milestones.map((milestone) => (
              <MilestoneCard key={milestone.id} milestone={milestone} />
            ))}
          </div>
        ) : null}
      </section>

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
            <input value={email} onChange={(e) => setEmailDraft(e.target.value)} required />
          </label>
          <label className="field">
            <span className="field-label">License key</span>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="MAT-XXXX-XXXX-XXXX"
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
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={profile?.trackAmmo ?? true}
            onChange={() => void toggleTrackAmmo()}
          />
          <span>Track ammo — show ammunition inventory and consumption.</span>
        </label>
      </section>
    </div>
  )
}
