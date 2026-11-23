/**
 * Prefill ammo inventory fields from a load-development recipe.
 */

import { defaultAmmoName, type AmmoInput } from './ammo'
import type { LoadDevelopmentInfo } from './loads'

/** Today's date as YYYY-MM-DD for Make Ammo prefills. */
export function todayIsoDate(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Map a load recipe into ammo create fields (quantity left for the caller). */
export function ammoInputFromLoad(
  load: LoadDevelopmentInfo,
  quantity: number,
  options?: { acquiredDate?: string; name?: string }
): AmmoInput {
  const acquiredDate = options?.acquiredDate ?? todayIsoDate()
  return {
    name: options?.name ?? defaultAmmoName({ caliber: load.caliber, type: 'Handload', acquiredDate }),
    type: 'Handload',
    caliber: load.caliber,
    quantity,
    acquiredDate,
    loadId: load.id,
    bulletManufacturer: load.bulletManufacturer || null,
    bulletType: load.bulletModel || null,
    powderManufacturer: load.powderManufacturer || null,
    powder: load.powderModel || null,
    chargeWeight: load.powderCharge,
    primerManufacturer: load.primerManufacturer || null,
    primer: load.primerModel || null,
    caseManufacturer: load.brassManufacturer || null,
    caseName: null,
    seatingDepth: load.cbto != null ? String(load.cbto) : load.lands != null ? String(load.lands) : null
  }
}
