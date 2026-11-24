/**
 * Dashboard aggregations (§6.1 + optional insight panels).
 */

import type Database from 'better-sqlite3-multiple-ciphers'
import { PPEWS_CATEGORIES, type PpewsCategory } from '../../shared/aar'
import { PPEWS_CATEGORY_LABELS } from '../../shared/aar-template'
import {
  maintenanceTone,
  monthlyRoundsForWindow,
  type BarrelHealthItem,
  type DashboardGaps,
  type DashboardSummary,
  type MatchCadence,
  type MatchTrendPoint,
  type PlatformMixCounts,
  type PracticeMatchSplit,
  type PpewsPulseItem,
  type RecentActivityItem
} from '../../shared/dashboard'
import { PLATFORMS, type Platform } from '../../shared/platforms'
import { isMaintenanceTracked, type PartInfo } from '../../shared/parts'
import { listAmmoInventory } from './ammo'
import { listAars } from './aar'
import { getPpewsTrends } from './trends'
import { listParts } from './parts'
import { ensureLocalProfile } from './profile'
import { listShootingLogs } from './shooting-logs'
import { countCompleteSystems, listSystems } from './systems'

const BARREL_PANEL_LIMIT = 5
const ACTIVITY_FEED_LIMIT = 5
const GAPS_LIMIT = 5
const PRACTICE_MATCH_WINDOW_DAYS = 90

function emptyPlatformCounts(): PlatformMixCounts {
  return { bolt_action: 0, ar_pattern: 0, pistol: 0 }
}

function barrelTitle(part: PartInfo): string {
  if (part.name?.trim()) return part.name.trim()
  return [part.manufacturer, part.caliber].filter(Boolean).join(' ') || part.manufacturer
}

function partTitle(part: PartInfo): string {
  if (part.type === 'Barrel') return barrelTitle(part)
  return [part.manufacturer, part.model].filter(Boolean).join(' ') || part.manufacturer
}

function buildMatchTrends(
  db: Database.Database,
  logs: ReturnType<typeof listShootingLogs>
): MatchTrendPoint[] {
  const systems = listSystems(db)
  const systemsById = new Map(systems.map((s) => [s.id, s.name]))

  return logs
    .filter((log) => log.sessionType === 'Match')
    .map((log) => ({
      id: log.id,
      date: log.date,
      systemName: log.systemId
        ? (systemsById.get(log.systemId) ?? 'Unknown System')
        : 'Former build',
      placement: log.placement,
      percentOfWinner: log.percentOfWinner
    }))
}

function buildMaintenanceDue(parts: PartInfo[]): BarrelHealthItem[] {
  return parts
    .filter(
      (part) =>
        part.type === 'Barrel' &&
        part.maintenanceInterval != null &&
        part.maintenanceInterval > 0
    )
    .map((part) => {
      const interval = part.maintenanceInterval as number
      const percent = Math.round((part.roundsAfterCleaning / interval) * 100)
      return {
        partId: part.id,
        title: barrelTitle(part),
        percent,
        tone: maintenanceTone(percent),
        detail: `${part.roundsAfterCleaning.toLocaleString()} / ${interval.toLocaleString()} since clean`
      }
    })
    .sort((a, b) => b.percent - a.percent || a.title.localeCompare(b.title))
    .slice(0, BARREL_PANEL_LIMIT)
}

function buildBarrelLife(parts: PartInfo[]): BarrelHealthItem[] {
  return parts
    .filter((part) => part.type === 'Barrel' && part.barrelLife != null && part.barrelLife > 0)
    .map((part) => {
      const life = part.barrelLife as number
      const percent = Math.round((part.totalRoundCount / life) * 100)
      return {
        partId: part.id,
        title: barrelTitle(part),
        percent,
        tone: maintenanceTone(percent),
        detail: `${part.totalRoundCount.toLocaleString()} / ${life.toLocaleString()} rounds`
      }
    })
    .sort((a, b) => b.percent - a.percent || a.title.localeCompare(b.title))
    .slice(0, BARREL_PANEL_LIMIT)
}

