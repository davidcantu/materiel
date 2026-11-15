/** Dashboard summary types and §7.4 / §7.6 helpers. */

export type RankTier = 'Beginner' | 'Novice' | 'Intermediate' | 'Pro' | 'Elite'

export type BenchmarkMetric = 'rounds' | 'value' | 'systems'

/** Seed benchmarks for single-user percentile/rank (§7.6). */
export const SEED_BENCHMARKS: ReadonlyArray<{
  rounds: number
  value: number
  systems: number
}> = [
  { rounds: 500, value: 2500, systems: 1 },
  { rounds: 1500, value: 5000, systems: 2 },
  { rounds: 3000, value: 10000, systems: 3 },
  { rounds: 5000, value: 15000, systems: 4 },
  { rounds: 10000, value: 25000, systems: 6 }
]

export type MetricStanding = {
  percentile: number
  topPercent: number
  rank: RankTier
}

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

export type DashboardSummary = {
  firstName: string
  trackValue: boolean
  totalRounds: number
  activeSystems: number
  inventoryItems: number
  totalValue: number
  roundsStanding: MetricStanding
  systemsStanding: MetricStanding
  valueStanding: MetricStanding | null
  loggingStreak: number
  monthlyRounds: MonthlyRounds[]
  recentActivity: RecentActivityItem[]
  maintenanceAlerts: MaintenanceAlertItem[]
}

export function rankFromPercentile(percentile: number): RankTier {
  if (percentile >= 90) return 'Elite'
  if (percentile >= 75) return 'Pro'
  if (percentile >= 50) return 'Intermediate'
  if (percentile >= 25) return 'Novice'
  return 'Beginner'
}

/**
 * §7.6 — combine seed benchmarks with the user's value, sort ascending,
 * find first index where v >= userValue, percentile = (index / total) * 100.
 */
export function computeMetricStanding(
  userValue: number,
  metric: BenchmarkMetric,
  extraValues: number[] = []
): MetricStanding {
  const values = [...SEED_BENCHMARKS.map((b) => b[metric]), ...extraValues, userValue].sort(
    (a, b) => a - b
  )

  const totalCount = values.length
  const index = values.findIndex((v) => v >= userValue)
  const percentile = totalCount === 0 ? 0 : (index / totalCount) * 100
  const topPercent = Math.max(0, 100 - Math.round(percentile))

  return {
    percentile,
    topPercent,
    rank: rankFromPercentile(percentile)
  }
}

function parseDay(iso: string): Date {
  const day = iso.slice(0, 10)
  const d = new Date(`${day}T00:00:00`)
  return d
}

function startOfToday(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function daysBetween(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime()
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

/**
 * §7.4 — logging streak: unique calendar days in an unbroken chain
 * where consecutive gaps are ≤ 14 days; 0 if gap from today to latest > 14.
 */
export function computeLoggingStreak(logDates: string[], now: Date = new Date()): number {
  if (logDates.length === 0) return 0

  const uniqueDays = [
    ...new Set(logDates.map((d) => d.slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))
  ].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))

  if (uniqueDays.length === 0) return 0

  const today = startOfToday(now)
  const latest = parseDay(uniqueDays[0])
  if (daysBetween(today, latest) > 14) return 0

  let streak = 1
  for (let i = 1; i < uniqueDays.length; i++) {
    const newer = parseDay(uniqueDays[i - 1])
    const older = parseDay(uniqueDays[i])
    if (daysBetween(newer, older) > 14) break
    streak += 1
  }
  return streak
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
