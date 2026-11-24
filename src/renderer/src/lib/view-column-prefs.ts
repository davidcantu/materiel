/**
 * Persist Inventory / Logs visible columns in localStorage.
 */

const INVENTORY_KEY = 'materiel.inventoryVisibleColumns.v1'
const LOGS_KEY = 'materiel.logsVisibleColumns.v1'

export const INVENTORY_COLUMN_IDS = [
  'type',
  'part',
  'rounds',
  'maintenance',
  'status'
] as const

export type InventoryColumnId = (typeof INVENTORY_COLUMN_IDS)[number]

export const INVENTORY_COLUMN_LABELS: Record<InventoryColumnId, string> = {
  type: 'Type',
  part: 'Part',
  rounds: 'Rounds',
  maintenance: 'Maintenance',
  status: 'Status'
}

export const DEFAULT_INVENTORY_COLUMNS: InventoryColumnId[] = [...INVENTORY_COLUMN_IDS]

export const LOGS_COLUMN_IDS = [
  'date',
  'barrel',
  'location',
  'rounds',
  'cartridge',
  'place',
  'percentOfWinner',
  'velocity'
] as const

export type LogsColumnId = (typeof LOGS_COLUMN_IDS)[number]

export const LOGS_COLUMN_LABELS: Record<LogsColumnId, string> = {
  date: 'Date',
  barrel: 'Barrel',
  location: 'Location',
  rounds: 'Rounds',
  cartridge: 'Cartridge',
  place: 'Place',
  percentOfWinner: '% Of Winner',
  velocity: 'Velocity'
}

export const DEFAULT_LOGS_COLUMNS: LogsColumnId[] = [...LOGS_COLUMN_IDS]

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function normalizeColumns<T extends string>(
  raw: unknown,
  allowed: readonly T[],
  fallback: T[]
): T[] {
  if (!Array.isArray(raw)) return [...fallback]
  const allowedSet = new Set<string>(allowed)
  const seen = new Set<string>()
  const next: T[] = []
  for (const value of raw) {
    if (typeof value !== 'string' || !allowedSet.has(value) || seen.has(value)) continue
    seen.add(value)
    next.push(value as T)
  }
  // Preserve catalog order rather than save order.
  const ordered = allowed.filter((id) => next.includes(id))
  return ordered.length > 0 ? ordered : [...fallback]
}

export function loadInventoryVisibleColumns(): InventoryColumnId[] {
  return normalizeColumns(readJson(INVENTORY_KEY), INVENTORY_COLUMN_IDS, DEFAULT_INVENTORY_COLUMNS)
}

export function saveInventoryVisibleColumns(columns: InventoryColumnId[]): void {
  const next = normalizeColumns(columns, INVENTORY_COLUMN_IDS, DEFAULT_INVENTORY_COLUMNS)
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(next))
}

export function loadLogsVisibleColumns(): LogsColumnId[] {
  return normalizeColumns(readJson(LOGS_KEY), LOGS_COLUMN_IDS, DEFAULT_LOGS_COLUMNS)
}

export function saveLogsVisibleColumns(columns: LogsColumnId[]): void {
  const next = normalizeColumns(columns, LOGS_COLUMN_IDS, DEFAULT_LOGS_COLUMNS)
  localStorage.setItem(LOGS_KEY, JSON.stringify(next))
}
