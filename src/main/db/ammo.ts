/**
 * Minimal ammo inventory reads for shooting-log ammo selection.
 * Full Ammo module CRUD lands later.
 */

import type Database from 'better-sqlite3-multiple-ciphers'
import type { AmmoInventory, AmmoType } from './types'

type AmmoRow = {
  id: string
  name: string
  type: AmmoType
  caliber: string
  quantity: number
  load_id: string | null
  manufacturer: string | null
  lot_number: string | null
  notes: string | null
  bullet_manufacturer: string | null
  bullet_type: string | null
  powder_manufacturer: string | null
  powder: string | null
  charge_weight: number | null
  primer_manufacturer: string | null
  primer: string | null
  case_manufacturer: string | null
  case_name: string | null
  seating_depth: string | null
  created_at: string
  updated_at: string
}

function mapAmmo(row: AmmoRow): AmmoInventory {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    caliber: row.caliber,
    quantity: row.quantity,
    loadId: row.load_id,
    manufacturer: row.manufacturer,
    lotNumber: row.lot_number,
    notes: row.notes,
    bulletManufacturer: row.bullet_manufacturer,
    bulletType: row.bullet_type,
    powderManufacturer: row.powder_manufacturer,
    powder: row.powder,
    chargeWeight: row.charge_weight,
    primerManufacturer: row.primer_manufacturer,
    primer: row.primer,
    caseManufacturer: row.case_manufacturer,
    caseName: row.case_name,
    seatingDepth: row.seating_depth,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function listAmmoInventory(db: Database.Database): AmmoInventory[] {
  const rows = db
    .prepare(`SELECT * FROM ammo_inventory ORDER BY caliber ASC, name ASC`)
    .all() as AmmoRow[]
  return rows.map(mapAmmo)
}

export function getAmmoInventory(db: Database.Database, id: string): AmmoInventory | null {
  const row = db.prepare(`SELECT * FROM ammo_inventory WHERE id = ?`).get(id) as AmmoRow | undefined
  return row ? mapAmmo(row) : null
}
