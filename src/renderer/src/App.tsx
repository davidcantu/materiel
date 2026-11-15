import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppInfo } from '../../shared/app-info'
import type { LicenseStatusInfo } from '../../shared/license'
import type { ProfileInfo } from '../../shared/profile'
import { AmmoPage } from './pages/AmmoPage'
import { BuildsPage } from './pages/BuildsPage'
import { InventoryPage } from './pages/InventoryPage'
import { LogsPage } from './pages/LogsPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { SettingsPage } from './pages/SettingsPage'

type NavId = 'dashboard' | 'inventory' | 'builds' | 'logs' | 'ammo' | 'settings'

type NavItem = { id: NavId; label: string; enabled: boolean; visible?: boolean }

function App(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [license, setLicense] = useState<LicenseStatusInfo | null>(null)
  const [profile, setProfile] = useState<ProfileInfo | null>(null)
  const [active, setActive] = useState<NavId>('inventory')

  const trackAmmo = profile?.trackAmmo ?? true
  const view: NavId = !trackAmmo && active === 'ammo' ? 'inventory' : active

  const navItems = useMemo<NavItem[]>(
    () => [
      { id: 'dashboard', label: 'Dashboard', enabled: false },
      { id: 'inventory', label: 'Inventory', enabled: true },
      { id: 'builds', label: 'Complete Builds', enabled: true },
      { id: 'logs', label: 'Shooting Logs', enabled: true },
      { id: 'ammo', label: 'Ammo & Reloading', enabled: true, visible: trackAmmo },
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
      })
      .catch((err) => {
        if (!cancelled) console.error(err)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
            .map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-item${view === item.id ? ' active' : ''}${item.enabled ? '' : ' muted'}`}
                disabled={!item.enabled}
                onClick={() => item.enabled && setActive(item.id)}
              >
                <span className="nav-dot" aria-hidden="true" />
                {item.label}
              </button>
            ))}
        </nav>

        <div className="sidebar-meta">
          <div>
            Env: <strong>{info?.env ?? '…'}</strong>
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
        {view === 'inventory' ? <InventoryPage trackValue={profile?.trackValue ?? true} /> : null}
        {view === 'builds' ? (
          <BuildsPage
            trackValue={profile?.trackValue ?? true}
            license={license}
            onLicenseChange={() => void refresh()}
          />
        ) : null}
        {view === 'logs' ? <LogsPage /> : null}
        {view === 'ammo' && trackAmmo ? <AmmoPage /> : null}
        {view === 'settings' ? (
          <SettingsPage license={license} profile={profile} onRefresh={() => void refresh()} />
        ) : null}
        {view === 'dashboard' ? (
          <PlaceholderPage
            title="Dashboard"
            blurb="Overview and maintenance alerts arrive in a later module."
          />
        ) : null}
      </main>
    </div>
  )
}

export default App
