import { useEffect, useState } from 'react'
import type { BackupStatusInfo } from '../../../shared/backup'
import { PLATFORMS, PLATFORM_LABELS, type Platform } from '../../../shared/platforms'
import { type ProfileInfo, type ProfilePatch } from '../../../shared/profile'
import type { UpdateCheckResult } from '../../../shared/updates'
import {
  AI_PROVIDER_IDS,
  AI_PROVIDER_KEY_HINTS,
  AI_PROVIDER_LABELS,
  type AiCapabilityState,
  type AiModelInfo,
  type AiProviderId,
  type AiStatusInfo
} from '../../../shared/ai'
import {
  AI_PRIVACY_COPY,
  DEFAULT_AI_PRIVACY_PREFS,
  type AiPrivacyPrefs
} from '../../../shared/ai-privacy'
import { UNLOCK_MIN_LENGTH } from '../../../shared/unlock'
import { BrandLogo } from '../components/BrandLogo'
import { Icon } from '../components/icons/Icon'
import { ImageCropField, type ImageCropValue } from '../components/ImageCropField'
import { PageHeader } from '../components/PageHeader'
import { PreferenceInfoButton } from '../components/PreferenceInfoButton'
import { useToast } from '../components/toast-context'
import { setStoredThemePreference, THEME_OPTIONS, type ThemePreference } from '../lib/theme'

const AI_SUBSCRIPTION_NOTE =
  'API keys are separate from chat subscriptions (ChatGPT Plus, Claude Pro, grok.com, etc.). For Grok models pick xAI (Grok) and create a key at console.x.ai — that is not Groq, and a grok.com chat login is not an API key.'

const EXPORT_PLAINTEXT_WARNING =
  'This export is a plaintext spreadsheet (serial numbers, locations, values, and other inventory detail). Store it only where you trust the file — do not sync it to shared drives or email it casually.'

function capabilityLabel(state: AiCapabilityState): string {
  switch (state) {
    case 'ok':
      return 'OK'
    case 'fail':
      return 'Fail'
    case 'stub':
      return 'Optional'
    default:
      return 'Unknown'
  }
}

