import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppInfo } from '../../shared/app-info'
import { hasLocalIdentity, needsOnboarding, type ProfileInfo } from '../../shared/profile'
import { BrandLogo } from './components/BrandLogo'
import { Icon } from './components/icons/Icon'
import { NAV_ICONS } from './components/icons/nav-icons'
import { ToastProvider } from './components/Toast'
import {
  applyThemePreference,
  getStoredThemePreference,
  subscribeSystemTheme,
  type ThemePreference
} from './lib/theme'
import { AarsPage } from './pages/AarsPage'
import { AiPage } from './pages/AiPage'
import { AmmoPage } from './pages/AmmoPage'
import { BuildsPage } from './pages/BuildsPage'
import { DashboardPage } from './pages/DashboardPage'
import { InventoryPage } from './pages/InventoryPage'
import { LogsPage } from './pages/LogsPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { SettingsPage } from './pages/SettingsPage'
import { UnlockPage } from './pages/UnlockPage'
import { WelcomePage } from './pages/WelcomePage'
import { AAR_NAV_LABEL } from '../../shared/aar-template'

type NavId = 'dashboard' | 'inventory' | 'builds' | 'logs' | 'aars' | 'ammo' | 'ai' | 'settings'

type NavItem = { id: NavId; label: string; enabled: boolean; visible?: boolean }

