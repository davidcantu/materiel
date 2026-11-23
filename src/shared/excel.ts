/**
 * Shared Excel sheet names / headers for Materiel export, sample template, and import.
 * Keep in sync with export-excel sheet builders.
 */

export const EXCEL_SHEET = {
  summary: 'Summary',
  inventory: 'Inventory',
  builds: 'Builds',
  logs: 'Logs',
  roundCounts: 'Round Counts',
  ammo: 'Ammo',
  instructions: 'Instructions'
} as const

export const INVENTORY_HEADERS = [
  'ID',
  'Type',
  'Platforms',
  'Manufacturer',
  'Model',
  'Name',
  'Cartridge',
  'Serial',
  'Status',
  'Lifetime rounds',
  'Rounds since clean',
  'Maint. interval',
  'Barrel life',
  'Twist',
  'Gunsmith',
  'Value',
  'Notes'
] as const

export const BUILDS_HEADERS = [
  'ID',
  'Name',
  'Type',
  'Platform',
  'Action/Primary',
  'Barrel',
  'Chassis/Furniture',
  'Optic',
  'Suppressor',
  'Factory mfr',
  'Factory model',
  'Factory cartridge',
  'Notes'
] as const

export const LOGS_HEADERS = [
  'ID',
  'Date',
  'Year',
  'Build ID',
  'Barrel ID',
  'Location',
  'Rounds',
  'Session',
  'Cartridge',
  'Velocity',
  'Place',
  '% of Winner',
  'Ammo ID',
  'Notes'
] as const

export const AMMO_HEADERS = [
  'ID',
  'Label',
  'Type',
  'Cartridge',
  'Qty',
  'Acquired',
  'Manufacturer',
  'Lot',
  'Bullet mfr',
  'Powder mfr',
  'Primer mfr',
  'Case mfr',
  'Notes'
] as const
