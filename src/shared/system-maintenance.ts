/**
 * Maintenance items scoped to a complete firearm system (known intervals on parts).
 */

import { maintenanceTone } from './dashboard'
import type { PartInfo } from './parts'
import { isMaintenanceTracked } from './parts'
import type { CompleteSystemInfo } from './systems'

export type SystemMaintenanceItem = {
  partId: string
  title: string
  kind: 'Maintenance' | 'Barrel Life'
  percent: number
  tone: 'ok' | 'warn' | 'high'
  roundsAfterCleaning: number
  interval: number
}

/** Part ids on a system that can carry round/maintenance tracking. */
export function systemTrackedPartIds(system: CompleteSystemInfo): string[] {
  const ids = [system.actionId, system.barrelId, ...system.miscPartIds]
  if (system.suppressorId) ids.push(system.suppressorId)
  return ids
}

function partTitle(part: PartInfo): string {
  if (part.type === 'Barrel') {
    if (part.name?.trim()) return part.name.trim()
    return [part.manufacturer, part.caliber].filter(Boolean).join(' ') || part.manufacturer
  }
  return [part.manufacturer, part.model].filter(Boolean).join(' ') || part.manufacturer
}

/**
 * Maintenance / barrel-life rows for one rifle, using intervals already on its parts.
 * Sorted by urgency (highest percent first).
 */
export function listSystemMaintenance(
  system: CompleteSystemInfo,
  partsById: Map<string, PartInfo>
): SystemMaintenanceItem[] {
  const items: SystemMaintenanceItem[] = []

  for (const partId of systemTrackedPartIds(system)) {
    const part = partsById.get(partId)
    if (!part || !isMaintenanceTracked(part.type)) continue

    const interval = part.maintenanceInterval
    if (!interval || interval <= 0) continue

    const maintenancePercent = (part.roundsAfterCleaning / interval) * 100
    const lifePercent =
      part.type === 'Barrel' && part.barrelLife && part.barrelLife > 0
        ? (part.totalRoundCount / part.barrelLife) * 100
        : 0
    const useLife = part.type === 'Barrel' && lifePercent > maintenancePercent
    const percent = Math.round(useLife ? lifePercent : maintenancePercent)

    items.push({
      partId: part.id,
      title: partTitle(part),
      kind: useLife ? 'Barrel Life' : 'Maintenance',
      percent,
      tone: maintenanceTone(percent),
      roundsAfterCleaning: part.roundsAfterCleaning,
      interval
    })
  }

  return items.sort((a, b) => b.percent - a.percent || a.title.localeCompare(b.title))
}

/** True when any tracked part on the system is at warn/high (≥ 61%). */
export function systemHasDueMaintenance(
  system: CompleteSystemInfo,
  partsById: Map<string, PartInfo>
): boolean {
  return listSystemMaintenance(system, partsById).some((item) => item.percent >= 61)
}
