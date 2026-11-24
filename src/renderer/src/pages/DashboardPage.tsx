import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ActivityWindow,
  BarrelHealthItem,
  DashboardPanelId,
  DashboardSummary,
  DashboardTrendWindow,
  MonthlyRounds
} from '../../../shared/dashboard'
import {
  aggregateMonthlyToYearly,
  DASHBOARD_PANEL_IDS,
  DASHBOARD_PANEL_LABELS,
  DEFAULT_DASHBOARD_PANELS,
  peakActivityBucket,
  sliceMatchTrends
} from '../../../shared/dashboard'
import type { MilestonesSummary, MilestoneStatus, MilestoneTier } from '../../../shared/milestones'
import { MILESTONE_TIER_LABELS } from '../../../shared/milestones'
import { PLATFORM_LABELS, PLATFORMS } from '../../../shared/platforms'
import { formatPercentOfWinner, formatPlacement } from '../../../shared/shooting-logs'
import { ColumnVisibilityMenu } from '../components/ColumnVisibilityMenu'
import { PageFeedback } from '../components/PageFeedback'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/toast-context'
import { formatCurrency } from '../lib/format'
import { loadDashboardPanels, saveDashboardPanels } from '../lib/view-dashboard-prefs'

type DashboardPageProps = {
  onNavigateLogs: () => void
  onNavigateInventory?: () => void
  onNavigateBuilds?: () => void
  onNavigateAars?: () => void
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

function daysLabel(days: number | null): string {
  if (days == null) return 'No sessions yet'
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
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

function BarrelHealthList({
  items,
  empty
}: {
  items: BarrelHealthItem[]
  empty: string
}): React.JSX.Element {
  if (items.length === 0) return <p className="muted dash-empty">{empty}</p>
  return (
    <ul className="dash-health-list">
      {items.map((item) => (
        <li key={item.partId} className={`dash-health-row tone-${item.tone}`}>
          <div className="dash-health-copy">
            <strong>{item.title}</strong>
            <span className="muted">{item.detail}</span>
          </div>
          <div className="dash-health-meter" aria-hidden="true">
            <div
              className={`progress-track tone-${item.tone}`}
              title={`${item.percent}%`}
            >
              <div
                className="progress-fill"
                style={{ width: `${Math.min(Math.max(item.percent, 0), 100)}%` }}
              />
            </div>
            <span>{item.percent}%</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function DashboardPage({
  onNavigateLogs,
  onNavigateInventory,
  onNavigateBuilds,
  onNavigateAars
}: DashboardPageProps): React.JSX.Element {
  const toast = useToast()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [milestones, setMilestones] = useState<MilestonesSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [placementWindow, setPlacementWindow] = useState<DashboardTrendWindow>(10)
  const [percentWindow, setPercentWindow] = useState<DashboardTrendWindow>(10)
  const [activityWindow, setActivityWindow] = useState<ActivityWindow>('1y')
  const [visiblePanels, setVisiblePanels] = useState<DashboardPanelId[]>(() =>
    loadDashboardPanels()
  )

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

  const panelSet = useMemo(() => new Set(visiblePanels), [visiblePanels])

  const activityMonths = useMemo(
    () => (summary ? sliceActivityMonths(summary.monthlyRounds, activityWindow) : []),
    [summary, activityWindow]
  )
  const activityYears = useMemo(
    () => (activityWindow === 'lifetime' ? aggregateMonthlyToYearly(activityMonths) : []),
    [activityMonths, activityWindow]
  )
  const lifetimePeak = useMemo(
    () => (activityWindow === 'lifetime' ? peakActivityBucket(activityYears) : null),
    [activityWindow, activityYears]
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

  function updatePanels(next: DashboardPanelId[]): void {
    setVisiblePanels(next)
    saveDashboardPanels(next)
  }

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
  const maxYearRounds = Math.max(1, ...activityYears.map((y) => y.rounds))
  const placementPoints = placementTrend.filter((p) => p.placement != null)
  const percentPoints = percentTrend.filter((p) => p.percentOfWinner != null)
  const maxPlace = Math.max(1, ...placementPoints.map((p) => p.placement ?? 1))
  const isLifetimeActivity = activityWindow === 'lifetime'
  const activitySubtitle = isLifetimeActivity
    ? lifetimePeak
      ? `Rounds By Year · Peak ${lifetimePeak.label} (${lifetimePeak.rounds.toLocaleString()})`
      : 'Rounds Fired By Year'
    : 'Rounds Fired Per Month'
  const kpiClass = [
    'kpi-grid',
    summary.trackValue && summary.trackAmmo
      ? 'kpi-grid-5'
      : summary.trackValue || summary.trackAmmo
        ? 'kpi-grid-4'
        : 'kpi-grid-3'
  ].join(' ')

  const showGettingStarted =
    summary.inventoryItems === 0 || summary.activeSystems === 0 || summary.totalRounds === 0

  const maxPpews = Math.max(1, ...summary.ppewsPulse.map((row) => row.totalPoints))
  const practiceMatchTotal = Math.max(
    1,
    summary.practiceMatch.practice.rounds + summary.practiceMatch.match.rounds
  )

  function navigateTo(target: 'logs' | 'aars' | 'inventory' | 'builds'): void {
    if (target === 'logs') onNavigateLogs()
    else if (target === 'inventory') onNavigateInventory?.()
    else if (target === 'builds') onNavigateBuilds?.()
    else onNavigateAars?.()
  }

  return (
    <div className="page dashboard-page">
      <PageHeader
        title={title}
        description="Your Firearms, Rounds, And Builds At A Glance."
        actions={
          <ColumnVisibilityMenu
            label="Panels"
            menuTitle="Show panels"
            resetLabel="Reset panels"
            options={DASHBOARD_PANEL_IDS.map((id) => ({
              id,
              label: DASHBOARD_PANEL_LABELS[id]
            }))}
            visible={visiblePanels}
            onChange={(next) => updatePanels(next)}
            onReset={() => {
              updatePanels([...DEFAULT_DASHBOARD_PANELS])
              toast.success('Dashboard panels reset to default.')
            }}
          />
        }
      />

      {showGettingStarted ? (
        <section className="getting-started" aria-label="Getting started">
          <h2>Getting started</h2>
          <ol className="getting-started-steps">
            <li className={summary.inventoryItems > 0 ? 'done' : undefined}>
              <span>Add a Frame, Action, or Barrel in Inventory</span>
              {summary.inventoryItems === 0 && onNavigateInventory ? (
                <button type="button" className="btn-ghost btn-sm" onClick={onNavigateInventory}>
                  Inventory
                </button>
              ) : null}
            </li>
            <li className={summary.activeSystems > 0 ? 'done' : undefined}>
              <span>Assemble a complete build</span>
              {summary.activeSystems === 0 && onNavigateBuilds ? (
                <button type="button" className="btn-ghost btn-sm" onClick={onNavigateBuilds}>
                  Builds
                </button>
              ) : null}
            </li>
            <li className={summary.totalRounds > 0 ? 'done' : undefined}>
              <span>Log your first session</span>
              {summary.totalRounds === 0 ? (
                <button type="button" className="btn-ghost btn-sm" onClick={onNavigateLogs}>
                  Logs
                </button>
              ) : null}
            </li>
          </ol>
        </section>
      ) : null}

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
          {panelSet.has('matchCadence') ? (
            <article className="dash-panel">
              <header className="dash-panel-header">
                <div>
                  <h2>Match cadence</h2>
                  <p className="dash-panel-sub">Days since your last practice and match</p>
                </div>
              </header>
              <div className="dash-cadence-grid">
                <div className="dash-cadence-card">
                  <span className="muted">Last practice</span>
                  <strong>{daysLabel(summary.matchCadence.daysSincePractice)}</strong>
                  <span className="muted">
                    {summary.matchCadence.lastPracticeDate
                      ? formatLogDate(summary.matchCadence.lastPracticeDate)
                      : 'Log a practice session'}
                  </span>
                </div>
                <div className="dash-cadence-card">
                  <span className="muted">Last match</span>
                  <strong>{daysLabel(summary.matchCadence.daysSinceMatch)}</strong>
                  <span className="muted">
                    {summary.matchCadence.lastMatchDate
                      ? formatLogDate(summary.matchCadence.lastMatchDate)
                      : 'Log a match session'}
                  </span>
                </div>
              </div>
              {(summary.matchCadence.daysSincePractice ?? 0) >= 14 ||
              (summary.matchCadence.daysSinceMatch ?? 0) >= 30 ? (
                <p className="dash-cadence-nudge">
                  Due for range time —{' '}
                  <button type="button" className="btn-ghost btn-sm" onClick={onNavigateLogs}>
                    Log a session
                  </button>
                </p>
              ) : null}
            </article>
          ) : null}

          {panelSet.has('maintenanceDue') ? (
            <article className="dash-panel">
              <header className="dash-panel-header">
                <div>
                  <h2>Maintenance due</h2>
                  <p className="dash-panel-sub">Top barrels by cleaning interval (max 5)</p>
                </div>
              </header>
              <BarrelHealthList
                items={summary.maintenanceDue}
                empty="Set maintenance intervals on barrels to track cleaning."
              />
            </article>
          ) : null}

          {panelSet.has('barrelLife') ? (
            <article className="dash-panel">
              <header className="dash-panel-header">
                <div>
                  <h2>Barrel life</h2>
                  <p className="dash-panel-sub">Highest % of rated life used (max 5)</p>
                </div>
              </header>
              <BarrelHealthList
                items={summary.barrelLife}
                empty="Add barrel life ratings to see wear toward replacement."
              />
            </article>
          ) : null}

          {panelSet.has('practiceMatch') ? (
            <article className="dash-panel">
              <header className="dash-panel-header">
                <div>
                  <h2>Practice vs Match</h2>
                  <p className="dash-panel-sub">
                    Last {summary.practiceMatch.windowDays} days of logged rounds
                  </p>
                </div>
              </header>
              <div className="dash-split-bars" role="img" aria-label="Practice versus match rounds">
                {(
                  [
                    ['Practice', summary.practiceMatch.practice],
                    ['Match', summary.practiceMatch.match]
                  ] as const
                ).map(([label, bucket]) => {
                  const width = Math.max(
                    bucket.rounds > 0 ? 8 : 0,
                    Math.round((bucket.rounds / practiceMatchTotal) * 100)
                  )
                  return (
                    <div key={label} className="dash-split-row">
                      <span className="dash-split-label">{label}</span>
                      <div className="dash-split-track" aria-hidden="true">
                        <div className="dash-split-fill" style={{ width: `${width}%` }} />
                      </div>
                      <span className="dash-split-value">
                        {bucket.rounds.toLocaleString()} rds · {bucket.sessions} sess
                      </span>
                    </div>
                  )
                })}
              </div>
            </article>
          ) : null}

          {panelSet.has('ppewsPulse') ? (
            <article className="dash-panel">
              <header className="dash-panel-header">
                <div>
                  <h2>PPEWS pulse</h2>
                  <p className="dash-panel-sub">Points dropped by category from complete AARs</p>
                </div>
                {onNavigateAars ? (
                  <button type="button" className="btn-ghost btn-sm" onClick={onNavigateAars}>
                    Open AARs
                  </button>
                ) : null}
              </header>
              {summary.ppewsPulse.length === 0 ? (
                <p className="muted dash-empty">Complete an AAR with PPEWS scores to see leaks.</p>
              ) : (
                <ul className="dash-ppews-list">
                  {summary.ppewsPulse.map((row) => (
                    <li key={row.category}>
                      <div className="dash-ppews-copy">
                        <strong>{row.label}</strong>
                        <span className="muted">{row.aarCount} AAR</span>
                      </div>
                      <div className="dash-ppews-meter" aria-hidden="true">
                        <div className="progress-track tone-warn">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${Math.max(8, Math.round((row.totalPoints / maxPpews) * 100))}%`
                            }}
                          />
                        </div>
                        <span>{row.totalPoints}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ) : null}

          {panelSet.has('platformMix') ? (
            <article className="dash-panel">
              <header className="dash-panel-header">
                <div>
                  <h2>Platform mix</h2>
                  <p className="dash-panel-sub">Parts and builds by Bolt / AR / Pistol</p>
                </div>
              </header>
              <div className="dash-platform-grid">
                {PLATFORMS.map((platform) => (
                  <div key={platform} className="dash-platform-card">
                    <strong>{PLATFORM_LABELS[platform]}</strong>
                    <span>{summary.platformMix.parts[platform]} parts</span>
                    <span>{summary.platformMix.builds[platform]} builds</span>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {panelSet.has('gaps') ? (
            <article className="dash-panel">
              <header className="dash-panel-header">
                <div>
                  <h2>Gaps to fill</h2>
                  <p className="dash-panel-sub">Missing inventory fields and match results</p>
                </div>
              </header>
              {summary.gaps.inventory.length === 0 && summary.gaps.matches.length === 0 ? (
                <p className="muted dash-empty">No obvious gaps — nice and complete.</p>
              ) : (
                <div className="dash-gaps-grid">
                  <div>
                    <h3>Inventory</h3>
                    {summary.gaps.inventory.length === 0 ? (
                      <p className="muted">None</p>
                    ) : (
                      <ul className="dash-gap-list">
                        {summary.gaps.inventory.map((gap) => (
                          <li key={gap.id}>
                            <button
                              type="button"
                              className="dash-gap-link"
                              onClick={() => navigateTo(gap.navigate)}
                            >
                              <strong>{gap.label}</strong>
                              <span className="muted">Missing {gap.missing.join(', ')}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3>Matches</h3>
                    {summary.gaps.matches.length === 0 ? (
                      <p className="muted">None</p>
                    ) : (
                      <ul className="dash-gap-list">
                        {summary.gaps.matches.map((gap) => (
                          <li key={gap.id}>
                            <button
                              type="button"
                              className="dash-gap-link"
                              onClick={() => navigateTo(gap.navigate)}
                            >
                              <strong>{gap.label}</strong>
                              <span className="muted">Missing {gap.missing.join(', ')}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </article>
          ) : null}

          {panelSet.has('recentActivity') ? (
            <article className="dash-panel">
              <header className="dash-panel-header">
                <div>
                  <h2>Recent activity</h2>
                  <p className="dash-panel-sub">Latest logs, AARs, and inventory updates</p>
                </div>
              </header>
              {summary.recentActivity.length === 0 ? (
                <p className="muted dash-empty">Activity will show here as you use Materiel.</p>
              ) : (
                <ul className="dash-activity-list">
                  {summary.recentActivity.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="dash-activity-link"
                        onClick={() => navigateTo(item.navigate)}
                      >
                        <span className="dash-activity-kind">{item.kind}</span>
                        <span className="dash-activity-copy">
                          <strong>{item.title}</strong>
                          <span className="muted">{item.subtitle}</span>
                        </span>
                        <span className="muted">{formatLogDate(item.date)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ) : null}

          {panelSet.has('shootingActivity') ? (
            <article className="dash-panel">
              <header className="dash-panel-header dash-panel-header-stack">
                <div>
                  <h2>Shooting Activity</h2>
                  <p className="dash-panel-sub">{activitySubtitle}</p>
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
              {isLifetimeActivity ? (
                <div
                  className="activity-year-list"
                  role="img"
                  aria-label="Lifetime Shooting Activity By Year"
                >
                  {activityYears.length === 0 ? (
                    <p className="dash-empty muted">No Sessions Logged Yet.</p>
                  ) : (
                    activityYears.map((year) => {
                      const width =
                        year.rounds > 0
                          ? Math.max(6, Math.round((year.rounds / maxYearRounds) * 100))
                          : 0
                      const isPeak = lifetimePeak?.key === year.key
                      return (
                        <div
                          key={year.key}
                          className={`activity-year-row${isPeak ? ' is-peak' : ''}`}
                          title={`${year.fullLabel}: ${year.rounds.toLocaleString()} rounds`}
                        >
                          <span className="activity-year-label">{year.label}</span>
                          <div className="activity-year-track" aria-hidden="true">
                            <div
                              className={`activity-year-bar${year.rounds > 0 ? '' : ' activity-year-bar-zero'}`}
                              style={{ width: `${width}%` }}
                            />
                          </div>
                          <span className="activity-year-value">
                            {year.rounds.toLocaleString()}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              ) : (
                <div
                  className="activity-chart"
                  role="img"
                  aria-label="Shooting Activity Chart"
                  style={{
                    ['--activity-cols' as string]: String(Math.max(activityMonths.length, 1))
                  }}
                >
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
              )}
            </article>
          ) : null}

          {panelSet.has('placementTrend') ? (
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
                <p className="muted dash-empty">
                  Log Match Sessions With A Place To See This Trend.
                </p>
              ) : (
                <div className="trend-chart" role="img" aria-label="Match Placement Trend">
                  {placementPoints.map((point) => {
                    const place = point.placement ?? 0
                    const height = Math.max(
                      8,
                      Math.round(((maxPlace + 1 - place) / maxPlace) * 100)
                    )
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
          ) : null}

          {panelSet.has('percentTrend') ? (
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
          ) : null}

          {panelSet.has('milestones') ? (
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
          ) : null}
        </div>
      </section>
    </div>
  )
}