function buildPlatformMix(
  parts: PartInfo[],
  systems: ReturnType<typeof listSystems>
): DashboardSummary['platformMix'] {
  const partCounts = emptyPlatformCounts()
  for (const part of parts) {
    for (const platform of part.platforms) {
      if (PLATFORMS.includes(platform)) partCounts[platform] += 1
    }
  }
  const buildCounts = emptyPlatformCounts()
  for (const system of systems) {
    const platform = system.platform as Platform
    if (PLATFORMS.includes(platform)) buildCounts[platform] += 1
  }
  return { parts: partCounts, builds: buildCounts }
}

function daysBetween(isoDate: string, now: Date): number {
  const target = new Date(`${isoDate.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(target.getTime())) return 0
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.max(0, Math.round((start.getTime() - end.getTime()) / 86_400_000))
}

function buildPracticeMatch(
  logs: ReturnType<typeof listShootingLogs>,
  now: Date = new Date()
): PracticeMatchSplit {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  cutoff.setDate(cutoff.getDate() - (PRACTICE_MATCH_WINDOW_DAYS - 1))
  const cutoffIso = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`

  const practice = { sessions: 0, rounds: 0 }
  const match = { sessions: 0, rounds: 0 }
  for (const log of logs) {
    if (log.date < cutoffIso) continue
    const bucket = log.sessionType === 'Match' ? match : practice
    bucket.sessions += 1
    bucket.rounds += log.roundsFired
  }
  return { windowDays: PRACTICE_MATCH_WINDOW_DAYS, practice, match }
}

function buildPpewsPulse(db: Database.Database): PpewsPulseItem[] {
  const trends = getPpewsTrends(db)
  return PPEWS_CATEGORIES.map((category: PpewsCategory) => {
    const point = trends.categories.find((row) => row.category === category)
    return {
      category,
      label: PPEWS_CATEGORY_LABELS[category],
      totalPoints: point?.totalPointsDropped ?? 0,
      aarCount: point?.aarCount ?? 0
    }
  })
    .filter((row) => row.totalPoints > 0)
    .sort((a, b) => b.totalPoints - a.totalPoints || a.label.localeCompare(b.label))
    .slice(0, 6)
}

function buildMatchCadence(
  logs: ReturnType<typeof listShootingLogs>,
  now: Date = new Date()
): MatchCadence {
  let lastPracticeDate: string | null = null
  let lastMatchDate: string | null = null
  for (const log of logs) {
    if (log.sessionType === 'Match') {
      if (!lastMatchDate || log.date > lastMatchDate) lastMatchDate = log.date
    } else if (!lastPracticeDate || log.date > lastPracticeDate) {
      lastPracticeDate = log.date
    }
  }
  return {
    lastPracticeDate,
    lastMatchDate,
    daysSincePractice: lastPracticeDate ? daysBetween(lastPracticeDate, now) : null,
    daysSinceMatch: lastMatchDate ? daysBetween(lastMatchDate, now) : null
  }
}

function buildGaps(
  parts: PartInfo[],
  logs: ReturnType<typeof listShootingLogs>,
  systemsById: Map<string, string>
): DashboardGaps {
  const inventory: DashboardGaps['inventory'] = []
  for (const part of parts) {
    const missing: string[] = []
    if (
      (part.type === 'Barrel' || part.type === 'Frame' || part.type === 'Pistol') &&
      !part.caliber?.trim()
    ) {
      missing.push('caliber')
    }
    if (isMaintenanceTracked(part.type) && (!part.maintenanceInterval || part.maintenanceInterval <= 0)) {
      missing.push('maintenance interval')
    }
    if (part.type === 'Barrel' && (!part.barrelLife || part.barrelLife <= 0)) {
      missing.push('barrel life')
    }
    if (
      (part.type === 'Action' || part.type === 'Barrel' || part.type === 'Pistol' || part.type === 'Frame') &&
      !part.serialNumber?.trim()
    ) {
      missing.push('serial')
    }
    if (missing.length === 0) continue
    inventory.push({
      id: part.id,
      label: partTitle(part),
      missing,
      navigate: 'inventory'
    })
  }
  inventory.sort((a, b) => b.missing.length - a.missing.length || a.label.localeCompare(b.label))

  const matches: DashboardGaps['matches'] = []
  for (const log of logs) {
    if (log.sessionType !== 'Match') continue
    const missing: string[] = []
    if (log.placement == null) missing.push('place')
    if (log.percentOfWinner == null) missing.push('% of winner')
    if (missing.length === 0) continue
    matches.push({
      id: log.id,
      label: `${log.date} · ${log.systemId ? (systemsById.get(log.systemId) ?? 'Build') : 'Former build'}`,
      missing,
      navigate: 'logs'
    })
  }

  return {
    inventory: inventory.slice(0, GAPS_LIMIT),
    matches: matches.slice(0, GAPS_LIMIT)
  }
}

function buildRecentActivity(
  db: Database.Database,
  logs: ReturnType<typeof listShootingLogs>,
  parts: PartInfo[],
  systemsById: Map<string, string>
): RecentActivityItem[] {
  const items: Array<RecentActivityItem & { sortKey: string }> = []

  for (const log of logs.slice(0, 20)) {
    items.push({
      id: `log:${log.id}`,
      kind: 'log',
      title: `${log.sessionType} · ${log.roundsFired} rounds`,
      subtitle: `${log.systemId ? (systemsById.get(log.systemId) ?? 'Build') : 'Former build'} · ${log.location}`,
      date: log.date,
      navigate: 'logs',
      sortKey: `${log.date}T${log.updatedAt}`
    })
  }

  for (const aar of listAars(db).slice(0, 20)) {
    const date = aar.matchDateStart ?? aar.updatedAt.slice(0, 10)
    items.push({
      id: `aar:${aar.id}`,
      kind: 'aar',
      title: aar.matchName?.trim() || 'After-action review',
      subtitle: `${aar.status === 'complete' ? 'Complete' : 'Draft'} · ${aar.totalPointsDropped} PPEWS pts`,
      date,
      navigate: 'aars',
      sortKey: aar.updatedAt
    })
  }

  const recentParts = [...parts]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 20)
  for (const part of recentParts) {
    items.push({
      id: `part:${part.id}`,
      kind: 'part',
      title: partTitle(part),
      subtitle: `${part.type} · ${part.status}`,
      date: part.updatedAt.slice(0, 10),
      navigate: 'inventory',
      sortKey: part.updatedAt
    })
  }

  return items
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .slice(0, ACTIVITY_FEED_LIMIT)
    .map(({ sortKey: _sortKey, ...item }) => item)
}

