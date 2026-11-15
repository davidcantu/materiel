/** Appearance preference: OS default, or forced light/dark. */

export type ThemePreference = 'light' | 'dark' | 'system'

export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'materiel.theme'

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
]

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function getStoredThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemePreference(raw)) return raw
  } catch {
    // localStorage may be unavailable in locked-down environments
  }
  return 'system'
}

export function setStoredThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // ignore quota / private-mode failures; in-memory apply still works
  }
  applyThemePreference(preference)
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Apply resolved theme to <html data-theme="light|dark">. */
export function applyThemePreference(
  preference: ThemePreference = getStoredThemePreference()
): ResolvedTheme {
  const resolved = resolveTheme(preference)
  const root = document.documentElement
  root.dataset.theme = resolved
  root.dataset.themePreference = preference
  root.style.colorScheme = resolved
  return resolved
}

/** Re-apply when OS preference changes (only meaningful for System). */
export function subscribeSystemTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined
  }
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (): void => {
    onChange()
  }
  media.addEventListener('change', handler)
  return () => media.removeEventListener('change', handler)
}
