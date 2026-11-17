/**
 * Domain reference catalogs — manufacturer suggestions for Inventory / Builds /
 * Ammo & Reloading forms. Cap Case spellings from the approved brand prepopulate list.
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

/** Bolt / precision actions & rifles — Action + factory bolt builds. */
export const ACTION_MANUFACTURERS = [
  'Impact Precision',
  'Defiance Machine',
  'Bighorn Arms',
  'BAT Machine',
  'Lone Peak',
  'Remington',
  'Bergara',
  'Barrett',
  'Gunwerks',
  'Ruger',
  'Browning',
  'Tikka',
  'Savage',
  'Howa'
] as const

/** Known action models (cascading suggestions where available). */
export const ACTION_PRODUCTS: Record<string, string[]> = {
  'Impact Precision': ['737R Short Action'],
  'Defiance Machine': ['Deviant', 'Deviant Elite', 'Ruckus', 'Rebel'],
  'Bighorn Arms': ['TL3 Short Action', 'TL3 Long Action', 'SR3', 'Origin'],
  'BAT Machine': ['VR', 'HR', 'Hammerhead'],
  'Lone Peak': ['Fuzion SA', 'Fuzion-Ti SA']
}

/** AR / modern sporting — Lower, Upper, BCG, GasBlock + factory AR builds. */
export const AR_MANUFACTURERS = [
  'Aero Precision',
  'Bravo Company',
  'Daniel Defense',
  'Colt',
  'Palmetto State Armory',
  'CMMG',
  'FN',
  'Knights Armament',
  'Geissele',
  'Wilson Combat',
  'SOLGW',
  'Noveske',
  'LMT',
  'POF',
  'Q'
] as const

/** Pistols / handguns — Pistol, Frame, Slide + factory pistol builds. */
export const PISTOL_MANUFACTURERS = [
  'Glock',
  'SIG Sauer',
  'Smith & Wesson',
  'Springfield Armory',
  'CZ',
  'FN',
  'Heckler & Koch',
  'Wilson Combat',
  'Colt',
  'Ruger',
  'Kimber',
  'Staccato',
  'Canik',
  'Walther',
  'Beretta',
  'Zev Technologies'
] as const

export const OPTIC_MANUFACTURERS = [
  'Vortex',
  'Trijicon',
  'Aimpoint',
  'EOTech',
  'Holosun',
  'Leupold',
  'Nightforce',
  'Primary Arms',
  'Burris',
  'Steiner',
  'Kahles',
  'Zero Compromise Optic',
  'Schmidt & Bender',
  'March',
  'SIG Sauer'
] as const

export const BARREL_MANUFACTURERS = [
  'Proof Research',
  'Bartlein',
  'Krieger',
  'Criterion',
  'Lilja',
  'Brux',
  'Benchmark',
  'Hawk Hill',
  'Preferred',
  'X-Caliber',
  'ACE',
  'Faxon',
  'Ballistic Advantage',
  'Rainier Arms',
  'Palmetto State Armory',
  'Aero Precision'
] as const

/** Chassis, Stock, Handguard. */
export const CHASSIS_MANUFACTURERS = [
  'MDT',
  'Magpul',
  'Masterpiece Arms',
  'Cadex',
  'Accuracy International',
  'Manners',
  'McMillan',
  'KRG',
  'Foundation Stocks',
  'XLR Industries'
] as const

export const SUPPRESSOR_MANUFACTURERS = [
  'SilencerCo',
  'Dead Air',
  'SureFire',
  'Otter Creek Labs',
  'Thunder Beast',
  'SIG Sauer',
  'Q',
  'Griffin Armament',
  'Diligent Defense',
  'Area 419',
  'Knights Armament'
] as const

export const MUZZLE_BRAKE_MANUFACTURERS = [
  'Area 419',
  'American Precision Arms',
  'Precision Armament',
  'MDT',
  'DemiGod Precision'
] as const

