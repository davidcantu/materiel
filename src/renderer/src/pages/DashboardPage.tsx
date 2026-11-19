import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ActivityWindow,
  DashboardSummary,
  DashboardTrendWindow,
  MonthlyRounds
} from '../../../shared/dashboard'
import { sliceMatchTrends } from '../../../shared/dashboard'
import type { MilestonesSummary, MilestoneStatus, MilestoneTier } from '../../../shared/milestones'
import { MILESTONE_TIER_LABELS } from '../../../shared/milestones'
import { formatPercentOfWinner, formatPlacement } from '../../../shared/shooting-logs'
import { PageFeedback } from '../components/PageFeedback'
import { PageHeader } from '../components/PageHeader'
import { formatCurrency } from '../lib/format'

type DashboardPageProps = {
  onNavigateLogs: () => void
}

const TREND_WINDOWS: Array<{ id: DashboardTrendWindow; label: string }> = [
  { id: 10, label: '10' },
  { id: 20, label: '20' },
  { id: 50, label: '50' },
  { id: 'all', label: 'All' }
]

const ACTIVITY_WINDOWS: Array<{ id: ActivityWindow; label: string }> = [
  { id: '3m', label: '3 Months' },
  { id: '1y', label: '1 Year' },
  { id: '2y', label: '2 Years' },
  { id: 'lifetime', label: 'Lifetime' }
]

