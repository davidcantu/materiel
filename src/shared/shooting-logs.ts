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
  notes?: string | null
}

export type UpdateShootingLogInputInfo = Partial<Omit<NewShootingLogInputInfo, 'id'>> & {
  id: string
}

export const SESSION_TYPES: SessionType[] = ['Practice', 'Match']

export type LogsTimeRange = 'all' | 'year' | 'month'
