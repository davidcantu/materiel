import { useCallback, useEffect, useState } from 'react'
import type { DashboardSummary } from '../../../shared/dashboard'
import { PageFeedback } from '../components/PageFeedback'
import { PageHeader } from '../components/PageHeader'
import { formatCurrency } from '../lib/format'

type DashboardPageProps = {
  onNavigateLogs: () => void
}

function formatLogDate(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function DashboardPage({ onNavigateLogs }: DashboardPageProps): React.JSX.Element {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await window.api.getDashboard()
      setSummary(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void window.api
      .getDashboard()
      .then((next) => {
        if (!cancelled) {
          setSummary(next)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading && !summary) {
    return (
      <div className="page">
        <PageHeader
          title="Dashboard"
          description="Your firearms, rounds, and maintenance at a glance."
        />
        <PageFeedback loading loadingLabel="Loading dashboard…" />
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="page">
        <PageHeader
          title="Dashboard"
          description="Your firearms, rounds, and maintenance at a glance."
          actions={
            <button type="button" className="btn-ghost" onClick={() => void load()}>
              Retry
            </button>
          }
        />
        <PageFeedback error={error} onRetry={() => void load()} />
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="page">
        <PageHeader title="Dashboard" />
        <PageFeedback error="Unable to load dashboard." onRetry={() => void load()} />
      </div>
    )
  }

  const title = summary.firstName ? `Welcome back, ${summary.firstName}` : 'Welcome'
  const maxMonthRounds = Math.max(1, ...summary.monthlyRounds.map((m) => m.rounds))

  return (
    <div className="page dashboard-page">
      <PageHeader title={title} description="Your firearms, rounds, and maintenance at a glance." />

      <section className="dash-top" aria-label="Key metrics">
        <div className={`kpi-grid${summary.trackValue ? ' kpi-grid-4' : ' kpi-grid-3'}`}>
          <article className="kpi-card">
            <div className="kpi-label">Total Rounds</div>
            <div className="kpi-value">{summary.totalRounds.toLocaleString()}</div>
          </article>
          <article className="kpi-card">
            <div className="kpi-label">Active Systems</div>
            <div className="kpi-value">{summary.activeSystems.toLocaleString()}</div>
          </article>
          <article className="kpi-card">
            <div className="kpi-label">Inventory Items</div>
            <div className="kpi-value">{summary.inventoryItems.toLocaleString()}</div>
          </article>
          {summary.trackValue ? (
            <article className="kpi-card">
              <div className="kpi-label">Total Value</div>
              <div className="kpi-value">{formatCurrency(summary.totalValue)}</div>
            </article>
          ) : null}
        </div>
      </section>

      <section className="dash-main">
        <div className="dash-main-left">
          <article className="dash-panel">
            <header className="dash-panel-header">
              <div>
                <h2>Shooting Activity</h2>
                <p className="dash-panel-sub">Rounds fired per month (trailing 12 months)</p>
              </div>
            </header>
            <div className="activity-chart" role="img" aria-label="Trailing 12 month rounds chart">
              {summary.monthlyRounds.map((month) => {
                const height =
                  month.rounds > 0
                    ? Math.max(8, Math.round((month.rounds / maxMonthRounds) * 100))
                    : 6
                return (
                  <div key={month.key} className="activity-bar-col">
                    <div
                      className={`activity-bar${month.rounds > 0 ? '' : ' activity-bar-zero'}`}
                      style={{ height: `${height}%` }}
                      title={`${month.fullLabel}: ${month.rounds} rounds`}
                    />
                    <span className="activity-bar-label">{month.label}</span>
                  </div>
                )
              })}
            </div>
          </article>

          <article className="dash-panel">
            <header className="dash-panel-header">
              <h2>Recent Activity</h2>
              <button type="button" className="btn-link" onClick={onNavigateLogs}>
                View all
              </button>
            </header>
            {summary.recentActivity.length === 0 ? (
              <p className="muted dash-empty">No recent activity logged.</p>
            ) : (
              <ul className="activity-list">
                {summary.recentActivity.map((item) => (
                  <li key={item.id} className="activity-row">
                    <div>
                      <div className="cell-title">{item.systemName}</div>
                      <div className="cell-meta">
                        {item.location} · {formatLogDate(item.date)}
                      </div>
                      <div className="muted">{item.cartridgeLabel}</div>
                    </div>
                    <span className="rounds-badge">+{item.roundsFired}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>

        <aside className="dash-main-right">
          <article className="dash-panel">
            <header className="dash-panel-header">
              <h2>Maintenance Alerts</h2>
            </header>
            {summary.maintenanceAlerts.length === 0 ? (
              <p className="muted dash-empty">No parts currently tracked for maintenance.</p>
            ) : (
              <ul className="alert-list">
                {summary.maintenanceAlerts.map((alert) => (
                  <li key={alert.partId} className="alert-row">
                    <div className="alert-row-top">
                      <div>
                        <div className="cell-title">{alert.title}</div>
                        <div className="muted">{alert.kind}</div>
                      </div>
                      <span className={`alert-pct${alert.percent > 90 ? ' alert-pct-high' : ''}`}>
                        {alert.percent}%
                      </span>
                    </div>
                    <div className={`progress-track tone-${alert.tone}`}>
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.min(alert.percent, 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </aside>
      </section>
    </div>
  )
}
