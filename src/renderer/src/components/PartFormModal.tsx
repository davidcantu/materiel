import { useMemo, useState } from 'react'
import type { PartInfo, PartInput, PartStatus, PartType, MuzzleType } from '../../../shared/parts'
import {
  isMaintenanceTracked,
  isWearStatusTracked,
  partTypeLabel,
  requiresSerialNumber,
  showsSerialNumberField
} from '../../../shared/parts'
import {
  PLATFORMS,
  PLATFORM_LABELS,
  defaultPlatformsForPartType,
  normalizePartPlatforms,
  partTypesForPlatforms,
  platformsForPartType,
  type Platform
} from '../../../shared/platforms'
import {
  CARTRIDGE_OPTIONS,
  manufacturersForPartType,
  modelsForActionManufacturer
} from '../../../shared/catalogs'
import { Modal } from './Modal'

type PartFormModalProps = {
  trackValue: boolean
  initial?: PartInfo | null
  /** Prefill type when creating (e.g. inline create from a barrel picker). */
  defaultType?: PartType
  /** Prefill platforms when creating inline from a build of a known platform. */
  defaultPlatforms?: Platform[]
  /** When true, type chips are disabled (inline create from a typed picker). */
  lockType?: boolean
  /** When set, platform chips are limited/locked to these platforms. */
  lockPlatforms?: Platform[]
  onClose: () => void
  onSave: (input: PartInput) => Promise<void>
}

type FormState = {
  platforms: Platform[]
  type: PartType
  manufacturer: string
  name: string
  model: string
  serialNumber: string
  caliber: string
  gunsmith: string
  twistRate: string
  barrelLife: string
  maintenanceInterval: string
  totalRoundCount: string
  muzzleType: MuzzleType
  value: string
  status: PartStatus
  notes: string
}

function blankForm(type: PartType = 'Action', platforms?: Platform[]): FormState {
  const resolvedPlatforms = platforms?.length
    ? normalizePartPlatforms(type, platforms)
    : defaultPlatformsForPartType(type)
  const allowedTypes = partTypesForPlatforms(resolvedPlatforms)
  const resolvedType = allowedTypes.includes(type) ? type : (allowedTypes[0] ?? type)
  return {
    platforms: normalizePartPlatforms(resolvedType, resolvedPlatforms),
    type: resolvedType,
    manufacturer: '',
    name: '',
    model: '',
    serialNumber: '',
    caliber: '',
    gunsmith: '',
    twistRate: '8',
    barrelLife: '2500',
    maintenanceInterval: '1000',
    totalRoundCount: '0',
    muzzleType: 'Suppressor',
    value: '',
    status: 'In Stock',
    notes: ''
  }
}

function fromPart(part: PartInfo): FormState {
  return {
    platforms: [...part.platforms],
    type: part.type,
    manufacturer: part.manufacturer,
    name: part.name ?? '',
    model: part.model ?? '',
    serialNumber: part.serialNumber ?? '',
    caliber: part.caliber ?? '',
    gunsmith: part.gunsmith ?? '',
    twistRate: part.twistRate != null ? String(part.twistRate) : '8',
    barrelLife: part.barrelLife != null ? String(part.barrelLife) : '2500',
    maintenanceInterval:
      part.maintenanceInterval != null ? String(part.maintenanceInterval) : '1000',
    totalRoundCount: String(part.totalRoundCount ?? 0),
    muzzleType: part.muzzleType ?? 'Suppressor',
    value: part.value ? String(part.value) : '',
    status: part.status,
    notes: part.notes ?? ''
  }
}

