import { useEffect, useState } from 'react'
import type { LicenseStatusInfo } from '../../../shared/license'
import type { MilestoneStatus, MilestonesSummary } from '../../../shared/milestones'
import { hasLocalIdentity, type ProfileInfo, type ProfilePatch } from '../../../shared/profile'
import { ImageCropField, type ImageCropValue } from '../components/ImageCropField'
import { PageHeader } from '../components/PageHeader'
import { PreferenceInfoButton } from '../components/PreferenceInfoButton'
import { useToast } from '../components/toast-context'
import {
  setStoredThemePreference,
  THEME_OPTIONS,
  type ThemePreference
} from '../lib/theme'

type SettingsPageProps = {
  license: LicenseStatusInfo | null
  profile: ProfileInfo | null
  onRefresh: () => void
  themePreference: ThemePreference
  onThemePreferenceChange: (preference: ThemePreference) => void
}

type ProfileDraft = {
  firstName: string
  lastName: string
  email: string
  city: string
  state: string
  country: string
  image: ImageCropValue
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

function draftFromProfile(profile: ProfileInfo): ProfileDraft {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email ?? '',
    city: profile.city,
    state: profile.state,
    country: profile.country,
    image: {
      imageUrl: profile.profileImageUrl,
      imageScale: 1
    }
  }
}