function sliceActivityMonths(months: MonthlyRounds[], window: ActivityWindow): MonthlyRounds[] {
  if (window === 'lifetime') return months
  const n = window === '3m' ? 3 : window === '1y' ? 12 : 24
  return months.slice(-n)
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

export function DashboardPage({ onNavigateLogs: _onNavigateLogs }: DashboardPageProps): React.JSX.Element {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [milestones, setMilestones] = useState<MilestonesSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [placementWindow, setPlacementWindow] = useState<DashboardTrendWindow>(10)
  const [percentWindow, setPercentWindow] = useState<DashboardTrendWindow>(10)
  const [activityWindow, setActivityWindow] = useState<ActivityWindow>('1y')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [next, nextMilestones] = await Promise.all([
        window.api.getDashboard(),
        window.api.getMilestones()
      ])
      setSummary(next)
      setMilestones(nextMilestones)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed To Load Dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const activityMonths = useMemo(
    () => (summary ? sliceActivityMonths(summary.monthlyRounds, activityWindow) : []),
    [summary, activityWindow]
  )

  const placementTrend = useMemo(
    () => (summary ? sliceMatchTrends(summary.matchTrends, placementWindow) : []),
    [summary, placementWindow]
  )
  const percentTrend = useMemo(
    () => (summary ? sliceMatchTrends(summary.matchTrends, percentWindow) : []),
    [summary, percentWindow]
  )

  const milestonesByTier = useMemo(() => {
    if (!milestones) return null
    const tiers = Object.keys(MILESTONE_TIER_LABELS) as MilestoneTier[]
    return tiers.map((tier) => ({
      tier,
      label: MILESTONE_TIER_LABELS[tier],
      items: milestones.milestones.filter((m) => m.tier === tier)
    }))
  }, [milestones])

  if (loading && !summary) {
    return (
      <div className="page">
        <PageHeader
          title="Dashboard"
          description="Your Firearms, Rounds, And Builds At A Glance."
        />
        <PageFeedback loading loadingLabel="Loading Dashboard…" />
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="page">
        <PageHeader
          title="Dashboard"
          description="Your Firearms, Rounds, And Builds At A Glance."
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
        <PageFeedback error="Unable To Load Dashboard." onRetry={() => void load()} />
      </div>
    )
  }

  const title = summary.firstName ? `Welcome Back, ${summary.firstName}` : 'Welcome'
  const maxMonthRounds = Math.max(1, ...activityMonths.map((m) => m.rounds))
  const placementPoints = placementTrend.filter((p) => p.placement != null)
  const percentPoints = percentTrend.filter((p) => p.percentOfWinner != null)
  const maxPlace = Math.max(1, ...placementPoints.map((p) => p.placement ?? 1))
  const kpiClass = [
    'kpi-grid',
    summary.trackValue && summary.trackAmmo
      ? 'kpi-grid-5'
      : summary.trackValue || summary.trackAmmo
        ? 'kpi-grid-4'
        : 'kpi-grid-3'
  ].join(' ')

  return (
    <div className="page dashboard-page">
      <PageHeader title={title} description="Your Firearms, Rounds, And Builds At A Glance." />

      <section className="dash-top" aria-label="Key Metrics">
        <div className={kpiClass}>
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
          {summary.trackAmmo && summary.ammoRoundsTotal != null ? (
            <article className="kpi-card">
              <div className="kpi-label">Ammo Inventory</div>
              <div className="kpi-value">
                {summary.ammoRoundsTotal.toLocaleString()}{' '}
                <span className="kpi-unit">Rounds</span>
              </div>
            </article>
          ) : null}
          {summary.trackValue ? (
            <article className="kpi-card">
              <div className="kpi-label">Total Value</div>
              <div className="kpi-value">{formatCurrency(summary.totalValue)}</div>
            </article>
          ) : null}
        </div>
      </section>

      <section className="dash-main dash-main-single">
        <div className="dash-main-left">
          <article className="dash-panel">
            <header className="dash-panel-header dash-panel-header-stack">
              <div>
                <h2>Shooting Activity</h2>
                <p className="dash-panel-sub">Rounds Fired Per Month</p>
              </div>
              <div className="chip-row" role="group" aria-label="Activity Window">
                {ACTIVITY_WINDOWS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`chip${activityWindow === opt.id ? ' active' : ''}`}
                    onClick={() => setActivityWindow(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </header>
            <div className="activity-chart" role="img" aria-label="Shooting Activity Chart">
              {activityMonths.map((month) => {
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
            <header className="dash-panel-header dash-panel-header-stack">
              <div>
                <h2>Placement Trend</h2>
                <p className="dash-panel-sub">Match Place Over Last N Matches (Lower Is Better)</p>
              </div>
              <div className="chip-row" role="group" aria-label="Placement Window">
                {TREND_WINDOWS.map((opt) => (
                  <button
                    key={`place-${opt.id}`}
                    type="button"
                    className={`chip${placementWindow === opt.id ? ' active' : ''}`}
                    onClick={() => setPlacementWindow(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </header>
            {placementPoints.length === 0 ? (
              <p className="muted dash-empty">Log Match Sessions With A Place To See This Trend.</p>
            ) : (
              <div className="trend-chart" role="img" aria-label="Match Placement Trend">
                {placementPoints.map((point) => {
                  const place = point.placement ?? 0
                  const height = Math.max(8, Math.round(((maxPlace + 1 - place) / maxPlace) * 100))
                  return (
                    <div key={point.id} className="trend-bar-col">
                      <div
                        className="trend-bar"
                        style={{ height: `${height}%` }}
                        title={`${formatLogDate(point.date)} · ${formatPlacement(place)} · ${point.systemName}`}
                      />
                      <span className="trend-bar-label">{formatPlacement(place)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </article>

          <article className="dash-panel">
            <header className="dash-panel-header dash-panel-header-stack">
              <div>
                <h2>% Of Winner Trend</h2>
                <p className="dash-panel-sub">Match Score Vs Winner Over Last N Matches</p>
              </div>
              <div className="chip-row" role="group" aria-label="% Of Winner Window">
                {TREND_WINDOWS.map((opt) => (
                  <button
                    key={`pct-${opt.id}`}
                    type="button"
                    className={`chip${percentWindow === opt.id ? ' active' : ''}`}
                    onClick={() => setPercentWindow(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </header>
            {percentPoints.length === 0 ? (
              <p className="muted dash-empty">
                Log Match Sessions With % Of Winner To See This Trend.
              </p>
            ) : (
              <div className="trend-chart" role="img" aria-label="% Of Winner Trend">
                {percentPoints.map((point) => {
                  const pct = point.percentOfWinner ?? 0
                  const height = Math.max(8, Math.round(pct))
                  return (
                    <div key={point.id} className="trend-bar-col">
                      <div
                        className="trend-bar trend-bar-pct"
                        style={{ height: `${height}%` }}
                        title={`${formatLogDate(point.date)} · ${formatPercentOfWinner(pct)} · ${point.systemName}`}
                      />
                      <span className="trend-bar-label">{pct.toFixed(0)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </article>

          <article className="dash-panel">
            <header className="dash-panel-header">
              <h2>Milestones</h2>
              {milestones ? (
                <span className="muted">
                  {milestones.unlockedCount} / {milestones.milestones.length} Unlocked
                </span>
              ) : null}
            </header>
            {!milestones ? (
              <p className="muted dash-empty">Loading Milestones…</p>
            ) : milestonesByTier ? (
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
          </article>
        </div>
      </section>
    </div>
  )
}
