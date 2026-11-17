/** Shooting log types shared across main / preload / renderer. */

export type SessionType = 'Practice' | 'Match'

export type ShootingLogInfo = {
  id: string
  systemId: string
  barrelId: string
  ammoId: string | null
  cartridge: string | null
  date: string
  location: string
  roundsFired: number
  velocity: number | null
  sessionType: SessionType
  /** Match place (1 = 1st). Null for practice or unset. */
  placement: number | null
  /** Match score as % of winner (0–100). Null for practice or unset. */
  percentOfWinner: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type NewShootingLogInputInfo = {
  id?: string
  systemId: string
  ammoId?: string | null
  cartridge?: string | null
  date: string
  location: string
  roundsFired: number
  velocity?: number | null
  sessionType?: SessionType
  placement?: number | null
  percentOfWinner?: number | null
  notes?: string | null
}

export type UpdateShootingLogInputInfo = Partial<Omit<NewShootingLogInputInfo, 'id'>> & {
  id: string
}

export const SESSION_TYPES: SessionType[] = ['Practice', 'Match']

export type LogsTimeRange = 'all' | 'year' | 'month'

/** Format a place number as 1st / 2nd / 3rd / 4th… */
export function formatPlacement(place: number): string {
  const n = Math.trunc(place)
  if (!Number.isFinite(n) || n < 1) return String(place)
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

/** Format % of winner with exactly 3 decimal places. */
export function formatPercentOfWinner(value: number): string {
  return `${value.toFixed(3)}%`
}