function AppShell(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [profile, setProfile] = useState<ProfileInfo | null>(null)
  const [active, setActive] = useState<NavId>('dashboard')
  const [bootstrapped, setBootstrapped] = useState(false)
  const [needsUnlock, setNeedsUnlock] = useState(false)
  const [openAarId, setOpenAarId] = useState<string | null>(null)
  const [aiUnlocked, setAiUnlocked] = useState(false)
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    getStoredThemePreference()
  )

  const trackAmmo = profile?.trackAmmo ?? true
  const trackLoads = profile?.trackLoads ?? true
  const showAmmoNav = trackAmmo || trackLoads
  const view: NavId =
    (!showAmmoNav && active === 'ammo') || (!aiUnlocked && active === 'ai')
      ? 'dashboard'
      : active
  const needsSetup = bootstrapped && !hasLocalIdentity(profile)
  const needsPrefs = bootstrapped && needsOnboarding(profile)

  useEffect(() => {
    applyThemePreference(themePreference)
    if (themePreference !== 'system') return undefined
    return subscribeSystemTheme(() => {
      applyThemePreference('system')
    })
  }, [themePreference])

  const navItems = useMemo<NavItem[]>(
    () => [
      { id: 'dashboard', label: 'Dashboard', enabled: true },
      { id: 'inventory', label: 'Inventory', enabled: true },
      { id: 'builds', label: 'Builds', enabled: true },
      { id: 'logs', label: 'Logs', enabled: true },
      { id: 'aars', label: AAR_NAV_LABEL, enabled: true },
      { id: 'ammo', label: 'Ammo', enabled: true, visible: showAmmoNav },
      { id: 'ai', label: 'AI', enabled: true, visible: aiUnlocked },
      { id: 'settings', label: 'Settings', enabled: true }
    ],
    [showAmmoNav, aiUnlocked]
  )

  const refreshAiUnlock = useCallback(async () => {
    try {
      const status = await window.api.getAiStatus()
      setAiUnlocked(Boolean(status.hasKey))
    } catch {
      setAiUnlocked(false)
    }
  }, [])

  const bootstrapApp = useCallback(async () => {
    const [nextInfo, nextProfile, aiStatus] = await Promise.all([
      window.api.getAppInfo(),
      window.api.getProfile(),
      window.api.getAiStatus().catch(() => null)
    ])
    setInfo(nextInfo)
    setProfile(nextProfile)
    setAiUnlocked(Boolean(aiStatus?.hasKey))
    setNeedsUnlock(false)
    setBootstrapped(true)
  }, [])

  const refresh = useCallback(async () => {
    const [nextInfo, nextProfile] = await Promise.all([
      window.api.getAppInfo(),
      window.api.getProfile()
    ])
    setInfo(nextInfo)
    setProfile(nextProfile)
    await refreshAiUnlock()
  }, [refreshAiUnlock])

  useEffect(() => {
    let cancelled = false
    void window.api
      .getUnlockStatus()
      .then(async (status) => {
        if (cancelled) return
        if (status.required && !status.unlocked) {
          setNeedsUnlock(true)
          setBootstrapped(true)
          return
        }
        await bootstrapApp()
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err)
          // Fall through to normal boot if unlock status is unavailable.
          void bootstrapApp().catch((bootErr) => {
            console.error(bootErr)
            setBootstrapped(true)
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [bootstrapApp])

  if (!bootstrapped) {
    return (
      <div className="welcome-gate welcome-loading">
        <p className="muted">Opening Materiel…</p>
      </div>
    )
  }

  if (needsUnlock) {
    return (
      <UnlockPage
        onUnlocked={() => {
          void bootstrapApp()
        }}
      />
    )
  }

  if (needsSetup) {
    return <WelcomePage onComplete={() => void refresh()} />
  }

  if (needsPrefs) {
    return <OnboardingPage onComplete={() => void refresh()} />
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandLogo className="brand-logo-sidebar" alt="Materiel" />
          <div className="brand-tagline">Firearms tracker</div>
        </div>

        <nav className="nav" aria-label="Primary">
          {navItems
            .filter((item) => item.visible !== false)
            .map((item) => {
              const isActive = view === item.id
              const iconName = NAV_ICONS[item.id]
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-item${isActive ? ' active' : ''}${item.enabled ? '' : ' muted'}`}
                  disabled={!item.enabled}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => item.enabled && setActive(item.id)}
                >
                  <span className="nav-icon" aria-hidden="true">
                    {iconName ? <Icon name={iconName} size={18} /> : null}
                  </span>
                  {item.label}
                </button>
              )
            })}
        </nav>

        <div className="sidebar-meta">
          <div>
            Env: <strong>{info?.env ?? '…'}</strong>
          </div>
          <div>
            User: <strong>{profile?.email || '…'}</strong>
          </div>
        </div>
      </aside>

      <main className="main">
        {view === 'dashboard' ? (
          <DashboardPage
            onNavigateLogs={() => setActive('logs')}
            onNavigateInventory={() => setActive('inventory')}
            onNavigateBuilds={() => setActive('builds')}
            onNavigateAars={() => setActive('aars')}
          />
        ) : null}
        {view === 'inventory' ? (
          <InventoryPage
            trackValue={profile?.trackValue ?? true}
            trackedPlatforms={profile?.trackedPlatforms}
          />
        ) : null}
        {view === 'builds' ? (
          <BuildsPage
            trackValue={profile?.trackValue ?? true}
            trackedPlatforms={profile?.trackedPlatforms}
            onNavigateInventory={() => setActive('inventory')}
          />
        ) : null}
        {view === 'logs' ? (
          <LogsPage
            onNavigateBuilds={() => setActive('builds')}
            profile={profile}
            onOpenAar={(aarId) => {
              setOpenAarId(aarId)
              setActive('aars')
            }}
          />
        ) : null}
        {view === 'aars' ? (
          <AarsPage
            initialAarId={openAarId}
            onConsumedInitial={() => setOpenAarId(null)}
          />
        ) : null}
        {view === 'ammo' && showAmmoNav ? (
          <AmmoPage trackAmmo={trackAmmo} trackLoads={trackLoads} />
        ) : null}
        {view === 'ai' && aiUnlocked ? (
          <AiPage onNavigateSettings={() => setActive('settings')} />
        ) : null}
        {view === 'settings' ? (
          <SettingsPage
            profile={profile}
            onRefresh={() => void refresh()}
            themePreference={themePreference}
            onThemePreferenceChange={setThemePreference}
          />
        ) : null}
      </main>
    </div>
  )
}

function App(): React.JSX.Element {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  )
}

export default App
