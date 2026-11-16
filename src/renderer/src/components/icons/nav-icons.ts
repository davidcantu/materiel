import type { IconName } from './Icon'

/** Map primary nav ids → locked icon set names. */
export const NAV_ICONS: Record<string, IconName> = {
  dashboard: 'dashboard',
  inventory: 'inventory',
  builds: 'builds',
  logs: 'logs',
  ammo: 'ammo',
  settings: 'settings'
}
