/**
 * In-memory sticky defaults for the current app session (cleared on quit).
 * Last firearm system, location, and ammo lot until the user changes them.
 */

export type LogSessionDefaults = {
  systemId: string | null
  location: string | null
  ammoId: string | null
}

let defaults: LogSessionDefaults = {
  systemId: null,
  location: null,
  ammoId: null
}

export function getLogSessionDefaults(): LogSessionDefaults {
  return { ...defaults }
}

export function rememberLogSessionDefaults(patch: Partial<LogSessionDefaults>): LogSessionDefaults {
  defaults = {
    systemId: patch.systemId !== undefined ? patch.systemId : defaults.systemId,
    location: patch.location !== undefined ? patch.location : defaults.location,
    ammoId: patch.ammoId !== undefined ? patch.ammoId : defaults.ammoId
  }
  return getLogSessionDefaults()
}

/** Test helper — reset sticky state between cases. */
export function clearLogSessionDefaults(): void {
  defaults = { systemId: null, location: null, ammoId: null }
}