export function getDashboardSummary(db: Database.Database): DashboardSummary {
  const profile = ensureLocalProfile(db)
  const logs = listShootingLogs(db)
  const parts = listParts(db)
  const systems = listSystems(db)
  const systemsById = new Map(systems.map((s) => [s.id, s.name]))
  const activeSystems = countCompleteSystems(db)
  const totalRounds = logs.reduce((sum, log) => sum + log.roundsFired, 0)
  const inventoryItems = parts.length
  const totalValue = parts.reduce((sum, part) => sum + part.value, 0)
  const ammoRoundsTotal = profile.trackAmmo
    ? listAmmoInventory(db).reduce((sum, item) => sum + item.quantity, 0)
    : null

  const firstName = profile.firstName.trim() || profile.email?.trim() || profile.username.trim()

  return {
    firstName,
    trackValue: profile.trackValue,
    trackAmmo: profile.trackAmmo,
    totalRounds,
    ammoRoundsTotal,
    activeSystems,
    inventoryItems,
    totalValue,
    monthlyRounds: monthlyRoundsForWindow(logs, 'lifetime'),
    matchTrends: buildMatchTrends(db, logs),
    maintenanceDue: buildMaintenanceDue(parts),
    barrelLife: buildBarrelLife(parts),
    platformMix: buildPlatformMix(parts, systems),
    practiceMatch: buildPracticeMatch(logs),
    ppewsPulse: buildPpewsPulse(db),
    matchCadence: buildMatchCadence(logs),
    gaps: buildGaps(parts, logs, systemsById),
    recentActivity: buildRecentActivity(db, logs, parts, systemsById)
  }
}