export function SettingsPage({
  license,
  profile,
  onRefresh,
  themePreference,
  onThemePreferenceChange
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
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft] = useState<ProfileDraft | null>(null)
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

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

  const profileEmail = profile?.email?.trim().toLowerCase() || null
  const licenseEmail = license?.activatedEmail?.trim().toLowerCase() || null
  const emailMismatch =
    Boolean(profileEmail && licenseEmail && profileEmail !== licenseEmail) ||
    Boolean(
      profileEmail &&
      emailDraft !== null &&
      emailDraft.trim() &&
      profileEmail !== emailDraft.trim().toLowerCase() &&
      key.trim()
    )
  const identityReady = hasLocalIdentity(profile)

  async function handleActivate(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      const result = await window.api.activateLicense({
        email: email.trim(),
        key: key.trim()
      })
      if (!result.ok) {
        setError(`${result.code}: ${result.message}`)
        toast.error(result.message)
      } else {
        setMessage('License activated.')
        toast.success('License activated.')
        setKey('')
        setEmailDraft(null)
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

  function startEditProfile(): void {
    if (!profile) return
    setProfileError(null)
    setProfileDraft(draftFromProfile(profile))
    setEditingProfile(true)
  }

  function cancelEditProfile(): void {
    setEditingProfile(false)
    setProfileDraft(null)
    setProfileError(null)
  }

  async function saveProfile(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!profileDraft) return
    setProfileBusy(true)
    setProfileError(null)
    try {
      const patch: ProfilePatch = {
        firstName: profileDraft.firstName.trim(),
        lastName: profileDraft.lastName.trim(),
        email: profileDraft.email.trim() || null,
        city: profileDraft.city.trim(),
        state: profileDraft.state.trim(),
        country: profileDraft.country.trim(),
        profileImageUrl: profileDraft.image.imageUrl
      }
      await window.api.updateProfile(patch)
      toast.success('Profile saved.')
      setEditingProfile(false)
      setProfileDraft(null)
      onRefresh()
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Could not save profile'
      setProfileError(text)
      toast.error(text)
    } finally {
      setProfileBusy(false)
    }
  }

  const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim()

  return (
    <div className="page">
      <PageHeader title="Settings" description="Profile, milestones, license, and preferences." />

      <section className="settings-panel settings-panel-wide">
        <div className="section-header">
          <h2>Profile</h2>
          {profile && !editingProfile ? (
            <button type="button" className="btn-ghost btn-sm" onClick={startEditProfile}>
              Edit Profile
            </button>
          ) : null}
        </div>

        {profile ? (
          editingProfile && profileDraft ? (
            <form
              className="form-grid settings-form profile-edit-form"
              onSubmit={(e) => void saveProfile(e)}
            >
              <div className="field field-span profile-edit-hero">
                <ImageCropField
                  label="Profile photo"
                  variant="profile"
                  value={profileDraft.image}
                  onChange={(image) =>
                    setProfileDraft((prev) => (prev ? { ...prev, image } : prev))
                  }
                  disabled={profileBusy}
                />
              </div>
              <label className="field">
                <span className="field-label">First name</span>
                <input
                  value={profileDraft.firstName}
                  onChange={(e) =>
                    setProfileDraft((prev) =>
                      prev ? { ...prev, firstName: e.target.value } : prev
                    )
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Last name</span>
                <input
                  value={profileDraft.lastName}
                  onChange={(e) =>
                    setProfileDraft((prev) => (prev ? { ...prev, lastName: e.target.value } : prev))
                  }
                />
              </label>
              <label className="field field-span">
                <span className="field-label">Email</span>
                <input
                  type="email"
                  value={profileDraft.email}
                  onChange={(e) =>
                    setProfileDraft((prev) => (prev ? { ...prev, email: e.target.value } : prev))
                  }
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">City</span>
                <input
                  value={profileDraft.city}
                  onChange={(e) =>
                    setProfileDraft((prev) => (prev ? { ...prev, city: e.target.value } : prev))
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">State</span>
                <input
                  value={profileDraft.state}
                  onChange={(e) =>
                    setProfileDraft((prev) => (prev ? { ...prev, state: e.target.value } : prev))
                  }
                />
              </label>
              <label className="field field-span">
                <span className="field-label">Country</span>
                <input
                  value={profileDraft.country}
                  onChange={(e) =>
                    setProfileDraft((prev) => (prev ? { ...prev, country: e.target.value } : prev))
                  }
                />
              </label>
              <p className="muted field-span settings-note">
                Email is your local identity and the username paired with your license. Changing it
                here updates that pairing for future license activation.
              </p>
              {profileError ? <p className="form-error field-span">{profileError}</p> : null}
              <div className="row-actions field-span">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={profileBusy}
                  onClick={cancelEditProfile}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={profileBusy}>
                  {profileBusy ? 'Saving…' : 'Save Profile'}
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-view">
              <div className="profile-avatar" aria-hidden={!profile.profileImageUrl}>
                {profile.profileImageUrl ? (
                  <img src={profile.profileImageUrl} alt="" />
                ) : (
                  <span className="profile-avatar-fallback">
                    {(displayName || profile.email || '?').slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <dl className="meta-list">
                <div>
                  <dt>Email</dt>
                  <dd>{profile.email || '—'}</dd>
                </div>
                <div>
                  <dt>Name</dt>
                  <dd>{displayName || '—'}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>
                    {[profile.city, profile.state, profile.country].filter(Boolean).join(', ') ||
                      '—'}
                  </dd>
                </div>
              </dl>
            </div>
          )
        ) : (
          <p className="muted">Loading profile…</p>
        )}
        {!editingProfile ? (
          <p className="muted settings-note">
            Email is your local identity (no password) and the username paired with your license.
            After reinstall, enter the same email with your email-bound license key to restore paid
            access.
          </p>
        ) : null}
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
              <dt>Firearms</dt>
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

        {profile && profileEmail && licenseEmail && profileEmail !== licenseEmail ? (
          <p className="form-error" role="status">
            Profile email ({profile.email}) differs from the activated license email (
            {license?.activatedEmail}). Keys are email-bound — activate with the issued email;
            successful activation updates the local profile email to match.
          </p>
        ) : null}

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
              placeholder="MAT-1.…"
              required
            />
          </label>
          {emailMismatch && key.trim() ? (
            <p className="muted field-span">
              Activating will bind this key’s email and update the local profile email if it
              differs.
            </p>
          ) : null}
          <div className="row-actions field-span">
            <button type="submit" className="btn-primary" disabled={busy || !identityReady}>
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
        {!identityReady ? (
          <p className="form-error">Set your email on first launch before activating a license.</p>
        ) : null}
        {message ? <p className="form-success">{message}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </section>

      <section className="settings-panel">
        <h2>Appearance</h2>
        <p className="muted">Follow your system theme by default, or lock Light / Dark.</p>
        <div className="theme-toggle" role="group" aria-label="Color theme">
          {THEME_OPTIONS.map((option) => {
            const active = themePreference === option.value
            return (
              <button
                key={option.value}
                type="button"
                className={`theme-option${active ? ' active' : ''}`}
                aria-pressed={active}
                onClick={() => {
                  setStoredThemePreference(option.value)
                  onThemePreferenceChange(option.value)
                }}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </section>

      <section className="settings-panel">
        <h2>Inventory preferences</h2>
        <div className="pref-row">
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={profile?.trackValue ?? true}
              onChange={() => void toggleTrackValue()}
            />
            <span>Track part values</span>
          </label>
          <PreferenceInfoButton title="Track part values">
            <p>
              When enabled, Materiel shows dollar values on parts, build totals, and dashboard
              summaries so you can see what your inventory and systems are worth.
            </p>
            <p>
              Turn this off if you prefer not to track or display financial figures anywhere in the
              app.
            </p>
          </PreferenceInfoButton>
        </div>
        <div className="pref-row">
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={profile?.trackAmmo ?? true}
              onChange={() => void toggleTrackAmmo()}
            />
            <span>Track ammo</span>
          </label>
          <PreferenceInfoButton title="Track ammo">
            <p>
              When enabled, the Ammo &amp; Reloading section is available so you can manage
              ammunition lots, link handloads, and deduct rounds when you log sessions.
            </p>
            <p>
              Turn this off to hide ammunition inventory and consumption tracking if you only want
              builds and shooting logs.
            </p>
          </PreferenceInfoButton>
        </div>
      </section>
    </div>
  )
}
