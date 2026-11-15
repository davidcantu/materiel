/**
 * Optional demo seed (dev only). Gated by openDatabase({ seedDemo: true })
 * or MAIN_VITE_SEED_DEMO=true.
 *
 * Single-user local profile — no multi-user demo accounts / passwords.
 * Historical log rows are inserted directly so seeded round counts match the
 * sample inventory totals (side-effect helpers are for live mutations).
 */

import type Database from 'better-sqlite3-multiple-ciphers'
import { createCustomSystem } from './systems'

function nowIso(): string {
  return new Date().toISOString()
}

function isEmpty(db: Database.Database): boolean {
  const parts = db.prepare(`SELECT COUNT(*) AS c FROM parts`).get() as { c: number }
  const systems = db.prepare(`SELECT COUNT(*) AS c FROM systems`).get() as { c: number }
  return parts.c === 0 && systems.c === 0
}

export function seedDemoIfEmpty(db: Database.Database): boolean {
  if (!isEmpty(db)) {
    return false
  }

  const run = db.transaction(() => {
    const createdAt = nowIso()

    db.prepare(
      `INSERT INTO profile (
        id, username, first_name, last_name, email, city, state, country,
        competition_series, track_value, track_ammo, unlock_pin_set,
        created_at, updated_at
      ) VALUES (
        'local-profile', 'david@example.local', 'David', 'Cantu', 'david@example.local', 'Austin', 'TX', 'USA',
        '["PRS","NRL"]', 1, 1, 0, @createdAt, @createdAt
      )`
    ).run({ createdAt })

    const insertPart = db.prepare(
      `INSERT INTO parts (
        id, manufacturer, value, type, status, platforms, model, serial_number,
        total_round_count, rounds_after_cleaning, maintenance_interval,
        caliber, gunsmith, twist_rate, barrel_life, muzzle_type, notes,
        created_at, updated_at
      ) VALUES (
        @id, @manufacturer, @value, @type, 'In Stock', @platforms, @model, @serialNumber,
        @totalRoundCount, @roundsAfterCleaning, @maintenanceInterval,
        @caliber, @gunsmith, @twistRate, @barrelLife, NULL, NULL,
        @createdAt, @createdAt
      )`
    )

    insertPart.run({
      id: 'part-action-1',
      manufacturer: 'Impact',
      value: 1400,
      type: 'Action',
      platforms: '["bolt_action"]',
      model: '737R',
      serialNumber: 'IMP-001',
      totalRoundCount: 1650,
      roundsAfterCleaning: 150,
      maintenanceInterval: 500,
      caliber: null,
      gunsmith: null,
      twistRate: null,
      barrelLife: null,
      createdAt
    })

    insertPart.run({
      id: 'part-barrel-1',
      manufacturer: 'Proof Research',
      value: 850,
      type: 'Barrel',
      platforms: '["bolt_action"]',
      model: 'Carbon 26',
      serialNumber: null,
      totalRoundCount: 1650,
      roundsAfterCleaning: 150,
      maintenanceInterval: 300,
      caliber: '6.5 Creedmoor',
      gunsmith: 'S&S Precision',
      twistRate: 8,
      barrelLife: 3000,
      createdAt
    })

    insertPart.run({
      id: 'part-chassis-1',
      manufacturer: 'MDT',
      value: 1200,
      type: 'Chassis',
      platforms: '["bolt_action"]',
      model: 'ACC Premier Chassis',
      serialNumber: null,
      totalRoundCount: 0,
      roundsAfterCleaning: 0,
      maintenanceInterval: null,
      caliber: null,
      gunsmith: null,
      twistRate: null,
      barrelLife: null,
      createdAt
    })

    insertPart.run({
      id: 'part-optic-1',
      manufacturer: 'Vortex',
      value: 3000,
      type: 'Optic',
      platforms: '["bolt_action"]',
      model: 'Razor Gen III 6-36x56',
      serialNumber: 'VTX-001',
      totalRoundCount: 0,
      roundsAfterCleaning: 0,
      maintenanceInterval: null,
      caliber: null,
      gunsmith: null,
      twistRate: null,
      barrelLife: null,
      createdAt
    })

    createCustomSystem(db, {
      id: 'system-match-65',
      name: 'Match 6.5 Creedmoor',
      platform: 'bolt_action',
      actionId: 'part-action-1',
      barrelId: 'part-barrel-1',
      chassisId: 'part-chassis-1',
      opticId: 'part-optic-1'
    })

    db.prepare(
      `INSERT INTO ammo_inventory (
        id, name, type, caliber, quantity, manufacturer, lot_number,
        created_at, updated_at
      ) VALUES (
        'ammo-1', 'Hornady ELD-M 140', 'Factory', '6.5 Creedmoor', 200,
        'Hornady', 'LOT-A', @createdAt, @createdAt
      )`
    ).run({ createdAt })

    const insertLog = db.prepare(
      `INSERT INTO shooting_logs (
        id, system_id, barrel_id, ammo_id, cartridge, date, location,
        rounds_fired, velocity, session_type, notes, created_at, updated_at
      ) VALUES (
        @id, 'system-match-65', 'part-barrel-1', 'ammo-1', NULL, @date, @location,
        @roundsFired, @velocity, @sessionType, NULL, @createdAt, @createdAt
      )`
    )

    insertLog.run({
      id: 'log-1',
      date: '2026-11-01',
      location: 'Capital City Range',
      roundsFired: 120,
      velocity: 2750,
      sessionType: 'Match',
      createdAt
    })

    insertLog.run({
      id: 'log-2',
      date: '2026-11-08',
      location: 'Capital City Range',
      roundsFired: 80,
      velocity: 2755,
      sessionType: 'Practice',
      createdAt
    })

    db.prepare(
      `INSERT INTO backup_settings (
        id, auto_backup_enabled, backup_interval_hours, provider, updated_at
      ) VALUES (1, 1, 1, 'mock', @createdAt)`
    ).run({ createdAt })

    db.prepare(
      `INSERT INTO license_state (
        id, tier, key_present, updated_at
      ) VALUES (1, 'free', 0, @createdAt)`
    ).run({ createdAt })
  })

  run()
  return true
}
