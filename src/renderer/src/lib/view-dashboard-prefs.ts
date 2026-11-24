/**
 * Persist which dashboard panels are visible (localStorage).
 */

import {
  DASHBOARD_PANEL_IDS,
  DEFAULT_DASHBOARD_PANELS,
  type DashboardPanelId
} from '../../../shared/dashboard'

const KEY = 'materiel.dashboardPanels.v1'

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export function normalizeDashboardPanels(raw: unknown): DashboardPanelId[] {
  if (!Array.isArray(raw)) return [...DEFAULT_DASHBOARD_PANELS]
  const allowed = new Set<string>(DASHBOARD_PANEL_IDS)
  const seen = new Set<string>()
  const picked: DashboardPanelId[] = []
  for (const value of raw) {
    if (typeof value !== 'string' || !allowed.has(value) || seen.has(value)) continue
    seen.add(value)
    picked.push(value as DashboardPanelId)
  }
  // Keep canonical order for display.
  const ordered = DASHBOARD_PANEL_IDS.filter((id) => picked.includes(id))
  return ordered.length > 0 ? [...ordered] : [...DEFAULT_DASHBOARD_PANELS]
}

export function loadDashboardPanels(): DashboardPanelId[] {
  return normalizeDashboardPanels(readJson(KEY))
}

export function saveDashboardPanels(panels: DashboardPanelId[]): void {
  localStorage.setItem(KEY, JSON.stringify(normalizeDashboardPanels(panels)))
}

export function dashboardPanelsEqual(a: readonly DashboardPanelId[], b: readonly DashboardPanelId[]): boolean {
  if (a.length !== b.length) return false
  return a.every((id, index) => id === b[index])
}