export function PartFormModal({
  trackValue,
  initial,
  defaultType = 'Action',
  defaultPlatforms,
  lockType = false,
  lockPlatforms,
  onClose,
  onSave
}: PartFormModalProps): React.JSX.Element {
  const editing = Boolean(initial)
  const [form, setForm] = useState<FormState>(() =>
    initial ? fromPart(initial) : blankForm(defaultType, defaultPlatforms ?? lockPlatforms)
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const availableTypes = useMemo(() => {
    if (editing) return [form.type]
    if (lockType) return [form.type]
    return partTypesForPlatforms(form.platforms)
  }, [editing, lockType, form.platforms, form.type])

  const platformChoices = useMemo(() => {
    if (lockPlatforms?.length) return lockPlatforms
    if (editing) return platformsForPartType(form.type)
    return PLATFORMS
  }, [lockPlatforms, editing, form.type])

  const manufacturerSuggestions = useMemo(
    () => manufacturersForPartType(form.type, form.muzzleType),
    [form.type, form.muzzleType]
  )
  const modelSuggestions = useMemo(() => {
    if (form.type === 'Action') return modelsForActionManufacturer(form.manufacturer)
    return []
  }, [form.type, form.manufacturer])

  const serialRequired = requiresSerialNumber(form.type, form.muzzleType)
  const showSerial = showsSerialNumberField(form.type, form.muzzleType)
  const showWearStatus = isWearStatusTracked(form.type)

  function setField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function preferredTypeForPlatforms(
    platforms: Platform[],
    current: PartType
  ): PartType {
    const types = partTypesForPlatforms(platforms)
    if (types.includes(current)) return current
    // Prefer the serialized core part when switching platforms on create.
    if (platforms.length === 1) {
      const only = platforms[0]
      if (only === 'pistol' && types.includes('Pistol')) return 'Pistol'
      if (only === 'ar_pattern' && types.includes('Lower')) return 'Lower'
      if (only === 'bolt_action' && types.includes('Action')) return 'Action'
    }
    return types[0] ?? current
  }

  function togglePlatform(platform: Platform): void {
    if (lockPlatforms?.length === 1) return
    setForm((prev) => {
      // Create: exclusive platform pick so Pistol/AR/Bolt core types stay available.
      // Multi-platform accessories can add platforms later via Edit.
      if (!editing) {
        const nextPlatforms: Platform[] = [platform]
        const nextType = preferredTypeForPlatforms(nextPlatforms, prev.type)
        return {
          ...prev,
          platforms: normalizePartPlatforms(nextType, nextPlatforms),
          type: nextType,
          status: isWearStatusTracked(nextType) ? prev.status : 'In Stock'
        }
      }

      const has = prev.platforms.includes(platform)
      let nextPlatforms: Platform[]
      if (has) {
        if (prev.platforms.length === 1) return prev
        nextPlatforms = prev.platforms.filter((p) => p !== platform)
      } else {
        nextPlatforms = [...prev.platforms, platform]
      }
      const nextType = preferredTypeForPlatforms(nextPlatforms, prev.type)
      return {
        ...prev,
        platforms: normalizePartPlatforms(nextType, nextPlatforms),
        type: nextType
      }
    })
  }

  function selectType(type: PartType): void {
    setForm((prev) => ({
      ...prev,
      type,
      platforms: normalizePartPlatforms(type, prev.platforms),
      status: isWearStatusTracked(type) ? prev.status : 'In Stock'
    }))
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const input: PartInput = {
        manufacturer: form.manufacturer.trim(),
        type: form.type,
        platforms: normalizePartPlatforms(form.type, form.platforms),
        model: form.model.trim() || null,
        notes: form.notes.trim() || null
      }
      // Wear parts own the status model; others keep attach bookkeeping untouched on edit.
      if (showWearStatus) {
        input.status = form.status
      } else if (!editing) {
        input.status = 'In Stock'
      }
      if (trackValue && form.value.trim()) {
        input.value = Number(form.value)
      }
      if (showSerial) {
        input.serialNumber = form.serialNumber.trim() || null
      } else if (form.type === 'Suppressor') {
        input.serialNumber = null
      }
      if (form.type === 'Barrel') {
        input.name = form.name.trim()
        input.caliber = form.caliber.trim()
        input.gunsmith = form.gunsmith.trim()
        input.twistRate = Number(form.twistRate) || 8
        input.barrelLife = Number(form.barrelLife) || 2500
        input.maintenanceInterval = Number(form.maintenanceInterval) || 1000
      } else {
        input.name = null
      }
      if (isMaintenanceTracked(form.type) && form.type !== 'Barrel') {
        input.maintenanceInterval = Number(form.maintenanceInterval) || 1000
      }
      if (isMaintenanceTracked(form.type)) {
        input.totalRoundCount = Math.max(0, Number(form.totalRoundCount) || 0)
      }
      if (form.type === 'Suppressor') {
        input.muzzleType = form.muzzleType
      }
      await onSave(input)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save part')
    } finally {
      setSaving(false)
    }
  }

  const statusOptions: PartStatus[] = ['In Stock', 'In Use', 'Sold', 'Retired']

  return (
    <Modal
      title={editing ? 'Edit Part' : 'Add New Component'}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="part-form" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Part'}
          </button>
        </>
      }
    >
      <form id="part-form" className="form-grid" onSubmit={(e) => void handleSubmit(e)}>
        <fieldset className="type-picker" disabled={Boolean(lockPlatforms?.length === 1)}>
          <legend className="field-label">Platform</legend>
          <div className="chip-row">
            {platformChoices.map((platform) => (
              <button
                key={platform}
                type="button"
                className={`chip${form.platforms.includes(platform) ? ' active' : ''}`}
                onClick={() => togglePlatform(platform)}
              >
                {PLATFORM_LABELS[platform]}
              </button>
            ))}
          </div>
          <p className="muted field-hint">
            {editing
              ? 'Toggle Platforms For Multi-Platform Parts.'
              : 'Pick One Platform. Use Frame For A Serialized Pistol.'}
          </p>
        </fieldset>

        <fieldset className="type-picker" disabled={editing || lockType}>
          <legend className="field-label">Part Type</legend>
          <div className="chip-row">
            {availableTypes.map((type) => (
              <button
                key={type}
                type="button"
                className={`chip${form.type === type ? ' active' : ''}`}
                onClick={() => selectType(type)}
              >
                {partTypeLabel(type)}
              </button>
            ))}
          </div>
        </fieldset>

        {form.type === 'Suppressor' ? (
          <div className="field">
            <span className="field-label">Muzzle Type</span>
            <div className="chip-row">
              {(['Suppressor', 'Brake'] as const).map((muzzle) => (
                <button
                  key={muzzle}
                  type="button"
                  className={`chip${form.muzzleType === muzzle ? ' active' : ''}`}
                  onClick={() => setField('muzzleType', muzzle)}
                >
                  {muzzle}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <label className="field">
          <span className="field-label">Manufacturer</span>
          <input
            list="manufacturer-suggestions"
            value={form.manufacturer}
            onChange={(e) => setField('manufacturer', e.target.value)}
            required
          />
          <datalist id="manufacturer-suggestions">
            {manufacturerSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>

        {form.type === 'Barrel' ? (
          <>
            <label className="field">
              <span className="field-label">Name</span>
              <input
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. Proof 26&quot; #1"
                required
              />
              <span className="muted field-hint">
                Name or serialize barrels so you can track round count per tube.
              </span>
            </label>
            <label className="field">
              <span className="field-label">Cartridge</span>
              <input
                list="cartridge-suggestions"
                value={form.caliber}
                onChange={(e) => setField('caliber', e.target.value)}
                required
              />
              <datalist id="cartridge-suggestions">
                {CARTRIDGE_OPTIONS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
          </>
        ) : (
          <label className="field">
            <span className="field-label">Model</span>
            <input
              list="model-suggestions"
              value={form.model}
              onChange={(e) => setField('model', e.target.value)}
              required
            />
            <datalist id="model-suggestions">
              {modelSuggestions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>
        )}

        {showSerial ? (
          <label className="field">
            <span className="field-label">
              Serial Number{serialRequired ? '' : ' (optional)'}
            </span>
            <input
              value={form.serialNumber}
              onChange={(e) => setField('serialNumber', e.target.value)}
              required={serialRequired}
            />
          </label>
        ) : null}

        {form.type === 'Barrel' ? (
          <>
            <label className="field">
              <span className="field-label">Twist Rate (1:X)</span>
              <input
                type="number"
                step="0.1"
                min="1"
                value={form.twistRate}
                onChange={(e) => setField('twistRate', e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Gunsmith</span>
              <input
                value={form.gunsmith}
                onChange={(e) => setField('gunsmith', e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Anticipated Barrel Life</span>
              <input
                type="number"
                min="1"
                value={form.barrelLife}
                onChange={(e) => setField('barrelLife', e.target.value)}
              />
            </label>
          </>
        ) : null}

        {isMaintenanceTracked(form.type) ? (
          <>
            <label className="field">
              <span className="field-label">Maintenance Interval (Rounds)</span>
              <input
                type="number"
                min="1"
                value={form.maintenanceInterval}
                onChange={(e) => setField('maintenanceInterval', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Total Round Count</span>
              <input
                type="number"
                min="0"
                value={form.totalRoundCount}
                onChange={(e) => setField('totalRoundCount', e.target.value)}
              />
            </label>
          </>
        ) : null}

        {trackValue ? (
          <label className="field">
            <span className="field-label">Value ($)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={form.value}
              onChange={(e) => setField('value', e.target.value)}
            />
          </label>
        ) : null}

        {form.type === 'Misc' ? (
          <label className="field field-span">
            <span className="field-label">Notes</span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
            />
          </label>
        ) : null}

        {showWearStatus ? (
          <div className="field field-span">
            <span className="field-label">Status</span>
            <div className="chip-row">
              {statusOptions.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`chip${form.status === status ? ' active' : ''}`}
                  onClick={() => setField('status', status)}
                >
                  {status}
                </button>
              ))}
            </div>
            <p className="muted field-hint">Wear tracking for barrels and triggers only.</p>
          </div>
        ) : null}

        {error ? <p className="form-error field-span">{error}</p> : null}
      </form>
    </Modal>
  )
}
