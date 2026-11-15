import { useEffect, useState } from 'react'
import type { AppInfo } from '../../shared/app-info'

const NAV_ITEMS = ['Dashboard', 'Inventory', 'Builds', 'Logs', 'Ammo', 'Settings'] as const

function App(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.getAppInfo().then((next) => {
      if (!cancelled) setInfo(next)
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
          {NAV_ITEMS.map((item, index) => (
            <button
              key={item}
              type="button"
              className={`nav-item${index === 0 ? ' active' : ''}`}
              disabled={index !== 0}
            >
              <span className="nav-dot" aria-hidden="true" />
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-meta">
          <div>
            Env: <strong>{info?.env ?? '…'}</strong>
          </div>
          <div>
            Backup: <strong>{info?.backupProvider ?? '…'}</strong>
          </div>
          <div>
            License:{' '}
            <strong>
              {info
                ? `${info.license.tier}${info.license.mode === 'unlocked' ? ' · unlocked' : ''} (${info.license.completeRifleCount}/${info.license.freeRifleLimit} free)`
                : '…'}
            </strong>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="main-header">
          <h1>Dashboard</h1>
          <p>
            Local-first scaffold is running. Inventory, builds, logs, and ammo modules land in
            follow-up PRs — this shell establishes process layout, brand tokens, and stub services.
          </p>
        </header>

        <section className="placeholder" aria-label="Scaffold status">
          <h2>Coming next</h2>
          <ul>
            <li>Settings UI for backup / license activate (IPC ready)</li>
            <li>Feature modules from the software spec</li>
          </ul>
        </section>
      </main>
    </div>
  )
}

export default App
