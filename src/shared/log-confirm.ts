/**
 * Confirm-summary line for shooting-log save (e.g. "42 rounds · .308 · Lot X · 40 left").
 */

import type { AmmoInventoryInfo } from './ammo'

export type LogConfirmParts = {
  roundsFired: number
  cartridge: string | null
  ammo: AmmoInventoryInfo | null
  location: string
  systemName: string | null
}

export function formatLogConfirmSummary(parts: LogConfirmParts): string {
  const bits: string[] = []
  bits.push(`${parts.roundsFired} round${parts.roundsFired === 1 ? '' : 's'}`)

  const cartridge = parts.cartridge?.trim() || parts.ammo?.caliber || null
  if (cartridge) bits.push(cartridge)

  if (parts.ammo) {
    const lot = parts.ammo.lotNumber?.trim()
    bits.push(lot ? `Lot ${lot}` : parts.ammo.name)
    const remaining = parts.ammo.quantity - parts.roundsFired
    bits.push(`${remaining} left`)
  } else {
    bits.push('Manual entry')
  }

  if (parts.location.trim()) bits.push(parts.location.trim())
  return bits.join(' · ')
}
