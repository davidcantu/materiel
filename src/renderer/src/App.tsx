import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppInfo } from '../../shared/app-info'
import type { LicenseStatusInfo } from '../../shared/license'
import { hasLocalUsername, type ProfileInfo } from '../../shared/profile'
import { ToastProvider } from './components/Toast'
import { AmmoPage } from './pages/AmmoPage'
import { BuildsPage } from './pages/BuildsPage'
import { DashboardPage } from './pages/DashboardPage'
import { InventoryPage } from './pages/InventoryPage'
import { LogsPage } from './pages/LogsPage'
import { SettingsPage } from './pages/SettingsPage'
import { WelcomePage } from './pages/WelcomePage'

type NavId = 'dashboard' | 'inventory' | 'builds' | 'logs' | 'ammo' | 'settings'

type NavItem = { id: NavId; label: string; enabled: boolean; visible?: boolean }

function AppShell(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [license, setLicense] = useState<LicenseStatusInfo | null>(null)
  const [profile, setProfile] = useState<ProfileInfo | null>(null)
  const [active, setActive] = useState<NavId>('dashboard')
  const [bootstrapped, setBootstrapped] = useState(false)

  const trackAmmo = profile?.trackAmmo ?? true
  const view: NavId = !trackAmmo && active === 'ammo' ? 'dashboard' : active
  const needsSetup = bootstrapped && !hasLocalUsername(profile)

  const navItems = useMemo<NavItem[]>(
    () => [
      { id: 'dashboard', label: 'Dashboard', enabled: true },
      { id: 'inventory', label: 'Inventory', enabled: true },
      { id: 'builds', label: 'Builds', enabled: true },
      { id: 'logs', label: 'Logs', enabled: true },
      { id: 'ammo', label: 'Ammo', enabled: true, visible: trackAmmo },
      { id: 'settings', label: 'Settings', enabled: true }
    ],
    [trackAmmo]
  )

  const refresh = useCallback(async () => {
    const [nextInfo, nextLicense, nextProfile] = await Promise.all([
      window.api.getAppInfo(),
      window.api.getLicenseStatus(),
      window.api.getProfile()
    ])
    setInfo(nextInfo)
    setLicense(nextLicense)
    setProfile(nextProfile)
  }, [])

  useEffect(() => {
    let cancelled = false
    void window.api
      .getAppInfo()
      .then(async (nextInfo) => {
        const [nextLicense, nextProfile] = await Promise.all([
          window.api.getLicenseStatus(),
          window.api.getProfile()
        ])
        if (cancelled) return
        setInfo(nextInfo)
        setLicense(nextLicense)
        setProfile(nextProfile)
        setBootstrapped(true)
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err)
          setBootstrapped(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!bootstrapped) {
    return (
      <div className="welcome-gate welcome-loading">
        <p className="muted">Opening Materiel…</p>
      </div>
    )
  }

  if (needsSetup) {
    return <WelcomePage onComplete={() => void refresh()} />
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <div className="brand-title">Materiel</div>
          <div className="brand-tagline">Precision rifle tracker</div>
        </div>

        <nav className="nav" aria-label="Primary">
          {navItems
            .filter((item) => item.visible !== false)
            .map((item) => {
              const isActive = view === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-item${isActive ? ' active' : ''}${item.enabled ? '' : ' muted'}`}
                  disabled={!item.enabled}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => item.enabled && setActive(item.id)}
                >
                  <span className="nav-dot" aria-hidden="true" />
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
            User: <strong>{profile?.username || '…'}</strong>
          </div>
          <div>
            License:{' '}
            <strong>
              {license
                ? `${license.tier}${license.mode === 'unlocked' ? ' · unlocked' : ''} (${license.completeRifleCount}/${license.freeRifleLimit})`
                : '…'}
            </strong>
          </div>
        </div>
      </aside>

      <main className="main">
        {view === 'dashboard' ? <DashboardPage onNavigateLogs={() => setActive('logs')} /> : null}
        {view === 'inventory' ? <InventoryPage trackValue={profile?.trackValue ?? true} /> : null}
        {view === 'builds' ? (
          <BuildsPage
            trackValue={profile?.trackValue ?? true}
            license={license}
            onLicenseChange={() => void refresh()}
          />
        ) : null}
        {view === 'logs' ? <LogsPage onNavigateBuilds={() => setActive('builds')} /> : null}
        {view === 'ammo' && trackAmmo ? <AmmoPage /> : null}
        {view === 'settings' ? (
          <SettingsPage license={license} profile={profile} onRefresh={() => void refresh()} />
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
