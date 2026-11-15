import { useMemo, useState } from 'react'
import type { PartInfo, PartInput, PartStatus, PartType, MuzzleType } from '../../../shared/parts'
import { PART_TYPES } from '../../../shared/parts'
import {
  CARTRIDGE_OPTIONS,
  manufacturersForPartType,
  modelsForActionManufacturer
} from '../../../shared/catalogs'
import { partTypeLabel } from '../lib/format'
import { Modal } from './Modal'

type PartFormModalProps = {
  trackValue: boolean
  initial?: PartInfo | null
  onClose: () => void
  onSave: (input: PartInput) => Promise<void>
}

type FormState = {
  type: PartType
  name: string
  manufacturer: string
  model: string
  serialNumber: string
  caliber: string
  gunsmith: string
  twistRate: string
  barrelLife: string
  maintenanceInterval: string
  muzzleType: MuzzleType
  value: string
  status: PartStatus
  notes: string
}

function blankForm(type: PartType = 'Action'): FormState {
  return {
    type,
    name: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    caliber: '',
    gunsmith: '',
    twistRate: '8',
    barrelLife: '2500',
    maintenanceInterval: '1000',
    muzzleType: 'Suppressor',
    value: '',
    status: 'In Stock',
    notes: ''
  }
}

function fromPart(part: PartInfo): FormState {
  return {
    type: part.type,
    name: part.name,
    manufacturer: part.manufacturer,
    model: part.model ?? '',
    serialNumber: part.serialNumber ?? '',
    caliber: part.caliber ?? '',
    gunsmith: part.gunsmith ?? '',
    twistRate: part.twistRate != null ? String(part.twistRate) : '8',
    barrelLife: part.barrelLife != null ? String(part.barrelLife) : '2500',
    maintenanceInterval:
      part.maintenanceInterval != null ? String(part.maintenanceInterval) : '1000',
    muzzleType: part.muzzleType ?? 'Suppressor',
    value: part.value ? String(part.value) : '',
    status: part.status,
    notes: part.notes ?? ''
  }
}

export function PartFormModal({
  trackValue,
  initial,
  onClose,
  onSave
}: PartFormModalProps): React.JSX.Element {
  const editing = Boolean(initial)
  const [form, setForm] = useState<FormState>(() => (initial ? fromPart(initial) : blankForm()))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const manufacturerSuggestions = useMemo(
    () => manufacturersForPartType(form.type, form.muzzleType),
    [form.type, form.muzzleType]
  )
  const modelSuggestions = useMemo(() => {
    if (form.type === 'Action') return modelsForActionManufacturer(form.manufacturer)
    return []
  }, [form.type, form.manufacturer])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const input: PartInput = {
        name: form.name.trim(),
        manufacturer: form.manufacturer.trim(),
        type: form.type,
        status: form.status,
        model: form.model.trim() || null,
        notes: form.notes.trim() || null
      }
      if (trackValue && form.value.trim()) {
        input.value = Number(form.value)
      }
      if (form.type === 'Action' || form.type === 'Optic') {
        input.serialNumber = form.serialNumber.trim()
      }
      if (form.type === 'Barrel') {
        input.caliber = form.caliber.trim()
        input.gunsmith = form.gunsmith.trim()
        input.twistRate = Number(form.twistRate) || 8
        input.barrelLife = Number(form.barrelLife) || 2500
        input.maintenanceInterval = Number(form.maintenanceInterval) || 1000
      }
      if (form.type === 'Action' || form.type === 'Suppressor') {
        input.maintenanceInterval = Number(form.maintenanceInterval) || 1000
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

  const statusOptions: PartStatus[] =
    form.type === 'Barrel'
      ? ['In Stock', 'In Use', 'Sold', 'Retired']
      : ['In Stock', 'In Use', 'Sold']

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
        <fieldset className="type-picker" disabled={editing}>
          <legend className="field-label">Part Type</legend>
          <div className="chip-row">
            {PART_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`chip${form.type === type ? ' active' : ''}`}
                onClick={() => setField('type', type)}
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

        <label className="field">
          <span className="field-label">Name</span>
          <input value={form.name} onChange={(e) => setField('name', e.target.value)} required />
        </label>

        {form.type === 'Action' || form.type === 'Optic' ? (
          <label className="field">
            <span className="field-label">Serial Number</span>
            <input
              value={form.serialNumber}
              onChange={(e) => setField('serialNumber', e.target.value)}
              required
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

        {form.type === 'Action' || form.type === 'Barrel' || form.type === 'Suppressor' ? (
          <label className="field">
            <span className="field-label">Maintenance Interval (rounds)</span>
            <input
              type="number"
              min="1"
              value={form.maintenanceInterval}
              onChange={(e) => setField('maintenanceInterval', e.target.value)}
            />
          </label>
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
        </div>

        {error ? <p className="form-error field-span">{error}</p> : null}
      </form>
    </Modal>
  )
}
