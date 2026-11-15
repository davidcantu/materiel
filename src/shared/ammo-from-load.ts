/**
 * Prefill ammo inventory fields from a load-development recipe.
 */

import type { AmmoInput } from './ammo'
import type { LoadDevelopmentInfo } from './loads'

/** Map a load recipe into ammo create fields (quantity left for the caller). */
export function ammoInputFromLoad(
  load: LoadDevelopmentInfo,
  quantity: number,
  options?: { name?: string; asPractice?: boolean }
): AmmoInput {
  const asPractice = options?.asPractice ?? true
  return {
    name: options?.name ?? (asPractice ? 'Practice Ammo' : load.name),
    type: 'Handload',
    caliber: load.caliber,
    quantity,
    loadId: load.id,
    bulletManufacturer: load.bulletManufacturer,
    bulletType: load.bulletModel,
    powderManufacturer: load.powderManufacturer,
    powder: load.powderModel,
    chargeWeight: load.powderCharge,
    primerManufacturer: load.primerManufacturer,
    primer: load.primerModel,
    caseManufacturer: load.brassManufacturer,
    caseName: load.brassModel,
    seatingDepth:
      load.cbto != null ? String(load.cbto) : load.coal != null ? String(load.coal) : null
  }
}
