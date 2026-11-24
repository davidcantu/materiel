/** Dashboard summary types and helpers. */

export type MonthlyRounds = {
  /** YYYY-MM */
  key: string
  /** 3-letter month label */
  label: string
  /** Full month/year for tooltip */
  fullLabel: string
  rounds: number
}

export type YearlyRounds = {
  /** YYYY */
  key: string
  label: string
  fullLabel: string
  rounds: number
}

/** Roll monthly buckets into calendar years (oldest → newest). */
export function aggregateMonthlyToYearly(months: MonthlyRounds[]): YearlyRounds[] {
  const byYear = new Map<string, number>()
  for (const month of months) {
    const year = month.key.slice(0, 4)
    if (!/^\d{4}$/.test(year)) continue
    byYear.set(year, (byYear.get(year) ?? 0) + month.rounds)
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, rounds]) => ({
      key: year,
      label: year,
      fullLabel: year,
      rounds
    }))
}

export function peakActivityBucket<T extends { rounds: number; fullLabel: string }>(
  buckets: T[]
): T | null {
  let peak: T | null = null
  for (const bucket of buckets) {
    if (!peak || bucket.rounds > peak.rounds) peak = bucket
  }
  return peak && peak.rounds > 0 ? peak : null
}

export type RecentActivityItem = {
  id: string
  kind: 'log' | 'aar' | 'part'
  title: string
  subtitle: string
  date: string
  navigate: 'logs' | 'aars' | 'inventory'
}

export type BarrelHealthItem = {
  partId: string
  title: string
  percent: number
  tone: 'ok' | 'warn' | 'high'
  detail: string
}

export type MatchTrendPoint = {
  id: string
  date: string
  systemName: string
  placement: number | null
  percentOfWinner: number | null
}

export type PlatformMixCounts = {
  bolt_action: number
  ar_pattern: number
  pistol: number
}

export type SessionSplitBucket = {
  sessions: number
  rounds: number
}

export type PracticeMatchSplit = {
  windowDays: number
  practice: SessionSplitBucket
  match: SessionSplitBucket
}

export type PpewsPulseItem = {
  category: string
  label: string
  totalPoints: number
  aarCount: number
}

export type MatchCadence = {
  daysSincePractice: number | null
  daysSinceMatch: number | null
  lastPracticeDate: string | null
  lastMatchDate: string | null
}

export type DashboardGapItem = {
  id: string
  label: string
  missing: string[]
  navigate: 'inventory' | 'logs'
}

export type DashboardGaps = {
  inventory: DashboardGapItem[]
  matches: DashboardGapItem[]
}

export type DashboardTrendWindow = 10 | 20 | 50 | 'all'

/** Optional dashboard panels (KPIs / getting-started stay fixed). */
export const DASHBOARD_PANEL_IDS = [
  'matchCadence',
  'maintenanceDue',
  'barrelLife',
  'practiceMatch',
  'ppewsPulse',
  'platformMix',
  'gaps',
  'recentActivity',
  'shootingActivity',
  'placementTrend',
  'percentTrend',
  'milestones'
] as const

export type DashboardPanelId = (typeof DASHBOARD_PANEL_IDS)[number]

export const DASHBOARD_PANEL_LABELS: Record<DashboardPanelId, string> = {
  matchCadence: 'Match cadence',
  maintenanceDue: 'Maintenance due',
  barrelLife: 'Barrel life',
  practiceMatch: 'Practice vs Match',
  ppewsPulse: 'PPEWS pulse',
  platformMix: 'Platform mix',
  gaps: 'Gaps to fill',
  recentActivity: 'Recent activity',
  shootingActivity: 'Shooting activity',
  placementTrend: 'Placement trend',
  percentTrend: '% of winner trend',
  milestones: 'Milestones'
}

/** Default panel order — action / health first, then training, then depth charts. */
export const DEFAULT_DASHBOARD_PANELS: DashboardPanelId[] = [...DASHBOARD_PANEL_IDS]

export type DashboardSummary = {
  firstName: string
  trackValue: boolean
  trackAmmo: boolean
  totalRounds: number
  /** Sum of on-hand ammo quantity when trackAmmo; otherwise null. */
  ammoRoundsTotal: number | null
  activeSystems: number
  inventoryItems: number
  totalValue: number
  /** All months from first log through now (client filters by ActivityWindow). */
  monthlyRounds: MonthlyRounds[]
  /** Match sessions newest-first for placement / % winner charts. */
  matchTrends: MatchTrendPoint[]
  /** Barrels nearest maintenance interval (max 5). */
  maintenanceDue: BarrelHealthItem[]
  /** Barrels nearest end of rated life (max 5). */
  barrelLife: BarrelHealthItem[]
  platformMix: { parts: PlatformMixCounts; builds: PlatformMixCounts }
  practiceMatch: PracticeMatchSplit
  ppewsPulse: PpewsPulseItem[]
  matchCadence: MatchCadence
  gaps: DashboardGaps
  recentActivity: RecentActivityItem[]
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
] as const

const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
] as const

export type ActivityWindow = '3m' | '1y' | '2y' | 'lifetime'

/** Calendar months for an activity window, oldest → current. */
export function monthlyRoundsForWindow(
  logs: Array<{ date: string; roundsFired: number }>,
  window: ActivityWindow,
  now: Date = new Date()
): MonthlyRounds[] {
  const totals = new Map<string, number>()
  for (const log of logs) {
    const key = log.date.slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(key)) continue
    totals.set(key, (totals.get(key) ?? 0) + log.roundsFired)
  }

  const cursor = new Date(now.getFullYear(), now.getMonth(), 1)
  let monthCount: number
  if (window === '3m') monthCount = 3
  else if (window === '1y') monthCount = 12
  else if (window === '2y') monthCount = 24
  else {
    let earliest = cursor
    for (const key of totals.keys()) {
      const [ys, ms] = key.split('-')
      const y = Number(ys)
      const m = Number(ms) - 1
      if (!Number.isFinite(y) || !Number.isFinite(m)) continue
      const d = new Date(y, m, 1)
      if (d < earliest) earliest = d
    }
    monthCount =
      (cursor.getFullYear() - earliest.getFullYear()) * 12 +
      (cursor.getMonth() - earliest.getMonth()) +
      1
    monthCount = Math.max(1, Math.min(monthCount, 120))
  }

  const months: MonthlyRounds[] = []
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth()
    const key = `${y}-${String(m + 1).padStart(2, '0')}`
    months.push({
      key,
      label: MONTH_SHORT[m],
      fullLabel: `${MONTH_LONG[m]} ${y}`,
      rounds: totals.get(key) ?? 0
    })
  }
  return months
}

/** Trailing 12 calendar months, oldest → current. */
export function trailing12MonthRounds(
  logs: Array<{ date: string; roundsFired: number }>,
  now: Date = new Date()
): MonthlyRounds[] {
  return monthlyRoundsForWindow(logs, '1y', now)
}

export function maintenanceTone(percent: number): 'ok' | 'warn' | 'high' {
  if (percent <= 60) return 'ok'
  if (percent <= 90) return 'warn'
  return 'high'
}

/** Slice newest-first match trends to the selected window (oldest → newest for charts). */
export function sliceMatchTrends(
  points: MatchTrendPoint[],
  window: DashboardTrendWindow
): MatchTrendPoint[] {
  const sliced = window === 'all' ? points : points.slice(0, window)
  return [...sliced].reverse()
}
