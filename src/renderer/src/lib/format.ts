import type { PartInfo, PartType } from '../../../shared/parts'
import { isMaintenanceTracked, partTypeLabel } from '../../../shared/parts'

export { partTypeLabel, isMaintenanceTracked }

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value)
}

export function maintenancePercent(part: PartInfo): number | null {
  if (!isMaintenanceTracked(part.type) || !part.maintenanceInterval) return null
  return Math.round((part.roundsAfterCleaning / part.maintenanceInterval) * 100)
}

export function maintenanceTone(percent: number): 'ok' | 'warn' | 'high' {
  if (percent <= 60) return 'ok'
  if (percent <= 90) return 'warn'
  return 'high'
}

export function partPrimaryTitle(part: PartInfo): string {
  if (part.type === 'Barrel') {
    return [part.manufacturer, part.caliber].filter(Boolean).join(' ')
  }
  return [part.manufacturer, part.model].filter(Boolean).join(' ') || part.manufacturer
}

/** Build-picker label: manufacturer/model (or caliber) · serial · status. Value is always part.id. */
export function partOptionLabel(part: PartInfo): string {
  const bits = [partPrimaryTitle(part)]
  if (part.serialNumber) bits.push(`S/N ${part.serialNumber}`)
  bits.push(part.status)
  return bits.join(' · ')
}

export function typeFilterLabel(type: PartType | 'All'): string {
  if (type === 'All') return 'All'
  return partTypeLabel(type)
}
