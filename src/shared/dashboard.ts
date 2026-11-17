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

export type RecentActivityItem = {
  id: string
  systemName: string
  location: string
  date: string
  roundsFired: number
  cartridgeLabel: string
}

export type MaintenanceAlertItem = {
  partId: string
  title: string
  kind: 'Maintenance' | 'Barrel Life'
  percent: number
  tone: 'ok' | 'warn' | 'high'
}

export type MatchTrendPoint = {
  id: string
  date: string
  systemName: string
  placement: number | null
  percentOfWinner: number | null
}

export type DashboardTrendWindow = 10 | 20 | 50 | 'all'

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
  monthlyRounds: MonthlyRounds[]
  recentActivity: RecentActivityItem[]
  maintenanceAlerts: MaintenanceAlertItem[]
  /** Match sessions newest-first for placement / % winner charts. */
  matchTrends: MatchTrendPoint[]
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

/** Trailing 12 calendar months, oldest → current. */
export function trailing12MonthRounds(
  logs: Array<{ date: string; roundsFired: number }>,
  now: Date = new Date()
): MonthlyRounds[] {
  const totals = new Map<string, number>()
  for (const log of logs) {
    const key = log.date.slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(key)) continue
    totals.set(key, (totals.get(key) ?? 0) + log.roundsFired)
  }

  const months: MonthlyRounds[] = []
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1)
  for (let i = 11; i >= 0; i--) {
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
