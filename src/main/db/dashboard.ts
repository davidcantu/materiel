/**
 * Dashboard aggregations (§6.1).
 */

import type Database from 'better-sqlite3-multiple-ciphers'
import {
  monthlyRoundsForWindow,
  type DashboardSummary,
  type MatchTrendPoint
} from '../../shared/dashboard'
import { listParts } from './parts'
import { ensureLocalProfile } from './profile'
import { listShootingLogs } from './shooting-logs'
import { countCompleteSystems, listSystems } from './systems'
import { listAmmoInventory } from './ammo'

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

export function getDashboardSummary(db: Database.Database): DashboardSummary {
  const profile = ensureLocalProfile(db)
  const logs = listShootingLogs(db)
  const parts = listParts(db)
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
    matchTrends: buildMatchTrends(db, logs)
  }
}
