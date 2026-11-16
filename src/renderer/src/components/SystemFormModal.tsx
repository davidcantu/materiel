import { useMemo, useState } from 'react'
import type { PartInfo, PartInput, PartType } from '../../../shared/parts'
import { partTypeLabel } from '../../../shared/parts'
import type {
  CompleteSystemInfo,
  CustomSystemInputInfo,
  FactorySystemInputInfo
} from '../../../shared/systems'
import { CARTRIDGE_OPTIONS } from '../../../shared/catalogs'
import {
  ACCESSORY_SLOT_LABELS,
  ACCESSORY_SLOT_TYPE,
  PLATFORMS,
  PLATFORM_ACCESSORY_SLOTS,
  PLATFORM_CORE_LABELS,
  PLATFORM_CORE_SLOTS,
  PLATFORM_LABELS,
  accessoryListTypes,
  isSingleCorePartPlatform,
  type AccessorySlot,
  type Platform
} from '../../../shared/platforms'
import { partOptionLabel } from '../lib/format'
import { ImageCropField, type ImageCropValue } from './ImageCropField'
import { Modal } from './Modal'
import { PartFormModal } from './PartFormModal'
import { TypeaheadSelect } from './TypeaheadSelect'

type BuildMode = 'custom' | 'factory'

type SystemFormModalProps = {
  parts: PartInfo[]
  trackValue?: boolean
  /** Platforms the user opted into during onboarding / settings. */
  allowedPlatforms?: Platform[]
  initial?: CompleteSystemInfo | null
  onClose: () => void
  onCreateCustom: (input: CustomSystemInputInfo) => Promise<void>
  onCreateFactory: (input: FactorySystemInputInfo) => Promise<void>
  onUpdate: (
    id: string,
    patch: Partial<CustomSystemInputInfo & FactorySystemInputInfo> & {
      buildType?: 'custom' | 'factory'
    }
  ) => Promise<void>
  /** Optional: refresh parent inventory after inline part create. */
  onPartsChanged?: () => void
}

type FormState = {
  mode: BuildMode
  platform: Platform
  name: string
  notes: string
  actionId: string
  barrelId: string
  chassisId: string
  opticId: string
  suppressorId: string
  laserIrId: string
  lightId: string
  miscPartIds: string[]
  factoryManufacturer: string
  factoryModel: string
  factoryCartridge: string
  factoryActionMaintenance: string
  factoryBarrelMaintenance: string
  factoryOpticId: string
  factorySuppressorId: string
  factoryLaserIrId: string
  factoryLightId: string
  image: ImageCropValue
}

type CreateTarget =
  | 'actionId'
  | 'barrelId'
  | 'chassisId'
  | 'opticId'
  | 'suppressorId'
  | 'laserIrId'
  | 'lightId'
  | 'factoryOpticId'
  | 'factorySuppressorId'
  | 'factoryLaserIrId'
  | 'factoryLightId'
  | { misc: number }

function blankForm(defaultPlatform: Platform = 'bolt_action'): FormState {
  return {
    mode: 'custom',
    platform: defaultPlatform,
    name: '',
    notes: '',
    actionId: '',
    barrelId: '',
    chassisId: '',
    opticId: '',
    suppressorId: '',
    laserIrId: '',
    lightId: '',
    miscPartIds: [],
    factoryManufacturer: '',
    factoryModel: '',
    factoryCartridge: '',
    factoryActionMaintenance: '500',
    factoryBarrelMaintenance: '300',
    factoryOpticId: '',
    factorySuppressorId: '',
    factoryLaserIrId: '',
    factoryLightId: '',
    image: { imageUrl: null, imageScale: 1 }
  }
}

