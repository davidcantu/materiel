/**
 * Milestone unlock state derived from local inventory / builds / logs (§7.5).
 * No persisted unlock table — recomputed on each read.
 */

import type Database from 'better-sqlite3-multiple-ciphers'
import type { PartType } from '../../shared/parts'
import { PART_TYPES } from '../../shared/parts'
import {
  evaluateMilestones,
  type MilestoneSnapshot,
  type MilestonesSummary
} from '../../shared/milestones'

function readMilestoneSnapshot(db: Database.Database): MilestoneSnapshot {
  const systemCount = (db.prepare(`SELECT COUNT(*) AS c FROM systems`).get() as { c: number }).c

  const totalRounds = (
    db.prepare(`SELECT COALESCE(SUM(rounds_fired), 0) AS total FROM shooting_logs`).get() as {
      total: number
    }
  ).total

  const matchSessionCount = (
    db.prepare(`SELECT COUNT(*) AS c FROM shooting_logs WHERE session_type = 'Match'`).get() as {
      c: number
    }
  ).c

  const hasHandloadAmmo =
    (
      db.prepare(`SELECT COUNT(*) AS c FROM ammo_inventory WHERE type = 'Handload'`).get() as {
        c: number
      }
    ).c > 0

  const maxBarrelRounds = (
    db
      .prepare(
        `SELECT COALESCE(MAX(total_round_count), 0) AS maxRounds
         FROM parts WHERE type = 'Barrel'`
      )
      .get() as { maxRounds: number }
  ).maxRounds

  const typeRows = db.prepare(`SELECT DISTINCT type FROM parts`).all() as Array<{ type: string }>
  const ownedPartTypes = typeRows
    .map((row) => row.type)
    .filter((type): type is PartType => (PART_TYPES as string[]).includes(type))

  return {
    systemCount,
    totalRounds,
    matchSessionCount,
    hasHandloadAmmo,
    maxBarrelRounds,
    ownedPartTypes
  }
}

export function getMilestonesSummary(db: Database.Database): MilestonesSummary {
  return evaluateMilestones(readMilestoneSnapshot(db))
}
