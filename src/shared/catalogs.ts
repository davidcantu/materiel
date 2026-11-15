/**
 * Domain reference catalogs — software-spec §8
 * (Inventory / Builds / Ammo & Reloading forms).
 */

export const CARTRIDGE_OPTIONS = [
  '.223',
  '.243',
  '.308',
  '22 GT',
  '25 Creedmoor',
  '25 Dasher',
  '25 GT',
  '25x47 Lapua',
  '260 Remington',
  '6 ARC',
  '6.5 Creedmoor',
  '6.5x47 Lapua',
  '6XC',
  '6mm BR',
  '6mm BRA',
  '6mm BRX',
  '6mm Creedmoor',
  '6mm Dasher',
  '6mm GT',
  '6x47 Lapua',
  '7 SWC'
] as const

export const BARREL_MANUFACTURERS = [
  'ACE',
  'Bartlein',
  'Benchmark',
  'Brux',
  'CRB',
  'Criterion',
  'Hawk Hill',
  'Krieger',
  'Lilja',
  'Preferred',
  'Proof Research',
  'X-Caliber'
] as const

export const ACTION_PRODUCTS: Record<string, string[]> = {
  'Impact Precision': ['737R Short Action'],
  'Defiance Machine': ['Deviant', 'Deviant Elite', 'Ruckus', 'Rebel'],
  'Bighorn Arms': ['TL3 Short Action', 'TL3 Long Action', 'SR3', 'Origin'],
  'BAT Machine': ['VR', 'HR', 'Hammerhead'],
  'Lone Peak': ['Fuzion SA', 'Fuzion-Ti SA']
}

export const SUPPRESSOR_MANUFACTURERS = [
  'Area 419',
  'B.O.S.S. Silencers',
  'Caliber Gunsmithing',
  'Crux Suppressors',
  'Dead Air Silencers',
  'Delta P Design',
  'Diligent Defense Co.',
  'Elite Iron Suppressors',
  'KGM Suppressors',
  'Knights Armament Company',
  'Lane Silencers and Guns',
  'Leviathan Suppressors LLC',
  'Liberty Precision Machine',
  'Mack Brothers',
  'Otter Creek Labs',
  'Q LLC',
  'Quicksilver Manufacturing LLC',
  'Resilient Suppressors',
  'SAS',
  'Sig Sauer',
  'Silencer Tech LLC',
  'SilencerCo',
  'SureFire',
  'Thunder Beast Arms Corp'
] as const

export const MUZZLE_BRAKE_MANUFACTURERS = [
  'ACE Precision LLC',
  'American Precision Arms',
  'Area 419',
  'Axis Precision Worx',
  'Badger Ordnance',
  'Bergara',
  'Botnia Solutions',
  'Center Shot Rifles (CSR) Blast Tamer',
  'Custom',
  'DemiGod Precision',
  'EC Tuner Brake',
  'H-S Precision',
  'Hawkins Precision',
  "Holland's Shooters Supply, INC.",
  "Hunt's Long Range",
  'Impact Precision Shooting',
  'Insite Arms',
  'JP Enterprises',
  'Kahntrol Solutions',
  'Lone Peak Arms',
  'MBM Beast',
  'MDT',
  'MDT Comp Brake',
  'Masterpiece Arms',
  'Patriot Valley Arms',
  'Phantom Firearms',
  'Piercision Rifles',
  'Precision Armament',
  'Preece Precision - Stinger',
  'Salmon River Solutions',
  'SilencerCo',
  'Spartan Precision Rifles',
  'Spearhead Machine',
  'Strike Without Warning TMB',
  'SureShot Precision Rifles',
  'Terminator Products',
  'Thunder Beast Arms Corp',
  'Vision Vulcan',
  'ZRO Delta'
] as const

/** §8.6 Reloading manufacturers & standard products */
export const BULLET_PRODUCTS: Record<string, string[]> = {
  Berger: [
    '105gr Hybrid Target',
    '109gr LRHT',
    '105gr VLD Target',
    '135gr LRHT',
    '133gr Elite Hunter',
    '153.5gr LRHT',
    '140gr Hybrid Target',
    '156gr EOL Elite Hunter'
  ],
  Hornady: [
    '110gr A-Tip',
    '108gr ELD-M',
    '109gr ELD-M',
    '138gr A-Tip',
    '134gr ELD-M',
    '153gr A-Tip',
    '147gr ELD-M'
  ],
  Sierra: ['107gr MatchKing', '110gr MatchKing', '115gr DTAC', '131gr MatchKing'],
  Nosler: ['6mm 105gr RDF', '6mm 115gr RDF']
}

export const POWDER_PRODUCTS: Record<string, string[]> = {
  Hodgdon: ['Varget', 'H4350', 'H4831SC', 'H1000', 'Retumbo'],
  Vihtavuori: ['N150', 'N160', 'N555'],
  Alliant: ['Reloder 15', 'Reloder 16'],
  IMR: ['IMR 4166', 'IMR 4451', 'IMR 4955']
}

export const PRIMER_PRODUCTS: Record<string, string[]> = {
  CCI: ['#450', '#400'],
  Federal: ['GM205M', 'GM205', 'GM210M']
}

export const BRASS_MANUFACTURERS = [
  'Alpha Munitions',
  'Federal',
  'Gunwerks',
  'Hornady',
  'Lapua',
  'Norma Ammunition',
  'Nosler',
  'Peterson Cartridge',
  'Prime',
  'Sig Sauer',
  'Starline Brass'
] as const

export const BULLET_MANUFACTURERS = Object.keys(BULLET_PRODUCTS)
export const POWDER_MANUFACTURERS = Object.keys(POWDER_PRODUCTS)
export const PRIMER_MANUFACTURERS = Object.keys(PRIMER_PRODUCTS)

export function manufacturersForPartType(
  type: string,
  muzzleType?: 'Suppressor' | 'Brake'
): string[] {
  if (type === 'Action') return Object.keys(ACTION_PRODUCTS)
  if (type === 'Barrel') return [...BARREL_MANUFACTURERS]
  if (type === 'Suppressor') {
    return muzzleType === 'Brake' ? [...MUZZLE_BRAKE_MANUFACTURERS] : [...SUPPRESSOR_MANUFACTURERS]
  }
  return []
}

export function modelsForActionManufacturer(manufacturer: string): string[] {
  return ACTION_PRODUCTS[manufacturer] ?? []
}

export function productsForBulletManufacturer(manufacturer: string): string[] {
  return BULLET_PRODUCTS[manufacturer] ?? []
}

export function productsForPowderManufacturer(manufacturer: string): string[] {
  return POWDER_PRODUCTS[manufacturer] ?? []
}

export function productsForPrimerManufacturer(manufacturer: string): string[] {
  return PRIMER_PRODUCTS[manufacturer] ?? []
}
