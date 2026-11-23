/**
 * Persist Inventory / Builds filter defaults in localStorage (like theme preference).
 */

import type { PartStatus, PartType } from '../../../shared/parts'
import { PART_STATUSES } from '../../../shared/parts'
import type { Platform } from '../../../shared/platforms'
import { isValidPlatform } from '../../../shared/platforms'

const INVENTORY_KEY = 'materiel.inventoryFilterDefaults.v1'
const BUILDS_KEY = 'materiel.buildsFilterDefaults.v1'

export type InventoryFilterDefaults = {
  platform: Platform | 'All'
  type: PartType | 'All'
  statuses: PartStatus[]
}

export type BuildsFilterDefaults = {
  platform: Platform | 'All'
}

export const DEFAULT_INVENTORY_FILTERS: InventoryFilterDefaults = {
  platform: 'All',
  type: 'All',
  statuses: ['In Stock', 'In Use']
}

export const DEFAULT_BUILDS_FILTERS: BuildsFilterDefaults = {
  platform: 'All'
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function isPartStatus(value: unknown): value is PartStatus {
  return typeof value === 'string' && (PART_STATUSES as readonly string[]).includes(value)
}

export function loadInventoryFilterDefaults(): InventoryFilterDefaults {
  const raw = readJson(INVENTORY_KEY)
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_INVENTORY_FILTERS }
  const obj = raw as Record<string, unknown>
  const platform =
    obj.platform === 'All' || (typeof obj.platform === 'string' && isValidPlatform(obj.platform))
      ? (obj.platform as Platform | 'All')
      : 'All'
  const type =
    obj.type === 'All' || typeof obj.type === 'string' ? (obj.type as PartType | 'All') : 'All'
  const statuses = Array.isArray(obj.statuses)
    ? obj.statuses.filter(isPartStatus)
    : [...DEFAULT_INVENTORY_FILTERS.statuses]
  return {
    platform,
    type,
    statuses: statuses.length > 0 ? statuses : [...DEFAULT_INVENTORY_FILTERS.statuses]
  }
}

export function saveInventoryFilterDefaults(next: InventoryFilterDefaults): void {
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(next))
}

export function inventoryFiltersEqual(
  a: InventoryFilterDefaults,
  b: InventoryFilterDefaults
): boolean {
  if (a.platform !== b.platform || a.type !== b.type) return false
  if (a.statuses.length !== b.statuses.length) return false
  const left = [...a.statuses].sort()
  const right = [...b.statuses].sort()
  return left.every((s, i) => s === right[i])
}

export function loadBuildsFilterDefaults(): BuildsFilterDefaults {
  const raw = readJson(BUILDS_KEY)
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_BUILDS_FILTERS }
  const obj = raw as Record<string, unknown>
  const platform =
    obj.platform === 'All' || (typeof obj.platform === 'string' && isValidPlatform(obj.platform))
      ? (obj.platform as Platform | 'All')
      : 'All'
  return { platform }
}

export function saveBuildsFilterDefaults(next: BuildsFilterDefaults): void {
  localStorage.setItem(BUILDS_KEY, JSON.stringify(next))
}

export function buildsFiltersEqual(a: BuildsFilterDefaults, b: BuildsFilterDefaults): boolean {
  return a.platform === b.platform
}
