import { useEffect, useMemo, useState } from 'react'
import {
  MILESTONE_TIER_LABELS,
  type MilestoneStatus,
  type MilestoneTier,
  type MilestonesSummary
} from '../../../shared/milestones'
import { PLATFORMS, PLATFORM_LABELS, type Platform } from '../../../shared/platforms'
import { type ProfileInfo, type ProfilePatch } from '../../../shared/profile'
import type { UpdateCheckResult } from '../../../shared/updates'
import { BrandLogo } from '../components/BrandLogo'
import { Icon } from '../components/icons/Icon'
import { ImageCropField, type ImageCropValue } from '../components/ImageCropField'
import { PageHeader } from '../components/PageHeader'
import { PreferenceInfoButton } from '../components/PreferenceInfoButton'
import { useToast } from '../components/toast-context'
import { setStoredThemePreference, THEME_OPTIONS, type ThemePreference } from '../lib/theme'

type SettingsPageProps = {
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

function updateStatusMessage(result: UpdateCheckResult, currentVersion: string): string {
  switch (result.status) {
    case 'available':
      return `Materiel ${result.latestVersion} is available (you have ${result.currentVersion}). Download from GitHub Releases, quit the app, install, then relaunch — your local data stays on this machine.`
    case 'up-to-date':
      return `You’re on the latest release (${result.currentVersion}).`
    case 'skipped':
      if (result.reason === 'offline') {
        return `Couldn’t reach GitHub Releases (offline or timed out). You’re running ${currentVersion}. Try again when you’re online.`
      }
      if (result.reason === 'no-release') {
        return `No published release found yet. You’re running ${currentVersion}.`
      }
      return `Update check didn’t complete (${result.reason}${result.detail ? `: ${result.detail}` : ''}). You’re running ${currentVersion}.`
    default: {
      const _exhaustive: never = result
      return _exhaustive
    }
  }
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
  profile,
  onRefresh,
  themePreference,
  onThemePreferenceChange
}: SettingsPageProps): React.JSX.Element {
  const toast = useToast()
  const [milestones, setMilestones] = useState<MilestonesSummary | null>(null)
  const [milestonesError, setMilestonesError] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft] = useState<ProfileDraft | null>(null)
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [appVersion, setAppVersion] = useState<string>('…')
  const [updateBusy, setUpdateBusy] = useState(false)
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api
      .getAppInfo()
      .then((info) => {
        if (!cancelled) setAppVersion(info.version)
      })
      .catch(() => {
        if (!cancelled) setAppVersion('unknown')
      })
    return () => {
      cancelled = true
    }
  }, [])

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

  async function importJsonFile(): Promise<void> {
    setImportBusy(true)
    setImportMessage(null)
    try {
      const result = await window.api.importPickJsonFile()
      if (!result.ok) {
        if (result.error !== 'Import cancelled') {
          setImportMessage(result.error)
          toast.error(result.error)
        }
        return
      }
      const { summary } = result
      const warningNote =
        summary.warnings.length > 0 ? ` (${summary.warnings.length} warning(s))` : ''
      const message = `Imported ${summary.partsCreated} part(s), ${summary.buildsCreated} build(s), ${summary.logsCreated} log(s)${warningNote}.`
      setImportMessage(
        summary.warnings.length > 0
          ? `${message}\n${summary.warnings.slice(0, 8).join('\n')}${summary.warnings.length > 8 ? '\n…' : ''}`
          : message
      )
      toast.success(message)
      onRefresh()
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Import failed'
      setImportMessage(text)
      toast.error(text)
    } finally {
      setImportBusy(false)
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

  async function toggleTrackLoads(): Promise<void> {
    if (!profile) return
    try {
      await window.api.updateProfile({ trackLoads: !profile.trackLoads })
      onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update preference')
    }
  }

  async function toggleTrackedPlatform(platform: Platform): Promise<void> {
    if (!profile) return
    const current = profile.trackedPlatforms
    const next = current.includes(platform)
      ? current.filter((p) => p !== platform)
      : [...current, platform]
    if (next.length === 0) {
      toast.error('Keep at least one firearm type selected.')
      return
    }
    try {
      await window.api.updateProfile({ trackedPlatforms: next })
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

  const milestonesByTier = useMemo(() => {
    if (!milestones) return null
    const tiers: MilestoneTier[] = ['new', 'mid', 'advanced']
    return tiers.map((tier) => ({
      tier,
      label: MILESTONE_TIER_LABELS[tier],
      items: milestones.milestones.filter((m) => m.tier === tier)
    }))
  }, [milestones])

  async function handleCheckUpdates(): Promise<void> {
    setUpdateBusy(true)
    setUpdateMessage(null)
    try {
      const result = await window.api.checkForUpdates()
      const text = updateStatusMessage(result, appVersion)
      setUpdateMessage(text)
      if (result.status === 'available') {
        toast.success(`Update ${result.latestVersion} available`)
      } else if (result.status === 'up-to-date') {
        toast.success('You’re up to date')
      } else {
        toast.error('Update check incomplete')
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Update check failed'
      setUpdateMessage(text)
      toast.error(text)
    } finally {
      setUpdateBusy(false)
    }
  }

  return (
    <div className="page">
      <PageHeader title="Settings" description="Profile, milestones, and preferences." />

      <section className="settings-panel">
        <h2>About</h2>
        <div className="about-brand">
          <BrandLogo className="brand-logo-about" alt="Materiel" />
          <p>
            Materiel is the local-first firearms tracker built for shooters who actually log —
            bolt guns, ARs, and pistols. Inventory and builds, session logs, ammo and loads,
            maintenance alerts, and encrypted data that stays on your machine. No cloud required.
            Just your kit, your rounds, and a clean record of what you’ve run.
          </p>
          <p className="muted">Version {appVersion}</p>
        </div>
      </section>

      <section className="settings-panel">
        <h2>Updates</h2>
        <p className="muted">
          Materiel soft-checks GitHub Releases. Nothing installs automatically — when an update is
          available, download the installer for your OS, quit Materiel, run it, then relaunch. Your
          encrypted local database stays on this computer.
        </p>
        <div className="row-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={updateBusy}
            onClick={() => void handleCheckUpdates()}
          >
            {updateBusy ? 'Checking…' : 'Check for updates'}
          </button>
        </div>
        {updateMessage ? <p className="settings-note">{updateMessage}</p> : null}
      </section>

      <section className="settings-panel settings-panel-wide">
        <div className="section-header">
          <h2>Import data</h2>
        </div>
        <p className="muted settings-note">
          Import a Materiel JSON file (from Claude/Excel conversion or a hand-authored dump).
          Action + barrel only sources can auto-create a placeholder chassis so builds — and
          therefore session logs — can be created. See{' '}
          <code>docs/import-from-excel.md</code> in the repo for the Claude prompt and schema.
        </p>
        <div className="row-actions">
          <button
            type="button"
            className="btn-primary btn-with-icon"
            disabled={importBusy}
            onClick={() => void importJsonFile()}
          >
            <Icon name="upload" size={16} />
            {importBusy ? 'Importing…' : 'Import JSON file…'}
          </button>
        </div>
        {importMessage ? (
          <pre className="settings-note" style={{ whiteSpace: 'pre-wrap' }}>
            {importMessage}
          </pre>
        ) : null}
      </section>

      <section className="settings-panel settings-panel-wide">
        <div className="section-header">
          <h2>Profile</h2>
          {profile && !editingProfile ? (
            <button
              type="button"
              className="btn-ghost btn-sm btn-with-icon"
              onClick={startEditProfile}
            >
              <Icon name="edit" size={14} />
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
                Email is your local identity (no password). It is also your username for this
                install.
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
            Email is your local identity (no password). Reinstall recovery for inventory is via
            backup restore — not a license key.
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
        {milestonesByTier ? (
          <div className="milestone-tiers">
            {milestonesByTier.map((group) => (
              <div key={group.tier} className="milestone-tier">
                <h3 className="milestone-tier-label">{group.label}</h3>
                <div className="milestone-grid">
                  {group.items.map((milestone) => (
                    <MilestoneCard key={milestone.id} milestone={milestone} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="settings-panel">
        <div className="section-header">
          <h2>Appearance</h2>
          <span className="status-inline" aria-hidden="true">
            <Icon name="theme" size={18} />
          </span>
        </div>
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
        <h2>Tracking preferences</h2>
        <p className="muted">
          Same choices as first-run setup. Turning something off hides related fields and sections.
        </p>

        <div className="pref-row pref-row-stack">
          <div className="pref-row-label">
            <span>Firearm types</span>
            <PreferenceInfoButton title="Firearm types">
              <p>
                Choose which platforms appear in inventory filters and when creating builds. Parts
                for other platforms stay in the database but stay out of day-to-day views.
              </p>
            </PreferenceInfoButton>
          </div>
          <div className="chip-row">
            {PLATFORMS.map((platform) => {
              const checked = profile?.trackedPlatforms?.includes(platform) ?? true
              return (
                <button
                  key={platform}
                  type="button"
                  className={`chip${checked ? ' active' : ''}`}
                  aria-pressed={checked}
                  onClick={() => void toggleTrackedPlatform(platform)}
                >
                  {PLATFORM_LABELS[platform]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="pref-row">
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={profile?.trackAmmo ?? true}
              onChange={() => void toggleTrackAmmo()}
            />
            <span>Track ammo use and inventory</span>
          </label>
          <PreferenceInfoButton title="Track ammo">
            <p>
              When enabled, ammunition lots stay available so you can manage on-hand quantity and
              deduct rounds when you log sessions.
            </p>
            <p>Turn this off to hide ammo inventory if you only want builds and shooting logs.</p>
          </PreferenceInfoButton>
        </div>

        <div className="pref-row">
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={profile?.trackLoads ?? true}
              onChange={() => void toggleTrackLoads()}
            />
            <span>Track load details (reloaders)</span>
          </label>
          <PreferenceInfoButton title="Track load details">
            <p>
              When enabled, Load Data recipes are available for reloading development (charge, COAL,
              components).
            </p>
            <p>Turn this off if you buy factory ammo only and do not need load recipes.</p>
          </PreferenceInfoButton>
        </div>

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
      </section>
    </div>
  )
}
