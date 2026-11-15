/** Milestone definitions and §7.5 unlock evaluation. */

import type { PartType } from './parts'
import { PART_TYPES } from './parts'

export type MilestoneId =
  'iron-sights' | 'round-junkie' | 'match-ready' | 'handloader' | 'barrel-burner' | 'full-kit'

export type MilestoneDefinition = {
  id: MilestoneId
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
}

export type MilestoneStatus = MilestoneDefinition & {
  unlocked: boolean
}

export type MilestonesSummary = {
  milestones: MilestoneStatus[]
  unlockedCount: number
}

export const MILESTONE_DEFINITIONS: readonly MilestoneDefinition[] = [
  {
    id: 'iron-sights',
    name: 'Iron Sights',
    description: 'First build logged'
  },
  {
    id: 'round-junkie',
    name: 'Round Count Junkie',
    description: '1,000 rounds logged'
  },
  {
    id: 'match-ready',
    name: 'Match Ready',
    description: '5 competitions logged'
  },
  {
    id: 'handloader',
    name: 'Handloader',
    description: 'First handload lot created'
  },
  {
    id: 'barrel-burner',
    name: 'Barrel Burner',
    description: '2,500 rounds on a single barrel'
  },
  {
    id: 'full-kit',
    name: 'Full Kit',
    description: 'All 6 part categories filled'
  }
] as const

export function isMilestoneUnlocked(id: MilestoneId, snapshot: MilestoneSnapshot): boolean {
  switch (id) {
    case 'iron-sights':
      return snapshot.systemCount > 0
    case 'round-junkie':
      return snapshot.totalRounds >= 1000
    case 'match-ready':
      return snapshot.matchSessionCount >= 5
    case 'handloader':
      return snapshot.hasHandloadAmmo
    case 'barrel-burner':
      return snapshot.maxBarrelRounds >= 2500
    case 'full-kit':
      return PART_TYPES.every((type) => snapshot.ownedPartTypes.includes(type))
    default: {
      const _exhaustive: never = id
      return _exhaustive
    }
  }
}

/** Pure §7.5 evaluation — no I/O. */
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
