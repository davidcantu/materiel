/**
 * Complete-system helpers + factory part synthesis (software-spec §7.1).
 *
 * Creating/updating a factory build synthesizes core parts for the platform
 * (bolt: Action/Barrel/Chassis; AR: Lower/Barrel/Upper; pistol: single Pistol)
 * with ids `action-{sysId}`, `barrel-{sysId}`, `chassis-{sysId}`.
 * Deleting a factory build removes those synthesized parts.
 */

import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3-multiple-ciphers'
import { emptyPlatformCounts, type PlatformSystemCounts } from '../../shared/license'
import {
  PLATFORM_CORE_SLOTS,
  accessoryListTypes,
  isSingleCorePartPlatform,
  isValidPlatform,
  type Platform
} from '../../shared/platforms'
import { getPart } from './parts'
import type {
  CompleteSystem,
  CustomSystemInput,
  FactorySystemInput,
  PartStatus,
  PartType
} from './types'

type SystemRow = {
  id: string
  name: string
  build_type: 'custom' | 'factory'
  platform: string
  action_id: string
  barrel_id: string
  chassis_id: string
  optic_id: string | null
  suppressor_id: string | null
  laser_ir_id: string | null
  light_id: string | null
  image_url: string | null
  image_scale: number | null
  notes: string | null
  factory_manufacturer: string | null
  factory_model: string | null
  factory_cartridge: string | null
  factory_action_maintenance: number | null
  factory_barrel_maintenance: number | null
  created_at: string
  updated_at: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function resolvePlatform(value: string | null | undefined): Platform {
  if (value && isValidPlatform(value)) return value
  return 'bolt_action'
}

export function factoryPartIds(systemId: string): {
  actionId: string
  barrelId: string
  chassisId: string
} {
  return {
    actionId: `action-${systemId}`,
    barrelId: `barrel-${systemId}`,
    chassisId: `chassis-${systemId}`
  }
}

function getMiscPartIds(db: Database.Database, systemId: string): string[] {
  const rows = db
    .prepare(`SELECT part_id FROM system_misc_parts WHERE system_id = ? ORDER BY position ASC`)
    .all(systemId) as Array<{ part_id: string }>
  return rows.map((r) => r.part_id)
}

function mapSystem(db: Database.Database, row: SystemRow): CompleteSystem {
  return {
    id: row.id,
    name: row.name,
    buildType: row.build_type,
    platform: resolvePlatform(row.platform),
    actionId: row.action_id,
    barrelId: row.barrel_id,
    chassisId: row.chassis_id,
    opticId: row.optic_id,
    suppressorId: row.suppressor_id,
    laserIrId: row.laser_ir_id,
    lightId: row.light_id,
    miscPartIds: getMiscPartIds(db, row.id),
    imageUrl: row.image_url,
    imageScale: row.image_scale,
    notes: row.notes,
    factoryManufacturer: row.factory_manufacturer,
    factoryModel: row.factory_model,
    factoryCartridge: row.factory_cartridge,
    factoryActionMaintenance: row.factory_action_maintenance,
    factoryBarrelMaintenance: row.factory_barrel_maintenance,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function allReferencedPartIds(system: {
  actionId: string
  barrelId: string
  chassisId: string
  opticId?: string | null
  suppressorId?: string | null
  laserIrId?: string | null
  lightId?: string | null
  miscPartIds?: string[]
}): string[] {
  const ids = [system.actionId, system.barrelId, system.chassisId]
  if (system.opticId) ids.push(system.opticId)
  if (system.suppressorId) ids.push(system.suppressorId)
  if (system.laserIrId) ids.push(system.laserIrId)
  if (system.lightId) ids.push(system.lightId)
  if (system.miscPartIds) ids.push(...system.miscPartIds)
  return [...new Set(ids)]
}

function setPartsStatus(db: Database.Database, partIds: string[], status: PartStatus): void {
  const stmt = db.prepare(`UPDATE parts SET status = ?, updated_at = ? WHERE id = ?`)
  const updatedAt = nowIso()
  for (const id of partIds) {
    stmt.run(status, updatedAt, id)
  }
}

function replaceMiscParts(db: Database.Database, systemId: string, miscPartIds: string[]): void {
  if (miscPartIds.length > 8) {
    throw new Error('A system may reference at most 8 misc parts')
  }
  db.prepare(`DELETE FROM system_misc_parts WHERE system_id = ?`).run(systemId)
  const insert = db.prepare(
    `INSERT INTO system_misc_parts (system_id, part_id, position) VALUES (?, ?, ?)`
  )
  miscPartIds.forEach((partId, index) => {
    insert.run(systemId, partId, index)
  })
}

function assertPartSlot(
  db: Database.Database,
  partId: string,
  expectedType: PartType,
  platform: Platform,
  label: string
): void {
  const part = getPart(db, partId)
  if (!part) throw new Error(`${label} part not found: ${partId}`)
  if (part.type !== expectedType) {
    throw new Error(`${label} must be a ${expectedType} part for this platform`)
  }
  if (!part.platforms.includes(platform)) {
    throw new Error(`${label} is not compatible with this platform`)
  }
}

function assertOptionalSlot(
  db: Database.Database,
  partId: string | null | undefined,
  expectedType: PartType,
  platform: Platform,
  label: string
): void {
  if (!partId) return
  assertPartSlot(db, partId, expectedType, platform, label)
}

function validateCustomParts(
  db: Database.Database,
  platform: Platform,
  input: {
    actionId: string
    barrelId: string
    chassisId: string
    opticId?: string | null
    suppressorId?: string | null
    laserIrId?: string | null
    lightId?: string | null
    miscPartIds?: string[]
  }
): void {
  const core = PLATFORM_CORE_SLOTS[platform]
  assertPartSlot(db, input.actionId, core.primary, platform, 'Primary')
  if (isSingleCorePartPlatform(platform)) {
    if (input.barrelId !== input.actionId || input.chassisId !== input.actionId) {
      throw new Error('Pistol builds use one pistol part for all core slots')
    }
  } else {
    assertPartSlot(db, input.barrelId, core.barrel, platform, 'Barrel')
    assertPartSlot(db, input.chassisId, core.furniture, platform, 'Furniture')
  }
  assertOptionalSlot(db, input.opticId, 'Optic', platform, 'Optic')
  assertOptionalSlot(db, input.suppressorId, 'Suppressor', platform, 'Muzzle device')
  assertOptionalSlot(db, input.laserIrId, 'LaserIR', platform, 'Laser/IR')
  if (platform === 'bolt_action') {
    if (input.lightId) throw new Error('Weapon lights are not used on bolt-action builds')
  } else {
    assertOptionalSlot(db, input.lightId, 'Light', platform, 'Weapon light')
  }

  const allowedAccessory = new Set(accessoryListTypes(platform))
  for (const miscId of input.miscPartIds ?? []) {
    const part = getPart(db, miscId)
    if (!part) throw new Error(`Accessory part not found: ${miscId}`)
    if (!allowedAccessory.has(part.type)) {
      throw new Error(`${part.type} is not a valid accessory for this platform`)
    }
    if (!part.platforms.includes(platform)) {
      throw new Error(`Accessory is not compatible with this platform`)
    }
  }
}

function upsertFactoryPart(
  db: Database.Database,
  row: {
    id: string
    manufacturer: string
    type: PartType
    platforms: Platform
    model: string
    serialNumber: string | null
    maintenanceInterval: number | null
    caliber: string | null
    gunsmith: string | null
    twistRate: number | null
    barrelLife: number | null
  }
): void {
  const existing = db.prepare(`SELECT id FROM parts WHERE id = ?`).get(row.id) as
    { id: string } | undefined
  const updatedAt = nowIso()
  const platformsJson = JSON.stringify([row.platforms])

  if (existing) {
    db.prepare(
      `UPDATE parts SET
        manufacturer = @manufacturer,
        type = @type,
        platforms = @platforms,
        model = @model,
        serial_number = @serialNumber,
        maintenance_interval = @maintenanceInterval,
        caliber = @caliber,
        gunsmith = @gunsmith,
        twist_rate = @twistRate,
        barrel_life = @barrelLife,
        status = 'In Use',
        updated_at = @updatedAt
      WHERE id = @id`
    ).run({ ...row, platforms: platformsJson, updatedAt })
    return
  }

  db.prepare(
    `INSERT INTO parts (
      id, manufacturer, value, type, status, platforms, model, serial_number,
      total_round_count, rounds_after_cleaning, maintenance_interval,
      caliber, gunsmith, twist_rate, barrel_life, muzzle_type, notes,
      created_at, updated_at
    ) VALUES (
      @id, @manufacturer, 0, @type, 'In Use', @platforms, @model, @serialNumber,
      0, 0, @maintenanceInterval,
      @caliber, @gunsmith, @twistRate, @barrelLife, NULL, NULL,
      @createdAt, @updatedAt
    )`
  ).run({ ...row, platforms: platformsJson, createdAt: updatedAt, updatedAt })
}

/**
 * Upsert synthesized factory core parts for the given platform.
 */
export function synthesizeFactoryParts(
  db: Database.Database,
  input: {
    systemId: string
    platform: Platform
    manufacturer: string
    model: string
    cartridge: string
    actionMaintenance: number
    barrelMaintenance: number
  }
): { actionId: string; barrelId: string; chassisId: string } {
  const ids = factoryPartIds(input.systemId)
  const core = PLATFORM_CORE_SLOTS[input.platform]
  const serial =
    core.primary === 'Action' ||
    core.primary === 'Lower' ||
    core.primary === 'Frame' ||
    core.primary === 'Pistol'
      ? 'Factory Standard'
      : null

  if (isSingleCorePartPlatform(input.platform)) {
    upsertFactoryPart(db, {
      id: ids.actionId,
      manufacturer: input.manufacturer,
      type: core.primary,
      platforms: input.platform,
      model: `${input.model} (${input.cartridge})`,
      serialNumber: serial,
      maintenanceInterval: input.actionMaintenance,
      caliber: input.cartridge,
      gunsmith: null,
      twistRate: null,
      barrelLife: null
    })
    // One pistol part referenced by all three system columns.
    return { actionId: ids.actionId, barrelId: ids.actionId, chassisId: ids.actionId }
  }

  upsertFactoryPart(db, {
    id: ids.actionId,
    manufacturer: input.manufacturer,
    type: core.primary,
    platforms: input.platform,
    model: input.model,
    serialNumber: serial,
    maintenanceInterval: input.actionMaintenance,
    caliber: null,
    gunsmith: null,
    twistRate: null,
    barrelLife: null
  })

  upsertFactoryPart(db, {
    id: ids.barrelId,
    manufacturer: input.manufacturer,
    type: core.barrel,
    platforms: input.platform,
    model: input.model,
    serialNumber: null,
    maintenanceInterval: input.barrelMaintenance,
    caliber: input.cartridge,
    gunsmith: 'Factory',
    twistRate: 1,
    barrelLife: 3000
  })

  upsertFactoryPart(db, {
    id: ids.chassisId,
    manufacturer: input.manufacturer,
    type: core.furniture,
    platforms: input.platform,
    model: input.model,
    serialNumber: null,
    maintenanceInterval: null,
    caliber: null,
    gunsmith: null,
    twistRate: null,
    barrelLife: null
  })

  return ids
}

export function deleteSynthesizedFactoryParts(db: Database.Database, systemId: string): void {
  const ids = factoryPartIds(systemId)
  const del = db.prepare(`DELETE FROM parts WHERE id = ?`)
  del.run(ids.actionId)
  del.run(ids.barrelId)
  del.run(ids.chassisId)
}

export function getSystem(db: Database.Database, id: string): CompleteSystem | null {
  const row = db.prepare(`SELECT * FROM systems WHERE id = ?`).get(id) as SystemRow | undefined
  return row ? mapSystem(db, row) : null
}

export function listSystems(db: Database.Database): CompleteSystem[] {
  const rows = db
    .prepare(`SELECT * FROM systems ORDER BY name ASC, created_at ASC`)
    .all() as SystemRow[]
  return rows.map((row) => mapSystem(db, row))
}

export function countCompleteSystems(db: Database.Database): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM systems`).get() as { count: number }
  return row.count
}

export function countCompleteSystemsByPlatform(db: Database.Database): PlatformSystemCounts {
  const counts = emptyPlatformCounts()
  const rows = db
    .prepare(`SELECT platform, COUNT(*) AS count FROM systems GROUP BY platform`)
    .all() as {
    platform: string
    count: number
  }[]
  for (const row of rows) {
    const platform = resolvePlatform(row.platform)
    counts[platform] = row.count
  }
  return counts
}

export function createCustomSystem(
  db: Database.Database,
  input: CustomSystemInput
): CompleteSystem {
  const run = db.transaction(() => {
    const id = input.id ?? randomUUID()
    const createdAt = nowIso()
    const platform = resolvePlatform(input.platform)
    const miscPartIds = input.miscPartIds ?? []
    const laserIrId = input.laserIrId ?? null
    const lightId = platform === 'bolt_action' ? null : (input.lightId ?? null)
    const barrelId = isSingleCorePartPlatform(platform) ? input.actionId : input.barrelId
    const chassisId = isSingleCorePartPlatform(platform) ? input.actionId : input.chassisId

    validateCustomParts(db, platform, {
      ...input,
      barrelId,
      chassisId,
      laserIrId,
      lightId,
      miscPartIds
    })

    db.prepare(
      `INSERT INTO systems (
        id, name, build_type, platform, action_id, barrel_id, chassis_id,
        optic_id, suppressor_id, laser_ir_id, light_id,
        image_url, image_scale, notes,
        factory_manufacturer, factory_model, factory_cartridge,
        factory_action_maintenance, factory_barrel_maintenance,
        created_at, updated_at
      ) VALUES (
        @id, @name, 'custom', @platform, @actionId, @barrelId, @chassisId,
        @opticId, @suppressorId, @laserIrId, @lightId,
        @imageUrl, @imageScale, @notes,
        NULL, NULL, NULL, NULL, NULL,
        @createdAt, @updatedAt
      )`
    ).run({
      id,
      name: input.name,
      platform,
      actionId: input.actionId,
      barrelId,
      chassisId,
      opticId: input.opticId ?? null,
      suppressorId: input.suppressorId ?? null,
      laserIrId,
      lightId,
      imageUrl: input.imageUrl ?? null,
      imageScale: input.imageScale ?? 1,
      notes: input.notes ?? null,
      createdAt,
      updatedAt: createdAt
    })

    replaceMiscParts(db, id, miscPartIds)
    setPartsStatus(
      db,
      allReferencedPartIds({
        actionId: input.actionId,
        barrelId,
        chassisId,
        opticId: input.opticId,
        suppressorId: input.suppressorId,
        laserIrId,
        lightId,
        miscPartIds
      }),
      'In Use'
    )

    return getSystem(db, id)!
  })

  return run()
}

export function createFactorySystem(
  db: Database.Database,
  input: FactorySystemInput
): CompleteSystem {
  const run = db.transaction(() => {
    const id = input.id ?? randomUUID()
    const createdAt = nowIso()
    const platform = resolvePlatform(input.platform)
    const actionMaintenance = input.factoryActionMaintenance ?? 500
    const barrelMaintenance = input.factoryBarrelMaintenance ?? 300
    const miscPartIds = input.miscPartIds ?? []
    const laserIrId = input.laserIrId ?? null
    const lightId = platform === 'bolt_action' ? null : (input.lightId ?? null)

    assertOptionalSlot(db, input.opticId, 'Optic', platform, 'Optic')
    assertOptionalSlot(db, input.suppressorId, 'Suppressor', platform, 'Muzzle device')
    assertOptionalSlot(db, laserIrId, 'LaserIR', platform, 'Laser/IR')
    if (platform !== 'bolt_action') {
      assertOptionalSlot(db, lightId, 'Light', platform, 'Weapon light')
    }

    const synthesized = synthesizeFactoryParts(db, {
      systemId: id,
      platform,
      manufacturer: input.factoryManufacturer,
      model: input.factoryModel,
      cartridge: input.factoryCartridge,
      actionMaintenance,
      barrelMaintenance
    })

    db.prepare(
      `INSERT INTO systems (
        id, name, build_type, platform, action_id, barrel_id, chassis_id,
        optic_id, suppressor_id, laser_ir_id, light_id,
        image_url, image_scale, notes,
        factory_manufacturer, factory_model, factory_cartridge,
        factory_action_maintenance, factory_barrel_maintenance,
        created_at, updated_at
      ) VALUES (
        @id, @name, 'factory', @platform, @actionId, @barrelId, @chassisId,
        @opticId, @suppressorId, @laserIrId, @lightId,
        @imageUrl, @imageScale, @notes,
        @factoryManufacturer, @factoryModel, @factoryCartridge,
        @factoryActionMaintenance, @factoryBarrelMaintenance,
        @createdAt, @updatedAt
      )`
    ).run({
      id,
      name: input.name,
      platform,
      actionId: synthesized.actionId,
      barrelId: synthesized.barrelId,
      chassisId: synthesized.chassisId,
      opticId: input.opticId ?? null,
      suppressorId: input.suppressorId ?? null,
      laserIrId,
      lightId,
      imageUrl: input.imageUrl ?? null,
      imageScale: input.imageScale ?? 1,
      notes: input.notes ?? null,
      factoryManufacturer: input.factoryManufacturer,
      factoryModel: input.factoryModel,
      factoryCartridge: input.factoryCartridge,
      factoryActionMaintenance: actionMaintenance,
      factoryBarrelMaintenance: barrelMaintenance,
      createdAt,
      updatedAt: createdAt
    })

    replaceMiscParts(db, id, miscPartIds)
    setPartsStatus(
      db,
      allReferencedPartIds({
        actionId: synthesized.actionId,
        barrelId: synthesized.barrelId,
        chassisId: synthesized.chassisId,
        opticId: input.opticId,
        suppressorId: input.suppressorId,
        laserIrId,
        lightId,
        miscPartIds
      }),
      'In Use'
    )

    return getSystem(db, id)!
  })

  return run()
}

export function deleteSystem(db: Database.Database, id: string): void {
  const run = db.transaction(() => {
    const existing = getSystem(db, id)
    if (!existing) {
      throw new Error(`System not found: ${id}`)
    }

    const logCount = db
      .prepare(`SELECT COUNT(*) AS count FROM shooting_logs WHERE system_id = ?`)
      .get(id) as { count: number }
    if (logCount.count > 0) {
      throw new Error(
        `Cannot delete system ${id}: ${logCount.count} shooting log(s) still reference it`
      )
    }

    setPartsStatus(db, allReferencedPartIds(existing), 'In Stock')
    db.prepare(`DELETE FROM system_misc_parts WHERE system_id = ?`).run(id)
    db.prepare(`DELETE FROM systems WHERE id = ?`).run(id)

    if (existing.buildType === 'factory') {
      deleteSynthesizedFactoryParts(db, id)
    }
  })

  run()
}

/**
 * Update a system: reset previous parts to In Stock, re-synthesize factory parts if needed,
 * mark new references In Use (§7.1).
 */
export function updateSystem(
  db: Database.Database,
  id: string,
  patch: Partial<CustomSystemInput & FactorySystemInput> & { buildType?: 'custom' | 'factory' }
): CompleteSystem {
  const run = db.transaction(() => {
    const existing = getSystem(db, id)
    if (!existing) {
      throw new Error(`System not found: ${id}`)
    }

    setPartsStatus(db, allReferencedPartIds(existing), 'In Stock')

    const buildType = patch.buildType ?? existing.buildType
    const platform = resolvePlatform(patch.platform ?? existing.platform)
    const name = patch.name ?? existing.name
    const miscPartIds = patch.miscPartIds ?? existing.miscPartIds
    const opticId = patch.opticId !== undefined ? patch.opticId : existing.opticId
    const suppressorId =
      patch.suppressorId !== undefined ? patch.suppressorId : existing.suppressorId
    const laserIrId = patch.laserIrId !== undefined ? patch.laserIrId : existing.laserIrId
    let lightId = patch.lightId !== undefined ? patch.lightId : existing.lightId
    if (platform === 'bolt_action') {
      lightId = null
    }
    const updatedAt = nowIso()

    let actionId = patch.actionId ?? existing.actionId
    let barrelId = patch.barrelId ?? existing.barrelId
    let chassisId = patch.chassisId ?? existing.chassisId
    let factoryManufacturer = existing.factoryManufacturer
    let factoryModel = existing.factoryModel
    let factoryCartridge = existing.factoryCartridge
    let factoryActionMaintenance = existing.factoryActionMaintenance
    let factoryBarrelMaintenance = existing.factoryBarrelMaintenance

    if (buildType === 'factory') {
      factoryManufacturer = patch.factoryManufacturer ?? existing.factoryManufacturer
      factoryModel = patch.factoryModel ?? existing.factoryModel
      factoryCartridge = patch.factoryCartridge ?? existing.factoryCartridge
      factoryActionMaintenance =
        patch.factoryActionMaintenance ?? existing.factoryActionMaintenance ?? 500
      factoryBarrelMaintenance =
        patch.factoryBarrelMaintenance ?? existing.factoryBarrelMaintenance ?? 300

      if (!factoryManufacturer || !factoryModel || !factoryCartridge) {
        throw new Error('Factory systems require manufacturer, model, and cartridge')
      }

      assertOptionalSlot(db, opticId, 'Optic', platform, 'Optic')
      assertOptionalSlot(db, suppressorId, 'Suppressor', platform, 'Muzzle device')
      assertOptionalSlot(db, laserIrId, 'LaserIR', platform, 'Laser/IR')
      if (platform !== 'bolt_action') {
        assertOptionalSlot(db, lightId, 'Light', platform, 'Weapon light')
      }

      const synthesized = synthesizeFactoryParts(db, {
        systemId: id,
        platform,
        manufacturer: factoryManufacturer,
        model: factoryModel,
        cartridge: factoryCartridge,
        actionMaintenance: factoryActionMaintenance,
        barrelMaintenance: factoryBarrelMaintenance
      })
      actionId = synthesized.actionId
      barrelId = synthesized.barrelId
      chassisId = synthesized.chassisId
    } else {
      if (existing.buildType === 'factory' && buildType === 'custom') {
        if (isSingleCorePartPlatform(platform)) {
          if (!patch.actionId) {
            throw new Error('Switching a factory pistol to custom requires a pistol part')
          }
          actionId = patch.actionId
          barrelId = patch.actionId
          chassisId = patch.actionId
        } else if (!patch.actionId || !patch.barrelId || !patch.chassisId) {
          throw new Error(
            'Switching a factory system to custom requires actionId, barrelId, and chassisId'
          )
        } else {
          actionId = patch.actionId
          barrelId = patch.barrelId
          chassisId = patch.chassisId
        }
        factoryManufacturer = null
        factoryModel = null
        factoryCartridge = null
        factoryActionMaintenance = null
        factoryBarrelMaintenance = null
      }

      if (isSingleCorePartPlatform(platform)) {
        barrelId = actionId
        chassisId = actionId
      }

      validateCustomParts(db, platform, {
        actionId,
        barrelId,
        chassisId,
        opticId,
        suppressorId,
        laserIrId,
        lightId,
        miscPartIds
      })
    }

    db.prepare(
      `UPDATE systems SET
        name = @name,
        build_type = @buildType,
        platform = @platform,
        action_id = @actionId,
        barrel_id = @barrelId,
        chassis_id = @chassisId,
        optic_id = @opticId,
        suppressor_id = @suppressorId,
        laser_ir_id = @laserIrId,
        light_id = @lightId,
        image_url = @imageUrl,
        image_scale = @imageScale,
        notes = @notes,
        factory_manufacturer = @factoryManufacturer,
        factory_model = @factoryModel,
        factory_cartridge = @factoryCartridge,
        factory_action_maintenance = @factoryActionMaintenance,
        factory_barrel_maintenance = @factoryBarrelMaintenance,
        updated_at = @updatedAt
      WHERE id = @id`
    ).run({
      id,
      name,
      buildType,
      platform,
      actionId,
      barrelId,
      chassisId,
      opticId,
      suppressorId,
      laserIrId,
      lightId,
      imageUrl: patch.imageUrl !== undefined ? patch.imageUrl : existing.imageUrl,
      imageScale: patch.imageScale !== undefined ? patch.imageScale : existing.imageScale,
      notes: patch.notes !== undefined ? patch.notes : existing.notes,
      factoryManufacturer,
      factoryModel,
      factoryCartridge,
      factoryActionMaintenance,
      factoryBarrelMaintenance,
      updatedAt
    })

    if (existing.buildType === 'factory' && buildType === 'custom') {
      deleteSynthesizedFactoryParts(db, id)
    }

    replaceMiscParts(db, id, miscPartIds)
    setPartsStatus(
      db,
      allReferencedPartIds({
        actionId,
        barrelId,
        chassisId,
        opticId,
        suppressorId,
        laserIrId,
        lightId,
        miscPartIds
      }),
      'In Use'
    )

    return getSystem(db, id)!
  })

  return run()
}
