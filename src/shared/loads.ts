/** Load development (reloading recipe) types shared across main / preload / renderer. */

export type LoadDevelopmentInfo = {
  id: string
  name: string
  caliber: string
  bulletManufacturer: string
  bulletModel: string
  brassManufacturer: string
  brassModel: string | null
  powderManufacturer: string
  powderModel: string
  primerManufacturer: string
  primerModel: string
  powderCharge: number | null
  /** Legacy COAL; no longer collected in the form. */
  coal: number | null
  shoulderBump: number | null
  neckTension: number | null
  /** CBTO at touch (lands). */
  lands: number | null
  /** Loaded cartridge base-to-ogive. */
  cbto: number | null
  velocity: number | null
  sd: number | null
  es: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type LoadInput = {
  id?: string
  name: string
  caliber: string
  /** YYYY-MM-DD identity date; written to updatedAt. */
  dateUpdated: string
  bulletManufacturer?: string | null
  bulletModel?: string | null
  brassManufacturer?: string | null
  brassModel?: string | null
  powderManufacturer?: string | null
  powderModel?: string | null
  primerManufacturer?: string | null
  primerModel?: string | null
  powderCharge?: number | null
  coal?: number | null
  shoulderBump?: number | null
  neckTension?: number | null
  lands?: number | null
  cbto?: number | null
  velocity?: number | null
  sd?: number | null
  es?: number | null
  notes?: string | null
}

export type LoadUpdateInput = Partial<Omit<LoadInput, 'id'>>

/** Jump = Lands − CBTO. Positive = jump; negative = jam. Null if either missing. */
export function computeJump(
  lands: number | null | undefined,
  cbto: number | null | undefined
): number | null {
  if (lands == null || cbto == null) return null
  if (!Number.isFinite(lands) || !Number.isFinite(cbto)) return null
  return Math.round((lands - cbto) * 1000) / 1000
}

export function formatInches3(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(3)
}

export function formatJump(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const formatted = value.toFixed(3)
  return value > 0 ? `+${formatted}` : formatted
}

export function isoDateFromTimestamp(iso: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso)
  if (match) return match[1]
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return todayIsoDate()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayIsoDate(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Persist a YYYY-MM-DD identity date as an ISO timestamp (local noon → UTC). */
export function timestampFromIsoDate(date: string, fallback = new Date()): string {
  const trimmed = date.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return fallback.toISOString()
  }
  const parsed = new Date(`${trimmed}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return fallback.toISOString()
  return parsed.toISOString()
}