function CapabilityRow({
  label,
  state,
  detail
}: {
  label: string
  state: AiCapabilityState
  detail?: string
}): React.JSX.Element {
  return (
    <li className={`ai-capability ai-capability-${state}`}>
      <span className="ai-capability-label">{label}</span>
      <span className="ai-capability-state">{capabilityLabel(state)}</span>
      {detail ? <span className="ai-capability-detail muted">{detail}</span> : null}
    </li>
  )
}

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
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft] = useState<ProfileDraft | null>(null)
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [appVersion, setAppVersion] = useState<string>('…')
  const [updateBusy, setUpdateBusy] = useState(false)
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [sampleBusy, setSampleBusy] = useState(false)
  const [backupStatus, setBackupStatus] = useState<BackupStatusInfo | null>(null)
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupMessage, setBackupMessage] = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<AiStatusInfo | null>(null)
  const [aiModels, setAiModels] = useState<AiModelInfo[]>([])
  const [aiKeyDraft, setAiKeyDraft] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMessage, setAiMessage] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiPrivacy, setAiPrivacy] = useState<AiPrivacyPrefs>({ ...DEFAULT_AI_PRIVACY_PREFS })
  const [unlockEnabled, setUnlockEnabled] = useState(false)
  const [unlockBusy, setUnlockBusy] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [unlockMessage, setUnlockMessage] = useState<string | null>(null)
  const [unlockPassphrase, setUnlockPassphrase] = useState('')
  const [unlockConfirm, setUnlockConfirm] = useState('')
  const [unlockCurrent, setUnlockCurrent] = useState('')
  const [unlockNext, setUnlockNext] = useState('')
  const [unlockNextConfirm, setUnlockNextConfirm] = useState('')

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
    void window.api
      .getBackupStatus()
      .then((status) => {
        if (!cancelled) setBackupStatus(status)
      })
      .catch(() => {
        /* backup optional at boot */
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function refreshAiModels(provider: AiProviderId): Promise<void> {
    const result = await window.api.listAiModels({ provider })
    if (result.ok) {
      setAiModels(result.models)
      return
    }
    setAiModels([])
    // Soft-fail on load — key may be invalid until Test connection.
    setAiError(result.error)
  }

  useEffect(() => {
    let cancelled = false
    void window.api
      .getAiStatus()
      .then(async (status) => {
        if (cancelled) return
        setAiStatus(status)
        setAiError(null)
        if (status.hasKey) {
          const result = await window.api.listAiModels({ provider: status.provider })
          if (cancelled) return
          if (result.ok) {
            setAiModels(result.models)
          } else {
            setAiModels([])
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAiError(err instanceof Error ? err.message : 'Failed to load AI settings')
        }
      })
    void window.api
      .getAiPrivacyPrefs()
      .then((prefs) => {
        if (!cancelled) setAiPrivacy(prefs)
      })
      .catch(() => {
        /* defaults already set */
      })
    void window.api
      .getUnlockStatus()
      .then((status) => {
        if (!cancelled) {
          setUnlockEnabled(Boolean(status.required || profile?.unlockPinSet))
        }
      })
      .catch(() => {
        if (!cancelled) setUnlockEnabled(Boolean(profile?.unlockPinSet))
      })
    return () => {
      cancelled = true
    }
  }, [profile?.unlockPinSet])

  async function handleAiProviderChange(provider: AiProviderId): Promise<void> {
    setAiError(null)
    setAiMessage(null)
    setAiKeyDraft('')
    try {
      const status = await window.api.getAiStatus({ provider, rememberProvider: true })
      setAiStatus(status)
      setAiModels([])
      if (status.hasKey) {
        await refreshAiModels(provider)
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to switch provider')
    }
  }

  async function handleSaveAiKey(): Promise<void> {
    if (!aiStatus) return
    const key = aiKeyDraft.trim()
    if (!key) {
      setAiError('Enter an API key to save.')
      return
    }
    setAiBusy(true)
    setAiError(null)
    setAiMessage(null)
    try {
      const status = await window.api.saveAiKey({
        provider: aiStatus.provider,
        apiKey: key,
        model: aiStatus.model
      })
      setAiStatus(status)
      setAiKeyDraft('')
      setAiMessage(`Key saved (ending …${status.maskedSuffix ?? '????'}).`)
      toast.success('API key saved')
      await refreshAiModels(status.provider)
      onRefresh()
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Failed to save API key'
      setAiError(text)
      toast.error(text)
    } finally {
      setAiBusy(false)
    }
  }

  async function handleRemoveAiKey(): Promise<void> {
    if (!aiStatus) return
    setAiBusy(true)
    setAiError(null)
    setAiMessage(null)
    try {
      const status = await window.api.removeAiKey({ provider: aiStatus.provider })
      setAiStatus(status)
      setAiModels([])
      setAiKeyDraft('')
      setAiMessage('API key removed for this provider.')
      toast.success('API key removed')
      onRefresh()
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Failed to remove API key'
      setAiError(text)
      toast.error(text)
    } finally {
      setAiBusy(false)
    }
  }

  async function handleAiModelChange(model: string): Promise<void> {
    if (!aiStatus) return
    setAiBusy(true)
    setAiError(null)
    try {
      const status = await window.api.setAiModel({ provider: aiStatus.provider, model })
      setAiStatus(status)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to set model')
    } finally {
      setAiBusy(false)
    }
  }

  async function handleTestAiConnection(): Promise<void> {
    if (!aiStatus) return
    setAiBusy(true)
    setAiError(null)
    setAiMessage(null)
    try {
      const result = await window.api.testAiConnection({ provider: aiStatus.provider })
      setAiStatus(result.status)
      if (result.ok) {
        setAiMessage(result.status.capabilities.message ?? 'Connection ok.')
        toast.success('AI connection ok')
        await refreshAiModels(result.status.provider)
      } else {
        setAiError(result.error)
        toast.error(result.error)
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Connection test failed'
      setAiError(text)
      toast.error(text)
    } finally {
      setAiBusy(false)
    }
  }

  async function patchAiPrivacy(patch: Partial<AiPrivacyPrefs>): Promise<void> {
    try {
      const next = await window.api.setAiPrivacyPrefs(patch)
      setAiPrivacy(next)
      toast.success('AI privacy settings saved.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save AI privacy settings')
    }
  }

  async function handleEnableUnlock(): Promise<void> {
    setUnlockBusy(true)
    setUnlockError(null)
    setUnlockMessage(null)
    try {
      await window.api.enableUnlock({
        passphrase: unlockPassphrase,
        confirm: unlockConfirm
      })
      setUnlockEnabled(true)
      setUnlockPassphrase('')
      setUnlockConfirm('')
      setUnlockMessage(
        'Unlock passphrase enabled. Materiel will ask for it on launch. Remember it — without it the database cannot open.'
      )
      toast.success('Unlock passphrase enabled')
      onRefresh()
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : 'Could not enable unlock')
    } finally {
      setUnlockBusy(false)
    }
  }

  async function handleChangeUnlock(): Promise<void> {
    setUnlockBusy(true)
    setUnlockError(null)
    setUnlockMessage(null)
    try {
      await window.api.changeUnlock({
        currentPassphrase: unlockCurrent,
        nextPassphrase: unlockNext,
        confirm: unlockNextConfirm
      })
      setUnlockCurrent('')
      setUnlockNext('')
      setUnlockNextConfirm('')
      setUnlockMessage('Unlock passphrase updated.')
      toast.success('Unlock passphrase updated')
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : 'Could not change unlock passphrase')
    } finally {
      setUnlockBusy(false)
    }
  }

  async function handleDisableUnlock(): Promise<void> {
    setUnlockBusy(true)
    setUnlockError(null)
    setUnlockMessage(null)
    try {
      await window.api.disableUnlock({ passphrase: unlockCurrent })
      setUnlockEnabled(false)
      setUnlockCurrent('')
      setUnlockMessage('Unlock passphrase removed. Auto-unlock via OS secure storage is restored.')
      toast.success('Unlock passphrase disabled')
      onRefresh()
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : 'Could not disable unlock')
    } finally {
      setUnlockBusy(false)
    }
  }

  async function exportExcelFile(): Promise<void> {
    if (!window.confirm(`${EXPORT_PLAINTEXT_WARNING}\n\nContinue with Export Excel?`)) {
      return
    }
    setExportBusy(true)
    setExportMessage(null)
    try {
      const result = await window.api.exportExcel()
      if (!result.ok) {
        if (result.error !== 'Export cancelled') {
          setExportMessage(result.error)
          toast.error(result.error)
        }
        return
      }
      const message = `Exported Excel workbook to ${result.path}`
      setExportMessage(message)
      toast.success('Excel export saved')
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Export failed'
      setExportMessage(text)
      toast.error(text)
    } finally {
      setExportBusy(false)
    }
  }

  async function downloadSampleExcel(): Promise<void> {
    setSampleBusy(true)
    setImportMessage(null)
    try {
      const result = await window.api.exportSampleExcel()
      if (!result.ok) {
        if (result.error !== 'Export cancelled') {
          setImportMessage(result.error)
          toast.error(result.error)
        }
        return
      }
      setImportMessage(`Sample workbook saved to ${result.path}`)
      toast.success('Sample Excel saved')
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Sample download failed'
      setImportMessage(text)
      toast.error(text)
    } finally {
      setSampleBusy(false)
    }
  }

  async function importExcelFile(): Promise<void> {
    setImportBusy(true)
    setImportMessage(null)
    try {
      const result = await window.api.importPickExcelFile()
      if (!result.ok) {
        if (result.error !== 'Import cancelled') {
          setImportMessage(result.error)
          toast.error(result.error)
        }
        return
      }
      const { summary } = result
      const bits = [
        `${summary.partsCreated} part${summary.partsCreated === 1 ? '' : 's'}`,
        `${summary.buildsCreated} build${summary.buildsCreated === 1 ? '' : 's'}`,
        `${summary.logsCreated} log${summary.logsCreated === 1 ? '' : 's'}`,
        `${summary.ammoCreated} ammo lot${summary.ammoCreated === 1 ? '' : 's'}`
      ]
      const warn =
        summary.warnings.length > 0
          ? ` · ${summary.warnings.length} warning${summary.warnings.length === 1 ? '' : 's'}`
          : ''
      setImportMessage(`Imported ${bits.join(', ')}${warn}`)
      toast.success('Excel import complete')
      onRefresh()
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Excel import failed'
      setImportMessage(text)
      toast.error(text)
    } finally {
      setImportBusy(false)
    }
  }

  async function refreshBackupStatus(): Promise<void> {
    try {
      setBackupStatus(await window.api.getBackupStatus())
    } catch {
      /* ignore */
    }
  }

  async function runBackupNow(): Promise<void> {
    setBackupBusy(true)
    setBackupMessage(null)
    try {
      const result = await window.api.runBackupNow()
      if (!result.ok) {
        setBackupMessage(result.errorMessage ?? 'Backup failed')
        toast.error(result.errorMessage ?? 'Backup failed')
      } else {
        setBackupMessage(`Backup saved (${result.fileName}, ${result.fileSize})`)
        toast.success('Backup complete')
      }
      await refreshBackupStatus()
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Backup failed'
      setBackupMessage(text)
      toast.error(text)
    } finally {
      setBackupBusy(false)
    }
  }

  async function connectBackup(): Promise<void> {
    setBackupBusy(true)
    setBackupMessage(null)
    try {
      const status = await window.api.authenticateBackup()
      setBackupStatus(status)
      setBackupMessage(`Connected to ${status.providerLabel}`)
      toast.success(`Connected to ${status.providerLabel}`)
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Connect failed'
      setBackupMessage(text)
      toast.error(text)
    } finally {
      setBackupBusy(false)
    }
  }

  async function restoreFromFile(): Promise<void> {
    setBackupBusy(true)
    setBackupMessage(null)
    try {
      const result = await window.api.restoreBackupFromFile()
      if (!result.ok) {
        if (result.error !== 'Restore cancelled') {
          setBackupMessage(result.error)
          toast.error(result.error)
        }
        return
      }
      setBackupMessage('Database restored — relaunching…')
      toast.success('Restored — relaunching')
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Restore failed'
      setBackupMessage(text)
      toast.error(text)
    } finally {
      setBackupBusy(false)
    }
  }

  async function restoreFromCloud(): Promise<void> {
    setBackupBusy(true)
    setBackupMessage(null)
    try {
      const result = await window.api.restoreBackupFromCloud()
      if (!result.ok) {
        if (result.error !== 'Restore cancelled') {
          setBackupMessage(result.error)
          toast.error(result.error)
        }
        return
      }
      setBackupMessage('Cloud backup restored — relaunching…')
      toast.success('Restored — relaunching')
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Cloud restore failed'
      setBackupMessage(text)
      toast.error(text)
    } finally {
      setBackupBusy(false)
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

  async function toggleAarPromptOnPractice(): Promise<void> {
    if (!profile) return
    try {
      await window.api.updateProfile({ aarPromptOnPractice: !profile.aarPromptOnPractice })
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
      <PageHeader title="Settings" description="Profile, Features, And Preferences." />

      <div className="settings-bento">
      <section className="settings-panel settings-bento-about">
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

      <section className="settings-panel settings-bento-theme">
        <div className="section-header">
          <h2>Light / Dark</h2>
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

      <section className="settings-panel settings-bento-wide">
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

      <section className="settings-panel settings-bento-wide">
        <h2>Features / Tracking</h2>
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

        <div className="pref-row">
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={profile?.aarPromptOnPractice ?? false}
              onChange={() => void toggleAarPromptOnPractice()}
            />
            <span>Prompt for an AAR after Practice sessions</span>
          </label>
          <PreferenceInfoButton title="AAR after Practice">
            <p>
              Match sessions always offer an After-Action Review after save. Turn this on to also
              prompt after Practice logs.
            </p>
          </PreferenceInfoButton>
        </div>
      </section>

      <section className="settings-panel settings-bento-wide">
        <div className="section-header">
          <h2>AI API</h2>
        </div>
        <p className="muted">
          Bring your own key for Anthropic, OpenAI, xAI (Grok), or Groq. Usage is billed to your
          provider account — Materiel never hosts your data. Keys stay encrypted on this computer
          and are never sent back to the UI after save. Saving a key unlocks the AI View in the
          sidebar for armory Q&amp;A, training ideas, and assisted inventory fill-ins.
        </p>
        <p className="settings-note muted">{AI_PRIVACY_COPY.lead}</p>
        <p className="settings-note muted">{AI_SUBSCRIPTION_NOTE}</p>

        {!aiStatus && !aiError ? <p className="muted">Loading AI settings…</p> : null}

        {aiStatus ? (
          <div className="ai-settings">
            <div className="form-grid ai-settings-grid">
              <label className="field">
                <span className="field-label">Provider</span>
                <select
                  value={aiStatus.provider}
                  disabled={aiBusy}
                  onChange={(e) => void handleAiProviderChange(e.target.value as AiProviderId)}
                >
                  {AI_PROVIDER_IDS.map((id) => (
                    <option key={id} value={id}>
                      {AI_PROVIDER_LABELS[id]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field field-span">
                <span className="field-label">API key</span>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={aiBusy}
                  value={aiKeyDraft}
                  placeholder={
                    aiStatus.hasKey
                      ? `Saved · …${aiStatus.maskedSuffix ?? '????'}`
                      : 'Paste provider API key'
                  }
                  onChange={(e) => setAiKeyDraft(e.target.value)}
                />
                <span className="field-hint">{AI_PROVIDER_KEY_HINTS[aiStatus.provider]}</span>
              </label>

              <label className="field">
                <span className="field-label">Model</span>
                <select
                  value={aiStatus.model ?? ''}
                  disabled={aiBusy || !aiStatus.hasKey || aiModels.length === 0}
                  onChange={(e) => void handleAiModelChange(e.target.value)}
                >
                  {aiModels.length === 0 ? (
                    <option value="">
                      {aiStatus.hasKey ? 'Load models via Test / Re-check' : 'Save a key first'}
                    </option>
                  ) : null}
                  {aiStatus.model && !aiModels.some((m) => m.id === aiStatus.model) ? (
                    <option value={aiStatus.model}>{aiStatus.model}</option>
                  ) : null}
                  {aiModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {!aiStatus.encryptionAvailable ? (
              <p className="form-error settings-note">
                OS secure storage (safeStorage) is unavailable. In production Materiel will refuse
                to save API keys until encryption is available.
              </p>
            ) : null}

            <div className="row-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={aiBusy || !aiKeyDraft.trim()}
                onClick={() => void handleSaveAiKey()}
              >
                {aiBusy ? 'Working…' : 'Save key'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={aiBusy || !aiStatus.hasKey}
                onClick={() => void handleRemoveAiKey()}
              >
                Remove key
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={aiBusy || !aiStatus.hasKey}
                onClick={() => void handleTestAiConnection()}
              >
                Test connection
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={aiBusy || !aiStatus.hasKey}
                onClick={() => void handleTestAiConnection()}
              >
                Re-check
              </button>
            </div>

            <div className="ai-capability-panel">
              <h3 className="ai-capability-heading">Capability Status</h3>
              <ul className="ai-capability-list">
                <CapabilityRow label="API key" state={aiStatus.capabilities.apiKey} />
                <CapabilityRow label="Billing" state={aiStatus.capabilities.billing} />
                <CapabilityRow
                  label="Analysis ready"
                  state={aiStatus.capabilities.analysisReady}
                  detail="Basic"
                />
                <CapabilityRow
                  label="Vision"
                  state={aiStatus.capabilities.vision}
                  detail="Optional — used for COF image extraction (JPEG/PNG)"
                />
              </ul>
              {aiStatus.capabilities.checkedAt ? (
                <p className="muted settings-note">
                  Last checked {new Date(aiStatus.capabilities.checkedAt).toLocaleString()}
                </p>
              ) : (
                <p className="muted settings-note">
                  Run Test connection after saving a key to validate auth and billing.
                </p>
              )}
            </div>

            <div className="ai-privacy-panel">
              <h3 className="ai-capability-heading">AI data minimization</h3>
              <p className="muted settings-note">
                Defaults favor privacy. Serial numbers are never sent. Changes apply to AI View and
                future coach prompts.
              </p>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={aiPrivacy.includeLocations}
                  onChange={(e) => void patchAiPrivacy({ includeLocations: e.target.checked })}
                />
                <span>Include locations / venues in AI prompts</span>
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={aiPrivacy.includeNotes}
                  onChange={(e) => void patchAiPrivacy({ includeNotes: e.target.checked })}
                />
                <span>Include free-text notes in AI prompts</span>
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={aiPrivacy.includeEquipmentDetail}
                  onChange={(e) =>
                    void patchAiPrivacy({ includeEquipmentDetail: e.target.checked })
                  }
                />
                <span>Include manufacturer / model / caliber detail</span>
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={aiPrivacy.confirmBeforeSend}
                  onChange={(e) => void patchAiPrivacy({ confirmBeforeSend: e.target.checked })}
                />
                <span>Confirm before each AI request leaves this computer</span>
              </label>
            </div>

            {aiMessage ? <p className="settings-note">{aiMessage}</p> : null}
            {aiError ? <p className="form-error">{aiError}</p> : null}
          </div>
        ) : aiError ? (
          <p className="form-error">{aiError}</p>
        ) : null}
      </section>

      <section className="settings-panel settings-bento-wide">
        <div className="section-header">
          <h2>App unlock</h2>
        </div>
        <p className="muted settings-note">
          Optional passphrase required each time Materiel launches. The database encryption key is
          wrapped with your passphrase (scrypt + AES-GCM). If you forget it, this copy of the
          database cannot be opened — keep a backup you trust.
        </p>
        {!unlockEnabled ? (
          <div className="form-grid">
            <label className="field">
              <span className="field-label">New passphrase</span>
              <input
                type="password"
                autoComplete="new-password"
                value={unlockPassphrase}
                disabled={unlockBusy}
                onChange={(e) => setUnlockPassphrase(e.target.value)}
                placeholder={`At least ${UNLOCK_MIN_LENGTH} characters`}
              />
            </label>
            <label className="field">
              <span className="field-label">Confirm passphrase</span>
              <input
                type="password"
                autoComplete="new-password"
                value={unlockConfirm}
                disabled={unlockBusy}
                onChange={(e) => setUnlockConfirm(e.target.value)}
              />
            </label>
            <div className="row-actions field-span">
              <button
                type="button"
                className="btn-primary"
                disabled={unlockBusy || !unlockPassphrase || !unlockConfirm}
                onClick={() => void handleEnableUnlock()}
              >
                {unlockBusy ? 'Working…' : 'Enable unlock passphrase'}
              </button>
            </div>
          </div>
        ) : (
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Current passphrase</span>
              <input
                type="password"
                autoComplete="current-password"
                value={unlockCurrent}
                disabled={unlockBusy}
                onChange={(e) => setUnlockCurrent(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">New passphrase</span>
              <input
                type="password"
                autoComplete="new-password"
                value={unlockNext}
                disabled={unlockBusy}
                onChange={(e) => setUnlockNext(e.target.value)}
                placeholder={`At least ${UNLOCK_MIN_LENGTH} characters`}
              />
            </label>
            <label className="field">
              <span className="field-label">Confirm new passphrase</span>
              <input
                type="password"
                autoComplete="new-password"
                value={unlockNextConfirm}
                disabled={unlockBusy}
                onChange={(e) => setUnlockNextConfirm(e.target.value)}
              />
            </label>
            <div className="row-actions field-span">
              <button
                type="button"
                className="btn-primary"
                disabled={unlockBusy || !unlockCurrent || !unlockNext || !unlockNextConfirm}
                onClick={() => void handleChangeUnlock()}
              >
                {unlockBusy ? 'Working…' : 'Change passphrase'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={unlockBusy || !unlockCurrent}
                onClick={() => void handleDisableUnlock()}
              >
                Disable unlock
              </button>
            </div>
          </div>
        )}
        {unlockMessage ? <p className="settings-note">{unlockMessage}</p> : null}
        {unlockError ? <p className="form-error">{unlockError}</p> : null}
      </section>

      <section className="settings-panel settings-bento-wide">
        <div className="section-header">
          <h2>Backup &amp; restore</h2>
        </div>
        <p className="settings-note">
          Encrypted database backups go to {backupStatus?.providerLabel ?? 'your backup provider'}.
          Restore replaces the local database (a safety copy is kept) and relaunches Materiel. AI
          API keys are not included in backups.
        </p>
        <p className="muted settings-note">
          Provider: <strong>{backupStatus?.providerLabel ?? '…'}</strong>
          {backupStatus
            ? ` · ${backupStatus.authenticated ? 'connected' : 'not connected'}${
                backupStatus.settings.lastBackupTime
                  ? ` · last backup ${new Date(backupStatus.settings.lastBackupTime).toLocaleString()}`
                  : ''
              }`
            : ''}
        </p>
        <div className="row-actions">
          {!backupStatus?.authenticated ? (
            <button
              type="button"
              className="btn-primary"
              disabled={backupBusy || backupStatus?.configured === false}
              onClick={() => void connectBackup()}
            >
              {backupBusy ? 'Working…' : 'Connect backup'}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={backupBusy}
              onClick={() => void runBackupNow()}
            >
              {backupBusy ? 'Working…' : 'Back up now'}
            </button>
          )}
          <button
            type="button"
            className="btn-ghost"
            disabled={backupBusy}
            onClick={() => void restoreFromFile()}
          >
            Restore from file…
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={backupBusy || !backupStatus?.authenticated}
            onClick={() => void restoreFromCloud()}
          >
            Restore latest cloud…
          </button>
        </div>
        {backupMessage ? <p className="settings-note">{backupMessage}</p> : null}
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

      <section className="settings-panel settings-bento-wide">
        <div className="section-header">
          <h2>Import / Export</h2>
        </div>
        <p className="settings-note">
          <strong>Download sample</strong> gives you a filled workbook (Instructions + Inventory /
          Builds / Logs / Ammo). Edit it in Excel or Google Sheets (File → Download → .xlsx), then{' '}
          <strong>Import Excel</strong>. Existing IDs are reused; new rows are added. Summary and
          Round Counts sheets are ignored on import.
        </p>
        <p className="muted settings-note">
          <strong>Export Excel</strong> packs Summary, Inventory, Builds, Logs, Round Counts, and
          Ammo — same headers the importer expects, so round-tripping works.
        </p>
        <p className="form-error settings-note">{EXPORT_PLAINTEXT_WARNING}</p>
        <div className="row-actions">
          <button
            type="button"
            className="btn-ghost btn-with-icon"
            disabled={sampleBusy || importBusy}
            onClick={() => void downloadSampleExcel()}
          >
            <Icon name="share" size={16} />
            {sampleBusy ? 'Saving sample…' : 'Download sample Excel…'}
          </button>
          <button
            type="button"
            className="btn-primary btn-with-icon"
            disabled={importBusy || sampleBusy}
            onClick={() => void importExcelFile()}
          >
            <Icon name="add" size={16} />
            {importBusy ? 'Importing…' : 'Import Excel…'}
          </button>
          <button
            type="button"
            className="btn-ghost btn-with-icon"
            disabled={exportBusy}
            onClick={() => void exportExcelFile()}
          >
            <Icon name="share" size={16} />
            {exportBusy ? 'Packing bags…' : 'Export Excel…'}
          </button>
        </div>
        {importMessage ? <p className="settings-note">{importMessage}</p> : null}
        {exportMessage ? <p className="settings-note">{exportMessage}</p> : null}
      </section>
      </div>
    </div>
  )
}
