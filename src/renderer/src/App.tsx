import { useCallback, useEffect, useState } from 'react'
import type { AppInfo } from '../../shared/app-info'
import type { LicenseStatusInfo } from '../../shared/license'
import type { ProfileInfo } from '../../shared/profile'
import { BuildsPage } from './pages/BuildsPage'
import { InventoryPage } from './pages/InventoryPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { SettingsPage } from './pages/SettingsPage'

type NavId = 'dashboard' | 'inventory' | 'builds' | 'logs' | 'ammo' | 'settings'

const NAV_ITEMS: Array<{ id: NavId; label: string; enabled: boolean }> = [
  { id: 'dashboard', label: 'Dashboard', enabled: false },
  { id: 'inventory', label: 'Inventory', enabled: true },
  { id: 'builds', label: 'Complete Builds', enabled: true },
  { id: 'logs', label: 'Logs', enabled: false },
  { id: 'ammo', label: 'Ammo', enabled: false },
  { id: 'settings', label: 'Settings', enabled: true }
]

function App(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [license, setLicense] = useState<LicenseStatusInfo | null>(null)
  const [profile, setProfile] = useState<ProfileInfo | null>(null)
  const [active, setActive] = useState<NavId>('inventory')

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
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item${active === item.id ? ' active' : ''}${item.enabled ? '' : ' muted'}`}
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
        {active === 'inventory' ? <InventoryPage trackValue={profile?.trackValue ?? true} /> : null}
        {active === 'builds' ? (
          <BuildsPage
            trackValue={profile?.trackValue ?? true}
            license={license}
            onLicenseChange={() => void refresh()}
          />
        ) : null}
        {active === 'settings' ? (
          <SettingsPage license={license} profile={profile} onRefresh={() => void refresh()} />
        ) : null}
        {active === 'dashboard' ? (
          <PlaceholderPage
            title="Dashboard"
            blurb="Overview and maintenance alerts arrive in a later module."
          />
        ) : null}
        {active === 'logs' ? (
          <PlaceholderPage title="Shooting Logs" blurb="Session logging lands next." />
        ) : null}
        {active === 'ammo' ? (
          <PlaceholderPage title="Ammo & Reloading" blurb="Ammo inventory and loads come later." />
        ) : null}
      </main>
    </div>
  )
}

export default App
