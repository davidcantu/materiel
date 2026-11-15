/**
 * Dashboard aggregations (§6.1).
 */

import type Database from 'better-sqlite3-multiple-ciphers'
import {
  maintenanceTone,
  trailing12MonthRounds,
  type DashboardSummary,
  type MaintenanceAlertItem,
  type RecentActivityItem
} from '../../shared/dashboard'
import { listParts } from './parts'
import { ensureLocalProfile } from './profile'
import { listShootingLogs } from './shooting-logs'
import { countCompleteSystems, listSystems } from './systems'
import { listAmmoInventory } from './ammo'

function partTitle(part: {
  type: string
  manufacturer: string
  model: string | null
  caliber: string | null
  name: string
}): string {
  if (part.type === 'Barrel') {
    return [part.manufacturer, part.caliber].filter(Boolean).join(' ')
  }
  return [part.manufacturer, part.model].filter(Boolean).join(' ') || part.name
}

function buildMaintenanceAlerts(parts: ReturnType<typeof listParts>): MaintenanceAlertItem[] {
  const scored: Array<{ alert: MaintenanceAlertItem; sortKey: number }> = []

  for (const part of parts) {
    if (part.type !== 'Action' && part.type !== 'Barrel' && part.type !== 'Suppressor') {
      continue
    }

    const maintenancePercent =
      part.maintenanceInterval && part.maintenanceInterval > 0
        ? (part.roundsAfterCleaning / part.maintenanceInterval) * 100
        : 0

    let lifePercent = 0
    if (part.type === 'Barrel' && part.barrelLife && part.barrelLife > 0) {
      lifePercent = (part.totalRoundCount / part.barrelLife) * 100
    }

    const useLife = part.type === 'Barrel' && lifePercent > maintenancePercent
    const percent = Math.round(useLife ? lifePercent : maintenancePercent)

    scored.push({
      sortKey: Math.max(maintenancePercent, lifePercent),
      alert: {
        partId: part.id,
        title: partTitle(part),
        kind: useLife ? 'Barrel Life' : 'Maintenance',
        percent,
        tone: maintenanceTone(percent)
      }
    })
  }

  return scored
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 5)
    .map((entry) => entry.alert)
}

function buildRecentActivity(
  db: Database.Database,
  logs: ReturnType<typeof listShootingLogs>
): RecentActivityItem[] {
  const systems = listSystems(db)
  const systemsById = new Map(systems.map((s) => [s.id, s.name]))
  const ammo = listAmmoInventory(db)
  const ammoById = new Map(ammo.map((a) => [a.id, a.name]))

  return logs.slice(0, 5).map((log) => {
    let cartridgeLabel = 'Manual Entry'
    if (log.cartridge?.trim()) {
      cartridgeLabel = log.cartridge.trim()
    } else if (log.ammoId) {
      cartridgeLabel = ammoById.get(log.ammoId) ?? 'Manual Entry'
    }

    return {
      id: log.id,
      systemName: systemsById.get(log.systemId) ?? 'Unknown System',
      location: log.location,
      date: log.date,
      roundsFired: log.roundsFired,
      cartridgeLabel
    }
  })
}

export function getDashboardSummary(db: Database.Database): DashboardSummary {
  const profile = ensureLocalProfile(db)
  const logs = listShootingLogs(db)
  const parts = listParts(db)
  const activeSystems = countCompleteSystems(db)
  const totalRounds = logs.reduce((sum, log) => sum + log.roundsFired, 0)
  const inventoryItems = parts.length
  const totalValue = parts.reduce((sum, part) => sum + part.value, 0)

  return {
    firstName: profile.firstName.trim(),
    trackValue: profile.trackValue,
    totalRounds,
    activeSystems,
    inventoryItems,
    totalValue,
    monthlyRounds: trailing12MonthRounds(logs),
    recentActivity: buildRecentActivity(db, logs),
    maintenanceAlerts: buildMaintenanceAlerts(parts)
  }
}