function fromSystem(system: CompleteSystemInfo): FormState {
  return {
    mode: system.buildType,
    platform: system.platform,
    name: system.name,
    notes: system.notes ?? '',
    actionId: system.actionId,
    barrelId: system.barrelId,
    chassisId: system.chassisId,
    opticId: system.opticId ?? '',
    suppressorId: system.suppressorId ?? '',
    laserIrId: system.laserIrId ?? '',
    lightId: system.lightId ?? '',
    miscPartIds: [...system.miscPartIds],
    factoryManufacturer: system.factoryManufacturer ?? '',
    factoryModel: system.factoryModel ?? '',
    factoryCartridge: system.factoryCartridge ?? '',
    factoryActionMaintenance: String(system.factoryActionMaintenance ?? 500),
    factoryBarrelMaintenance: String(system.factoryBarrelMaintenance ?? 300),
    factoryOpticId: system.opticId ?? '',
    factorySuppressorId: system.suppressorId ?? '',
    factoryLaserIrId: system.laserIrId ?? '',
    factoryLightId: system.lightId ?? '',
    image: {
      imageUrl: system.imageUrl,
      imageScale: system.imageScale ?? 1
    }
  }
}

export function SystemFormModal({
  parts: partsProp,
  trackValue = false,
  allowedPlatforms,
  initial,
  onClose,
  onCreateCustom,
  onCreateFactory,
  onUpdate,
  onPartsChanged
}: SystemFormModalProps): React.JSX.Element {
  const editing = Boolean(initial)
  const platformChoices = useMemo(() => {
    if (allowedPlatforms && allowedPlatforms.length > 0) {
      return PLATFORMS.filter((p) => allowedPlatforms.includes(p))
    }
    return [...PLATFORMS]
  }, [allowedPlatforms])
  const [form, setForm] = useState<FormState>(() =>
    initial ? fromSystem(initial) : blankForm(platformChoices[0] ?? 'bolt_action')
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [createdParts, setCreatedParts] = useState<PartInfo[]>([])
  const parts = useMemo(() => {
    const byId = new Map<string, PartInfo>()
    for (const part of partsProp) byId.set(part.id, part)
    for (const part of createdParts) byId.set(part.id, part)
    return [...byId.values()]
  }, [partsProp, createdParts])
  const [creatingType, setCreatingType] = useState<PartType | null>(null)
  const [createTarget, setCreateTarget] = useState<CreateTarget | null>(null)

  const core = PLATFORM_CORE_SLOTS[form.platform]
  const coreLabels = PLATFORM_CORE_LABELS[form.platform]
  const accessorySlots = PLATFORM_ACCESSORY_SLOTS[form.platform]
  const accessoryTypes = accessoryListTypes(form.platform)

  const assignedIds = useMemo(() => {
    if (!initial) return new Set<string>()
    return new Set(
      [
        initial.actionId,
        initial.barrelId,
        initial.chassisId,
        initial.opticId,
        initial.suppressorId,
        initial.laserIrId,
        initial.lightId,
        ...initial.miscPartIds
      ].filter(Boolean) as string[]
    )
  }, [initial])

  function available(type: PartType, selectedId?: string): PartInfo[] {
    return parts.filter(
      (part) =>
        part.type === type &&
        part.platforms.includes(form.platform) &&
        (part.status !== 'In Use' || assignedIds.has(part.id) || part.id === selectedId)
    )
  }

  function availableAccessory(selectedId?: string): PartInfo[] {
    return parts.filter(
      (part) =>
        accessoryTypes.includes(part.type) &&
        part.platforms.includes(form.platform) &&
        (part.status !== 'In Use' || assignedIds.has(part.id) || part.id === selectedId)
    )
  }

  async function handleInlinePartSave(input: PartInput): Promise<void> {
    const created = await window.api.createPart({
      ...input,
      platforms: input.platforms?.length ? input.platforms : [form.platform]
    })
    setCreatedParts((prev) => [...prev, created])
    if (createTarget === 'actionId') {
      if (isSingleCorePartPlatform(form.platform)) {
        setForm((prev) => ({
          ...prev,
          actionId: created.id,
          barrelId: created.id,
          chassisId: created.id
        }))
      } else {
        setField('actionId', created.id)
      }
    } else if (createTarget === 'barrelId') setField('barrelId', created.id)
    else if (createTarget === 'chassisId') setField('chassisId', created.id)
    else if (createTarget === 'opticId') setField('opticId', created.id)
    else if (createTarget === 'suppressorId') setField('suppressorId', created.id)
    else if (createTarget === 'laserIrId') setField('laserIrId', created.id)
    else if (createTarget === 'lightId') setField('lightId', created.id)
    else if (createTarget === 'factoryOpticId') setField('factoryOpticId', created.id)
    else if (createTarget === 'factorySuppressorId') setField('factorySuppressorId', created.id)
    else if (createTarget === 'factoryLaserIrId') setField('factoryLaserIrId', created.id)
    else if (createTarget === 'factoryLightId') setField('factoryLightId', created.id)
    else if (createTarget && typeof createTarget === 'object' && 'misc' in createTarget) {
      setMiscAt(createTarget.misc, created.id)
    }
    setCreatingType(null)
    setCreateTarget(null)
    onPartsChanged?.()
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function setPlatform(platform: Platform): void {
    setForm((prev) => {
      if (prev.platform === platform) return prev
      return {
        ...prev,
        platform,
        actionId: '',
        barrelId: '',
        chassisId: '',
        opticId: '',
        suppressorId: '',
        laserIrId: '',
        lightId: '',
        miscPartIds: [],
        factoryOpticId: '',
        factorySuppressorId: '',
        factoryLaserIrId: '',
        factoryLightId: ''
      }
    })
  }

  function setMiscAt(index: number, value: string): void {
    setForm((prev) => {
      const next = [...prev.miscPartIds]
      next[index] = value
      return { ...prev, miscPartIds: next }
    })
  }

  function addMisc(): void {
    if (form.miscPartIds.length >= 8) return
    setForm((prev) => ({ ...prev, miscPartIds: [...prev.miscPartIds, ''] }))
  }

  function removeMisc(index: number): void {
    setForm((prev) => ({
      ...prev,
      miscPartIds: prev.miscPartIds.filter((_, i) => i !== index)
    }))
  }

  function accessoryValue(slot: AccessorySlot, factory: boolean): string {
    if (factory) {
      if (slot === 'optic') return form.factoryOpticId
      if (slot === 'suppressor') return form.factorySuppressorId
      if (slot === 'laserIr') return form.factoryLaserIrId
      return form.factoryLightId
    }
    if (slot === 'optic') return form.opticId
    if (slot === 'suppressor') return form.suppressorId
    if (slot === 'laserIr') return form.laserIrId
    return form.lightId
  }

  function setAccessoryValue(slot: AccessorySlot, factory: boolean, value: string): void {
    if (factory) {
      if (slot === 'optic') setField('factoryOpticId', value)
      else if (slot === 'suppressor') setField('factorySuppressorId', value)
      else if (slot === 'laserIr') setField('factoryLaserIrId', value)
      else setField('factoryLightId', value)
      return
    }
    if (slot === 'optic') setField('opticId', value)
    else if (slot === 'suppressor') setField('suppressorId', value)
    else if (slot === 'laserIr') setField('laserIrId', value)
    else setField('lightId', value)
  }

  function accessoryCreateTarget(slot: AccessorySlot, factory: boolean): CreateTarget {
    if (factory) {
      if (slot === 'optic') return 'factoryOpticId'
      if (slot === 'suppressor') return 'factorySuppressorId'
      if (slot === 'laserIr') return 'factoryLaserIrId'
      return 'factoryLightId'
    }
    if (slot === 'optic') return 'opticId'
    if (slot === 'suppressor') return 'suppressorId'
    if (slot === 'laserIr') return 'laserIrId'
    return 'lightId'
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const miscPartIds = form.miscPartIds.filter(Boolean)
      const imageUrl = form.image.imageUrl
      const imageScale = form.image.imageScale ?? 1
      if (form.mode === 'custom') {
        const singleCore = isSingleCorePartPlatform(form.platform)
        const corePartId = form.actionId
        const input: CustomSystemInputInfo = {
          name: form.name.trim(),
          platform: form.platform,
          actionId: corePartId,
          barrelId: singleCore ? corePartId : form.barrelId,
          chassisId: singleCore ? corePartId : form.chassisId,
          opticId: form.opticId || null,
          suppressorId: form.suppressorId || null,
          laserIrId: form.laserIrId || null,
          lightId: form.platform === 'bolt_action' ? null : form.lightId || null,
          miscPartIds,
          imageUrl,
          imageScale,
          notes: form.notes.trim() || null
        }
        if (singleCore) {
          if (!input.actionId) throw new Error('Custom pistol builds require a pistol')
        } else if (!input.actionId || !input.barrelId || !input.chassisId) {
          throw new Error(
            `Custom builds require ${coreLabels.primary}, ${coreLabels.barrel}, and ${coreLabels.furniture}`
          )
        }
        if (form.platform === 'bolt_action' && !input.opticId) {
          throw new Error('Bolt-action custom builds require an optic')
        }
        if (editing && initial) {
          await onUpdate(initial.id, { ...input, buildType: 'custom' })
        } else {
          await onCreateCustom(input)
        }
      } else {
        const input: FactorySystemInputInfo = {
          name: form.name.trim(),
          platform: form.platform,
          factoryManufacturer: form.factoryManufacturer.trim(),
          factoryModel: form.factoryModel.trim(),
          factoryCartridge: form.factoryCartridge.trim(),
          factoryActionMaintenance: Number(form.factoryActionMaintenance) || 500,
          factoryBarrelMaintenance: Number(form.factoryBarrelMaintenance) || 300,
          opticId: form.factoryOpticId || null,
          suppressorId: form.factorySuppressorId || null,
          laserIrId: form.factoryLaserIrId || null,
          lightId: form.platform === 'bolt_action' ? null : form.factoryLightId || null,
          miscPartIds,
          imageUrl,
          imageScale,
          notes: form.notes.trim() || null
        }
        if (!input.factoryManufacturer || !input.factoryModel || !input.factoryCartridge) {
          throw new Error('Factory builds require manufacturer, model, and cartridge')
        }
        if (editing && initial) {
          await onUpdate(initial.id, { ...input, buildType: 'factory' })
        } else {
          await onCreateFactory(input)
        }
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save build')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal
        title={editing ? 'Edit Build' : 'Create New System'}
        onClose={onClose}
        wide
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="system-form" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Build'}
            </button>
          </>
        }
      >
        <form id="system-form" className="form-grid" onSubmit={(e) => void handleSubmit(e)}>
          <div className="field field-span">
            <span className="field-label">Platform</span>
            <div className="chip-row">
              {platformChoices.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  className={`chip${form.platform === platform ? ' active' : ''}`}
                  onClick={() => setPlatform(platform)}
                  disabled={editing}
                >
                  {PLATFORM_LABELS[platform]}
                </button>
              ))}
            </div>
            {editing ? (
              <span className="muted field-hint">Platform is locked after create.</span>
            ) : null}
          </div>

          <div className="field field-span">
            <span className="field-label">Build Mode</span>
            <div className="chip-row">
              <button
                type="button"
                className={`chip${form.mode === 'custom' ? ' active' : ''}`}
                onClick={() => setField('mode', 'custom')}
              >
                Custom Build
              </button>
              <button
                type="button"
                className={`chip${form.mode === 'factory' ? ' active' : ''}`}
                onClick={() => setField('mode', 'factory')}
              >
                Factory Firearm
              </button>
            </div>
          </div>

          <label className="field field-span">
            <span className="field-label">Build Name</span>
            <input value={form.name} onChange={(e) => setField('name', e.target.value)} required />
          </label>

          <div className="field field-span">
            <ImageCropField
              label="Build Image (Landscape)"
              variant="build"
              value={form.image}
              onChange={(image) => setField('image', image)}
              disabled={saving}
            />
          </div>

          {form.mode === 'custom' ? (
            <>
              {isSingleCorePartPlatform(form.platform) ? (
                <PartSelect
                  label={coreLabels.primary}
                  value={form.actionId}
                  options={available(core.primary, form.actionId)}
                  onChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      actionId: v,
                      barrelId: v,
                      chassisId: v
                    }))
                  }
                  required
                  onCreate={() => {
                    setCreateTarget('actionId')
                    setCreatingType(core.primary)
                  }}
                />
              ) : (
                <>
                  <PartSelect
                    label={coreLabels.primary}
                    value={form.actionId}
                    options={available(core.primary, form.actionId)}
                    onChange={(v) => setField('actionId', v)}
                    required
                    onCreate={() => {
                      setCreateTarget('actionId')
                      setCreatingType(core.primary)
                    }}
                  />
                  <PartSelect
                    label={coreLabels.barrel}
                    value={form.barrelId}
                    options={available(core.barrel, form.barrelId)}
                    onChange={(v) => setField('barrelId', v)}
                    required
                    onCreate={() => {
                      setCreateTarget('barrelId')
                      setCreatingType(core.barrel)
                    }}
                  />
                  <label className="field">
                    <span className="field-label">Cartridge</span>
                    <input
                      value={
                        form.barrelId
                          ? (parts.find((part) => part.id === form.barrelId)?.caliber ?? '')
                          : ''
                      }
                      readOnly
                      placeholder="Select a barrel…"
                      aria-readonly="true"
                    />
                    <span className="muted field-hint">
                      Locked from the selected barrel
                      {form.barrelId && !parts.find((part) => part.id === form.barrelId)?.caliber
                        ? ' (no cartridge on that barrel)'
                        : ''}
                    </span>
                  </label>
                  <PartSelect
                    label={coreLabels.furniture}
                    value={form.chassisId}
                    options={available(core.furniture, form.chassisId)}
                    onChange={(v) => setField('chassisId', v)}
                    required
                    onCreate={() => {
                      setCreateTarget('chassisId')
                      setCreatingType(core.furniture)
                    }}
                  />
                </>
              )}
              {accessorySlots.map((slot) => (
                <PartSelect
                  key={slot}
                  label={`${ACCESSORY_SLOT_LABELS[slot]}${slot === 'optic' && form.platform === 'bolt_action' ? '' : ' (optional)'}`}
                  value={accessoryValue(slot, false)}
                  options={available(ACCESSORY_SLOT_TYPE[slot], accessoryValue(slot, false))}
                  onChange={(v) => setAccessoryValue(slot, false, v)}
                  required={slot === 'optic' && form.platform === 'bolt_action'}
                  allowEmpty={!(slot === 'optic' && form.platform === 'bolt_action')}
                  onCreate={() => {
                    setCreateTarget(accessoryCreateTarget(slot, false))
                    setCreatingType(ACCESSORY_SLOT_TYPE[slot])
                  }}
                />
              ))}
            </>
          ) : (
            <>
              <label className="field">
                <span className="field-label">Manufacturer</span>
                <input
                  list="factory-mfr-suggestions"
                  value={form.factoryManufacturer}
                  onChange={(e) => setField('factoryManufacturer', e.target.value)}
                  required
                />
                <datalist id="factory-mfr-suggestions">
                  {[
                    ...new Set(
                      parts
                        .map((part) => part.manufacturer)
                        .filter(Boolean)
                        .concat(
                          form.platform === 'pistol'
                            ? ['Glock', 'Sig Sauer', 'Smith & Wesson', 'CZ']
                            : form.platform === 'ar_pattern'
                              ? ['Daniel Defense', 'BCM', 'Sons of Liberty', 'Aero Precision']
                              : ['Bergara', 'Tikka', 'Remington', 'Howa', 'Savage']
                        )
                    )
                  ].map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </label>
              <label className="field">
                <span className="field-label">Model</span>
                <input
                  list="factory-model-suggestions"
                  value={form.factoryModel}
                  onChange={(e) => setField('factoryModel', e.target.value)}
                  required
                />
                <datalist id="factory-model-suggestions">
                  {[...new Set(parts.map((part) => part.model).filter(Boolean) as string[])].map(
                    (item) => (
                      <option key={item} value={item} />
                    )
                  )}
                </datalist>
              </label>
              <label className="field">
                <span className="field-label">Cartridge</span>
                <input
                  list="factory-cartridge-suggestions"
                  value={form.factoryCartridge}
                  onChange={(e) => setField('factoryCartridge', e.target.value)}
                  required
                />
                <datalist id="factory-cartridge-suggestions">
                  {CARTRIDGE_OPTIONS.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </label>
              <label className="field">
                <span className="field-label">{coreLabels.primary} Maint. Interval</span>
                <input
                  type="number"
                  min="1"
                  value={form.factoryActionMaintenance}
                  onChange={(e) => setField('factoryActionMaintenance', e.target.value)}
                  required
                />
              </label>
              {!isSingleCorePartPlatform(form.platform) ? (
                <label className="field">
                  <span className="field-label">Barrel Maint. Interval</span>
                  <input
                    type="number"
                    min="1"
                    value={form.factoryBarrelMaintenance}
                    onChange={(e) => setField('factoryBarrelMaintenance', e.target.value)}
                    required
                  />
                </label>
              ) : null}
              {accessorySlots.map((slot) => (
                <PartSelect
                  key={`factory-${slot}`}
                  label={`${ACCESSORY_SLOT_LABELS[slot]} (optional)`}
                  value={accessoryValue(slot, true)}
                  options={available(ACCESSORY_SLOT_TYPE[slot], accessoryValue(slot, true))}
                  onChange={(v) => setAccessoryValue(slot, true, v)}
                  allowEmpty
                  onCreate={() => {
                    setCreateTarget(accessoryCreateTarget(slot, true))
                    setCreatingType(ACCESSORY_SLOT_TYPE[slot])
                  }}
                />
              ))}
            </>
          )}

          <div className="field field-span">
            <div className="field-row-header">
              <span className="field-label">
                Accessories
                {accessoryTypes.length > 1
                  ? ` (${accessoryTypes.map(partTypeLabel).join(', ')})`
                  : ''}
              </span>
              <button
                type="button"
                className="btn-link"
                onClick={addMisc}
                disabled={form.miscPartIds.length >= 8}
              >
                + Add Accessory
              </button>
            </div>
            {form.miscPartIds.length === 0 ? (
              <p className="muted">No accessories added.</p>
            ) : (
              <div className="misc-list">
                {form.miscPartIds.map((id, index) => (
                  <div key={`misc-${index}`} className="misc-row">
                    <PartSelect
                      label={`Accessory ${index + 1}`}
                      value={id}
                      options={availableAccessory(id)}
                      onChange={(v) => setMiscAt(index, v)}
                      allowEmpty
                      onCreate={() => {
                        setCreateTarget({ misc: index })
                        setCreatingType(accessoryTypes[0] ?? 'Misc')
                      }}
                    />
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => removeMisc(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="field field-span">
            <span className="field-label">Notes</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
            />
          </label>

          {error ? <p className="form-error field-span">{error}</p> : null}
        </form>
      </Modal>

      {creatingType ? (
        <PartFormModal
          trackValue={trackValue}
          defaultType={creatingType}
          defaultPlatforms={[form.platform]}
          lockType
          lockPlatforms={[form.platform]}
          onClose={() => {
            setCreatingType(null)
            setCreateTarget(null)
          }}
          onSave={handleInlinePartSave}
        />
      ) : null}
    </>
  )
}

function PartSelect({
  label,
  value,
  options,
  onChange,
  required,
  allowEmpty,
  onCreate
}: {
  label: string
  value: string
  options: PartInfo[]
  onChange: (value: string) => void
  required?: boolean
  allowEmpty?: boolean
  onCreate?: () => void
}): React.JSX.Element {
  return (
    <TypeaheadSelect
      label={label}
      value={value}
      options={options.map((part) => ({
        id: part.id,
        label: partOptionLabel(part),
        keywords: [part.manufacturer, part.model, part.caliber, part.serialNumber, part.id]
          .filter(Boolean)
          .join(' ')
      }))}
      onChange={onChange}
      required={required}
      allowEmpty={allowEmpty}
      placeholder="Type manufacturer, model, or id…"
      createLabel="+ New part"
      onCreate={onCreate}
    />
  )
}
