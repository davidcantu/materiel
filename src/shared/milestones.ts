/** Milestone definitions and unlock evaluation (PRS / military humor). */

import type { PartType } from './parts'
import { PLATFORM_PART_TYPES, PLATFORMS } from './platforms'

export type MilestoneTier = 'new' | 'mid' | 'advanced'

export type MilestoneId =
  | 'kit-up'
  | 'brass-rain'
  | 'first-contact'
  | 'ammo-budget-denial'
  | 'stage-captain-adjacent'
  | 'kitchen-table-armorer'
  | 'barrel-retirement'
  | 'full-battle-rattle'
  | 'podium-threat'

export type MilestoneDefinition = {
  id: MilestoneId
  tier: MilestoneTier
  name: string
  description: string
}

/** Counts / flags derived from inventory, builds, ammo, and logs. */
export type MilestoneSnapshot = {
  systemCount: number
  totalRounds: number
  matchSessionCount: number
  hasHandloadAmmo: boolean
  maxBarrelRounds: number
  ownedPartTypes: readonly PartType[]
  /** Best (lowest) match place; null if none recorded. */
  bestMatchPlace: number | null
  /** Highest % of winner across matches; null if none recorded. */
  bestPercentOfWinner: number | null
}

export type MilestoneStatus = MilestoneDefinition & {
  unlocked: boolean
}

export type MilestonesSummary = {
  milestones: MilestoneStatus[]
  unlockedCount: number
}

export const MILESTONE_TIER_LABELS: Record<MilestoneTier, string> = {
  new: 'New',
  mid: 'Mid',
  advanced: 'Advanced'
}

export const MILESTONE_DEFINITIONS: readonly MilestoneDefinition[] = [
  {
    id: 'kit-up',
    tier: 'new',
    name: 'Kit Up',
    description: 'First complete build on the books. Welcome to the fight.'
  },
  {
    id: 'brass-rain',
    tier: 'new',
    name: 'Brass Rain',
    description: '100 rounds logged. You made it rain.'
  },
  {
    id: 'first-contact',
    tier: 'new',
    name: 'First Contact',
    description: 'First match logged. PRS doesn’t grade on attendance — we do.'
  },
  {
    id: 'ammo-budget-denial',
    tier: 'mid',
    name: 'Ammo Budget Denial',
    description: '1,000 rounds logged. The finance office has questions.'
  },
  {
    id: 'stage-captain-adjacent',
    tier: 'mid',
    name: 'Stage Captain Adjacent',
    description: '5 matches logged. You know where the RO stands.'
  },
  {
    id: 'kitchen-table-armorer',
    tier: 'mid',
    name: 'Kitchen Table Armorer',
    description: 'First handload lot. Powder scales beat takeout.'
  },
  {
    id: 'barrel-retirement',
    tier: 'advanced',
    name: 'Barrel Retirement Ceremony',
    description: '2,500 rounds on a single barrel. Fold the flag.'
  },
  {
    id: 'full-battle-rattle',
    tier: 'advanced',
    name: 'Full Battle Rattle',
    description: 'Every part category for one platform filled. Looking operator.'
  },
  {
    id: 'podium-threat',
    tier: 'advanced',
    name: 'Podium Threat',
    description: 'Top-3 finish or ≥95.000% of winner on a match. Send it.'
  }
] as const

export function isMilestoneUnlocked(id: MilestoneId, snapshot: MilestoneSnapshot): boolean {
  switch (id) {
    case 'kit-up':
      return snapshot.systemCount > 0
    case 'brass-rain':
      return snapshot.totalRounds >= 100
    case 'first-contact':
      return snapshot.matchSessionCount >= 1
    case 'ammo-budget-denial':
      return snapshot.totalRounds >= 1000
    case 'stage-captain-adjacent':
      return snapshot.matchSessionCount >= 5
    case 'kitchen-table-armorer':
      return snapshot.hasHandloadAmmo
    case 'barrel-retirement':
      return snapshot.maxBarrelRounds >= 2500
    case 'full-battle-rattle':
      return PLATFORMS.some((platform) =>
        PLATFORM_PART_TYPES[platform].every((type) => snapshot.ownedPartTypes.includes(type))
      )
    case 'podium-threat': {
      const place = snapshot.bestMatchPlace
      const pct = snapshot.bestPercentOfWinner
      return (place != null && place >= 1 && place <= 3) || (pct != null && pct >= 95)
    }
    default: {
      const _exhaustive: never = id
      return _exhaustive
    }
  }
}

/** Pure evaluation — no I/O. */
export function evaluateMilestones(snapshot: MilestoneSnapshot): MilestonesSummary {
  const milestones = MILESTONE_DEFINITIONS.map((def) => ({
    ...def,
    unlocked: isMilestoneUnlocked(def.id, snapshot)
  }))
  return {
    milestones,
    unlockedCount: milestones.filter((m) => m.unlocked).length
  }
}