export const TRIGGER_MANUFACTURERS = [
  'Geissele',
  'Timney',
  'TriggerTech',
  'CMC Triggers',
  'LaRue Tactical',
  'Elftmann',
  'Apex Tactical',
  'Overwatch Precision',
  'Flatline Impulse',
  'Bix & Andy'
] as const

export const LIGHT_LASER_MANUFACTURERS = [
  'SureFire',
  'Streamlight',
  'Modlite',
  'Arisaka',
  'Steiner',
  'Wilcox',
  'L3Harris',
  'Holosun',
  'B.E. Meyers'
] as const

export const MISC_MANUFACTURERS = [
  'Magpul',
  'Atlas',
  'Area 419',
  'Really Right Stuff',
  'Accu-Tac',
  'Harris',
  'Badger Ordnance',
  'Spuhr',
  'American Defense Mfg',
  'Arisaka'
] as const

/** Factory ammo lot manufacturer field. */
export const FACTORY_AMMO_MANUFACTURERS = [
  'Hornady',
  'Federal',
  'Winchester',
  'Remington',
  'SIG Sauer',
  'PMC',
  'Fiocchi',
  'Black Hills',
  'Nosler',
  'Sellier & Bellot',
  'Speer',
  'Underwood',
  'Magtech',
  'Norma',
  'Lapua',
  'Barnes'
] as const

export const BRASS_MANUFACTURERS = [
  'Lapua',
  'Hornady',
  'Peterson Cartridge',
  'Alpha Munitions',
  'Starline Brass',
  'Norma',
  'Federal',
  'Nosler',
  'ADG'
] as const

/** Product cascades (optional model suggestions). Manufacturers without products still appear in lists. */
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

export const BULLET_MANUFACTURERS = [
  'Berger',
  'Hornady',
  'Sierra',
  'Nosler',
  'Barnes',
  'Lapua'
] as const

export const POWDER_MANUFACTURERS = [
  'Hodgdon',
  'Vihtavuori',
  'Alliant',
  'IMR',
  'Accurate',
  'Ramshot',
  'Winchester',
  'Vectan',
  'Shooters World'
] as const

export const PRIMER_MANUFACTURERS = ['CCI', 'Federal', 'Remington', 'Winchester'] as const

export function manufacturersForPartType(
  type: string,
  muzzleType?: 'Suppressor' | 'Brake'
): string[] {
  switch (type) {
    case 'Action':
      return [...ACTION_MANUFACTURERS]
    case 'Barrel':
      return [...BARREL_MANUFACTURERS]
    case 'Chassis':
    case 'Stock':
    case 'Handguard':
      return [...CHASSIS_MANUFACTURERS]
    case 'Optic':
      return [...OPTIC_MANUFACTURERS]
    case 'Suppressor':
      return muzzleType === 'Brake'
        ? [...MUZZLE_BRAKE_MANUFACTURERS]
        : [...SUPPRESSOR_MANUFACTURERS]
    case 'Lower':
    case 'Upper':
    case 'BCG':
    case 'GasBlock':
      return [...AR_MANUFACTURERS]
    case 'Pistol':
    case 'Frame':
    case 'Slide':
      return [...PISTOL_MANUFACTURERS]
    case 'Trigger':
      return [...TRIGGER_MANUFACTURERS]
    case 'Light':
    case 'LaserIR':
      return [...LIGHT_LASER_MANUFACTURERS]
    case 'Misc':
      return [...MISC_MANUFACTURERS]
    default:
      return []
  }
}

/** Factory complete-firearm manufacturer suggestions by platform. */
export function factoryManufacturersForPlatform(platform: string): string[] {
  if (platform === 'ar_pattern') return [...AR_MANUFACTURERS]
  if (platform === 'pistol') return [...PISTOL_MANUFACTURERS]
  return [...ACTION_MANUFACTURERS]
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
