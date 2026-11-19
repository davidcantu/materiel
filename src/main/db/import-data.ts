/**
 * Apply a MaterielImportDocument inside one SQLite transaction.
 *
 * Workaround for action+barrel-only sources: optional shared placeholder Chassis
 * so custom builds (and therefore shooting logs) can be created.
 */

import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3-multiple-ciphers'
import type {
  MaterielImportBuild,
  MaterielImportDocument,
  MaterielImportLog,
  MaterielImportPart,
  MaterielImportResult,
  MaterielImportSummary
} from '../../shared/import'
import { MATERIEL_IMPORT_VERSION } from '../../shared/import'
import type { PartType } from '../../shared/parts'
import { PART_TYPES } from '../../shared/parts'
import type { Platform } from '../../shared/platforms'
import { createPart, getPart } from './parts'
import { addShootingLog } from './shooting-logs'
import { createCustomSystem } from './systems'

const PART_TYPE_SET = new Set<string>(PART_TYPES)

function isPlatform(value: unknown): value is Platform {
  return value === 'bolt_action' || value === 'ar_pattern' || value === 'pistol'
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required`)
  }
  return value.trim()
}

function optionalString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function parseDocument(raw: unknown): MaterielImportDocument {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Import JSON must be an object')
  }
  const doc = raw as MaterielImportDocument
  if (doc.version !== MATERIEL_IMPORT_VERSION) {
    throw new Error(`Unsupported import version (expected ${MATERIEL_IMPORT_VERSION})`)
  }
  if (!Array.isArray(doc.parts) || doc.parts.length === 0) {
    throw new Error('Import JSON must include a non-empty parts array')
  }
  return doc
}

function normalizePart(raw: MaterielImportPart, warnings: string[]): MaterielImportPart {
  const id = requireString(raw.id, 'parts[].id')
  const type = requireString(raw.type, `parts[${id}].type`) as PartType
  if (!PART_TYPE_SET.has(type)) {
    throw new Error(`Unknown part type "${type}" for ${id}`)
  }
  const manufacturer = requireString(raw.manufacturer, `parts[${id}].manufacturer`)

  let serialNumber = optionalString(raw.serialNumber)
  if ((type === 'Action' || type === 'Lower' || type === 'Pistol' || type === 'Frame') && !serialNumber) {
    serialNumber = `IMPORT-${id}`
    warnings.push(`Synthesized serial ${serialNumber} for ${type} ${id}`)
  }

  let name = optionalString(raw.name)
  let caliber = optionalString(raw.caliber)
  let gunsmith = optionalString(raw.gunsmith)
  const model = optionalString(raw.model)

  if (type === 'Barrel') {
    if (!caliber) {
      throw new Error(`parts[${id}].caliber is required for Barrel`)
    }
    if (!name) {
      name = model ? `${manufacturer} ${model}` : `${manufacturer} ${caliber}`
      warnings.push(`Synthesized barrel name "${name}" for ${id}`)
    }
    if (!gunsmith) {
      gunsmith = 'Imported'
      warnings.push(`Defaulted gunsmith to "Imported" for barrel ${id}`)
    }
  }

  const platforms =
    Array.isArray(raw.platforms) && raw.platforms.length > 0
      ? raw.platforms.filter(isPlatform)
      : undefined

  return {
    ...raw,
    id,
    type,
    manufacturer,
    model,
    name,
    caliber,
    gunsmith,
    serialNumber,
    platforms,
    notes: optionalString(raw.notes)
  }
}

function resolveBuildKey(actionId: string, barrelId: string): string {
  return `${actionId}::${barrelId}`
}

export function importMaterielDocument(
  db: Database.Database,
  raw: unknown
): MaterielImportResult {
  try {
    const doc = parseDocument(raw)
    const warnings: string[] = []
    const options = doc.options ?? {}
    const createPlaceholder = options.createPlaceholderChassis !== false
    const autoPair = options.autoPairBuilds === true
    const defaultPlatform: Platform = isPlatform(options.defaultPlatform)
      ? options.defaultPlatform
      : 'bolt_action'

    const summary: MaterielImportSummary = {
      partsCreated: 0,
      buildsCreated: 0,
      logsCreated: 0,
      placeholderChassisId: null,
      warnings
    }

    const run = db.transaction(() => {
      const idMap = new Map<string, string>() // document id → DB id

      for (const rawPart of doc.parts) {
        const part = normalizePart(rawPart, warnings)
        if (idMap.has(part.id)) {
          throw new Error(`Duplicate part id "${part.id}" in import file`)
        }
        if (getPart(db, part.id)) {
          // Allow stable UUIDs from a previous export — skip create, reuse.
          idMap.set(part.id, part.id)
          warnings.push(`Part id ${part.id} already exists — reusing`)
          continue
        }

        const created = createPart(db, {
          id: part.id,
          type: part.type,
          manufacturer: part.manufacturer,
          model: part.model,
          name: part.name,
          caliber: part.caliber,
          gunsmith: part.gunsmith,
          serialNumber: part.serialNumber,
          platforms: part.platforms,
          totalRoundCount: part.totalRoundCount ?? 0,
          roundsAfterCleaning: part.roundsAfterCleaning ?? 0,
          maintenanceInterval: part.maintenanceInterval,
          twistRate: part.twistRate,
          barrelLife: part.barrelLife,
          value: part.value ?? 0,
          notes: part.notes,
          status: 'In Stock'
        })
        idMap.set(part.id, created.id)
        summary.partsCreated += 1
      }

      let builds: MaterielImportBuild[] = Array.isArray(doc.builds) ? [...doc.builds] : []

      if (builds.length === 0 && autoPair) {
        const actions = doc.parts.filter((p) => p.type === 'Action').map((p) => p.id)
        const barrels = doc.parts.filter((p) => p.type === 'Barrel').map((p) => p.id)
        const n = Math.min(actions.length, barrels.length)
        if (n === 0) {
          throw new Error('autoPairBuilds is on but no Action/Barrel parts were found')
        }
        if (actions.length !== barrels.length) {
          warnings.push(
            `autoPairBuilds: pairing ${n} of ${actions.length} actions with ${barrels.length} barrels (document order)`
          )
        }
        for (let i = 0; i < n; i++) {
          const actionId = actions[i]!
          const barrelId = barrels[i]!
          const action = doc.parts.find((p) => p.id === actionId)
          const barrel = doc.parts.find((p) => p.id === barrelId)
          builds.push({
            id: `build-${actionId}-${barrelId}`,
            name: `${action?.manufacturer ?? 'Action'} + ${barrel?.name ?? barrelId}`,
            platform: defaultPlatform,
            actionId,
            barrelId
          })
        }
      }

      let placeholderChassisId: string | null = null
      const needsPlaceholder = builds.some((b) => {
        const platform = isPlatform(b.platform) ? b.platform : defaultPlatform
        return platform === 'bolt_action' && !b.chassisId
      })

      if (needsPlaceholder) {
        if (!createPlaceholder) {
          throw new Error(
            'Builds require a chassisId (or set options.createPlaceholderChassis to true)'
          )
        }
        placeholderChassisId = `chassis-import-placeholder`
        if (!getPart(db, placeholderChassisId)) {
          createPart(db, {
            id: placeholderChassisId,
            type: 'Chassis',
            manufacturer: options.placeholderChassis?.manufacturer?.trim() || 'Import',
            model: options.placeholderChassis?.model?.trim() || 'Placeholder Chassis',
            platforms: ['bolt_action'],
            notes:
              'Auto-created for JSON import so action+barrel pairs can form builds (and accept logs). Replace with a real chassis when ready.',
            status: 'In Stock'
          })
          summary.partsCreated += 1
          warnings.push('Created shared placeholder Chassis for imported builds')
        } else {
          warnings.push('Reusing existing placeholder Chassis chassis-import-placeholder')
        }
        summary.placeholderChassisId = placeholderChassisId
        idMap.set(placeholderChassisId, placeholderChassisId)
      }

      const buildIdMap = new Map<string, string>()
      const pairToBuildId = new Map<string, string>()

      for (const build of builds) {
        const name = requireString(build.name, 'builds[].name')
        const actionDocId = requireString(build.actionId, `builds[${name}].actionId`)
        const barrelDocId = requireString(build.barrelId, `builds[${name}].barrelId`)
        const actionId = idMap.get(actionDocId)
        const barrelId = idMap.get(barrelDocId)
        if (!actionId || !barrelId) {
          throw new Error(`Build "${name}" references unknown action/barrel ids`)
        }

        const platform = isPlatform(build.platform) ? build.platform : defaultPlatform
        let chassisId: string
        if (platform === 'pistol') {
          chassisId = actionId
        } else if (build.chassisId) {
          const mapped = idMap.get(build.chassisId)
          if (!mapped) throw new Error(`Build "${name}" references unknown chassisId`)
          chassisId = mapped
        } else if (platform === 'bolt_action') {
          chassisId = placeholderChassisId!
        } else if (platform === 'ar_pattern') {
          // AR furniture is Upper — if missing, synthesize a placeholder upper.
          const upperId = `upper-import-placeholder`
          if (!getPart(db, upperId)) {
            createPart(db, {
              id: upperId,
              type: 'Upper',
              manufacturer: 'Import',
              model: 'Placeholder Upper',
              platforms: ['ar_pattern'],
              notes: 'Auto-created for JSON import. Replace with a real upper when ready.',
              status: 'In Stock'
            })
            summary.partsCreated += 1
            warnings.push('Created shared placeholder Upper for AR imports')
          }
          chassisId = upperId
          idMap.set(upperId, upperId)
        } else {
          throw new Error(`Cannot resolve furniture for build "${name}"`)
        }

        const systemId = build.id?.trim() || randomUUID()
        if (getPart(db, systemId)) {
          // unlikely collision with part id
        }

        const created = createCustomSystem(db, {
          id: systemId,
          name,
          platform,
          actionId,
          barrelId,
          chassisId,
          notes:
            optionalString(build.notes) ??
            (build.chassisId
              ? null
              : 'Imported build — furniture slot uses a placeholder until you swap a real chassis/upper.')
        })

        if (build.id?.trim()) buildIdMap.set(build.id.trim(), created.id)
        buildIdMap.set(created.id, created.id)
        pairToBuildId.set(resolveBuildKey(actionDocId, barrelDocId), created.id)
        pairToBuildId.set(resolveBuildKey(actionId, barrelId), created.id)
        summary.buildsCreated += 1
      }

      const logs: MaterielImportLog[] = Array.isArray(doc.logs) ? doc.logs : []
      for (const log of logs) {
        let systemId: string | undefined
        if (log.buildId?.trim()) {
          systemId = buildIdMap.get(log.buildId.trim())
          if (!systemId) {
            throw new Error(`Log references unknown buildId "${log.buildId}"`)
          }
        } else if (log.actionId && log.barrelId) {
          systemId =
            pairToBuildId.get(resolveBuildKey(log.actionId.trim(), log.barrelId.trim())) ??
            pairToBuildId.get(
              resolveBuildKey(
                idMap.get(log.actionId.trim()) ?? '',
                idMap.get(log.barrelId.trim()) ?? ''
              )
            )
          if (!systemId) {
            throw new Error(
              `Log on ${log.date} has no matching build for action ${log.actionId} + barrel ${log.barrelId}`
            )
          }
        } else {
          throw new Error('Each log needs buildId or actionId+barrelId')
        }

        addShootingLog(db, {
          systemId,
          date: requireString(log.date, 'logs[].date'),
          location: requireString(log.location, 'logs[].location') || 'Imported',
          roundsFired: Number(log.roundsFired) || 0,
          sessionType: log.sessionType === 'Match' ? 'Match' : 'Practice',
          cartridge: optionalString(log.cartridge),
          velocity: log.velocity ?? null,
          placement: log.placement ?? null,
          percentOfWinner: log.percentOfWinner ?? null,
          notes: optionalString(log.notes)
        })
        summary.logsCreated += 1
      }
    })

    run()
    return { ok: true, summary }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Import failed'
    }
  }
}
