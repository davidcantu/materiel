import { useMemo, useState } from 'react'
import type { AmmoInput, AmmoInventoryInfo, AmmoType } from '../../../shared/ammo'
import { AMMO_TYPES } from '../../../shared/ammo'
import {
  BRASS_MANUFACTURERS,
  BULLET_MANUFACTURERS,
  CARTRIDGE_OPTIONS,
  POWDER_MANUFACTURERS,
  PRIMER_MANUFACTURERS,
  productsForBulletManufacturer,
  productsForPowderManufacturer,
  productsForPrimerManufacturer
} from '../../../shared/catalogs'
import type { LoadDevelopmentInfo } from '../../../shared/loads'
import { Modal } from './Modal'

type AmmoFormModalProps = {
  initial?: AmmoInventoryInfo | null
  /** Prefill a new ammo lot from a load recipe (Move to Practice from Load Data). */
  fromLoad?: LoadDevelopmentInfo | null
  loads: LoadDevelopmentInfo[]
  onClose: () => void
  onSave: (input: AmmoInput) => Promise<void>
}

type FormState = {
  type: AmmoType
  name: string
  caliber: string
  quantity: string
  lotNumber: string
  manufacturer: string
  loadId: string
  bulletManufacturer: string
  bulletType: string
  powderManufacturer: string
  powder: string
  chargeWeight: string
  primerManufacturer: string
  primer: string
  caseManufacturer: string
  caseName: string
  seatingDepth: string
  notes: string
  showComponents: boolean
}

function blankForm(): FormState {
  return {
    type: 'Factory',
    name: '',
    caliber: '',
    quantity: '',
    lotNumber: '',
    manufacturer: '',
    loadId: '',
    bulletManufacturer: '',
    bulletType: '',
    powderManufacturer: '',
    powder: '',
    chargeWeight: '',
    primerManufacturer: '',
    primer: '',
    caseManufacturer: '',
    caseName: '',
    seatingDepth: '',
    notes: '',
    showComponents: false
  }
}

function fromAmmo(ammo: AmmoInventoryInfo): FormState {
  const hasComponents = Boolean(
    ammo.bulletManufacturer ||
    ammo.bulletType ||
    ammo.powderManufacturer ||
    ammo.powder ||
    ammo.chargeWeight != null ||
    ammo.primerManufacturer ||
    ammo.primer ||
    ammo.caseManufacturer ||
    ammo.caseName ||
    ammo.seatingDepth
  )
  return {
    type: ammo.type,
    name: ammo.name,
    caliber: ammo.caliber,
    quantity: String(ammo.quantity),
    lotNumber: ammo.lotNumber ?? '',
    manufacturer: ammo.manufacturer ?? '',
    loadId: ammo.loadId ?? '',
    bulletManufacturer: ammo.bulletManufacturer ?? '',
    bulletType: ammo.bulletType ?? '',
    powderManufacturer: ammo.powderManufacturer ?? '',
    powder: ammo.powder ?? '',
    chargeWeight: ammo.chargeWeight != null ? String(ammo.chargeWeight) : '',
    primerManufacturer: ammo.primerManufacturer ?? '',
    primer: ammo.primer ?? '',
    caseManufacturer: ammo.caseManufacturer ?? '',
    caseName: ammo.caseName ?? '',
    seatingDepth: ammo.seatingDepth ?? '',
    notes: ammo.notes ?? '',
    showComponents: hasComponents
  }
}

function fromLoad(load: LoadDevelopmentInfo): FormState {
  return {
    type: 'Handload',
    name: load.name,
    caliber: load.caliber,
    quantity: '',
    lotNumber: '',
    manufacturer: '',
    loadId: load.id,
    bulletManufacturer: load.bulletManufacturer,
    bulletType: load.bulletModel,
    powderManufacturer: load.powderManufacturer,
    powder: load.powderModel,
    chargeWeight: String(load.powderCharge),
    primerManufacturer: load.primerManufacturer,
    primer: load.primerModel,
    caseManufacturer: load.brassManufacturer,
    caseName: load.brassModel ?? '',
    seatingDepth: load.cbto != null ? String(load.cbto) : String(load.coal),
    notes: '',
    showComponents: true
  }
}

function applyLoadFields(prev: FormState, load: LoadDevelopmentInfo): FormState {
  return {
    ...prev,
    type: 'Handload',
    caliber: load.caliber,
    loadId: load.id,
    bulletManufacturer: load.bulletManufacturer,
    bulletType: load.bulletModel,
    powderManufacturer: load.powderManufacturer,
    powder: load.powderModel,
    chargeWeight: String(load.powderCharge),
    primerManufacturer: load.primerManufacturer,
    primer: load.primerModel,
    caseManufacturer: load.brassManufacturer,
    caseName: load.brassModel ?? '',
    seatingDepth: load.cbto != null ? String(load.cbto) : String(load.coal),
    showComponents: true
  }
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

export function AmmoFormModal({
  initial,
  fromLoad: seedLoad = null,
  loads,
  onClose,
  onSave
}: AmmoFormModalProps): React.JSX.Element {
  const editing = Boolean(initial)
  const fromLoadFlow = Boolean(seedLoad) && !initial
  const [form, setForm] = useState<FormState>(() => {
    if (initial) return fromAmmo(initial)
    if (seedLoad) return fromLoad(seedLoad)
    return blankForm()
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const matchingLoads = useMemo(
    () => loads.filter((load) => !form.caliber || load.caliber === form.caliber),
    [loads, form.caliber]
  )

  const bulletSuggestions = useMemo(
    () => productsForBulletManufacturer(form.bulletManufacturer),
    [form.bulletManufacturer]
  )
  const powderSuggestions = useMemo(
    () => productsForPowderManufacturer(form.powderManufacturer),
    [form.powderManufacturer]
  )
  const primerSuggestions = useMemo(
    () => productsForPrimerManufacturer(form.primerManufacturer),
    [form.primerManufacturer]
  )

  function setField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleLoadLinkChange(loadId: string): void {
    if (!loadId) {
      setField('loadId', '')
      return
    }
    const load = loads.find((item) => item.id === loadId)
    if (!load) {
      setField('loadId', loadId)
      return
    }
    setForm((prev) => applyLoadFields(prev, load))
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)

    const quantity = Number(form.quantity)
    if (!form.name.trim()) {
      setError('Ammo name is required')
      return
    }
    if (!form.caliber.trim()) {
      setError('Cartridge is required')
      return
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      setError('Quantity must be a whole number greater than 0')
      return
    }

    const chargeWeight = parseOptionalNumber(form.chargeWeight)

    const input: AmmoInput = {
      name: form.name.trim(),
      type: form.type,
      caliber: form.caliber.trim(),
      quantity,
      lotNumber: form.lotNumber.trim() || null,
      manufacturer: form.type === 'Factory' ? form.manufacturer.trim() || null : null,
      loadId: form.type === 'Handload' ? form.loadId || null : null,
      notes: form.notes.trim() || null,
      bulletManufacturer: form.bulletManufacturer.trim() || null,
      bulletType: form.bulletType.trim() || null,
      powderManufacturer: form.powderManufacturer.trim() || null,
      powder: form.powder.trim() || null,
      chargeWeight,
      primerManufacturer: form.primerManufacturer.trim() || null,
      primer: form.primer.trim() || null,
      caseManufacturer: form.caseManufacturer.trim() || null,
      caseName: form.caseName.trim() || null,
      seatingDepth: form.seatingDepth.trim() || null
    }

    setSaving(true)
    try {
      await onSave(input)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={editing ? 'Edit Ammo' : fromLoadFlow ? 'Move Load to Practice' : 'Add Ammo'}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="ammo-form" className="btn-primary" disabled={saving}>
            {saving
              ? 'Saving…'
              : editing
                ? 'Save Changes'
                : fromLoadFlow
                  ? 'Move to Practice'
                  : 'Add Ammo'}
          </button>
        </>
      }
    >
      <form id="ammo-form" className="form-grid" onSubmit={(e) => void handleSubmit(e)}>
        <fieldset className="type-picker">
          <legend className="field-label">Type</legend>
          <div className="chip-row">
            {AMMO_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`chip${form.type === type ? ' active' : ''}`}
                onClick={() => setField('type', type)}
              >
                {type}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span className="field-label">Cartridge</span>
          <input
            list="ammo-cartridge-suggestions"
            value={form.caliber}
            onChange={(e) => setField('caliber', e.target.value)}
            required
          />
          <datalist id="ammo-cartridge-suggestions">
            {CARTRIDGE_OPTIONS.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span className="field-label">Ammo Name / Description</span>
          <input value={form.name} onChange={(e) => setField('name', e.target.value)} required />
        </label>

        <label className="field">
          <span className="field-label">Quantity</span>
          <input
            type="number"
            min="1"
            step="1"
            value={form.quantity}
            onChange={(e) => setField('quantity', e.target.value)}
            required
          />
        </label>

        <label className="field">
          <span className="field-label">Lot Number</span>
          <input value={form.lotNumber} onChange={(e) => setField('lotNumber', e.target.value)} />
        </label>

        {form.type === 'Factory' ? (
          <label className="field field-span">
            <span className="field-label">Manufacturer</span>
            <input
              list="ammo-factory-mfr"
              value={form.manufacturer}
              onChange={(e) => setField('manufacturer', e.target.value)}
            />
            <datalist id="ammo-factory-mfr">
              {BULLET_MANUFACTURERS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>
        ) : (
          <label className="field field-span">
            <span className="field-label">Link to Load Recipe (Optional)</span>
            <select
              value={form.loadId}
              onChange={(e) => handleLoadLinkChange(e.target.value)}
              disabled={fromLoadFlow}
            >
              <option value="">— None —</option>
              {matchingLoads.map((load) => (
                <option key={load.id} value={load.id}>
                  {load.name} ({load.caliber})
                </option>
              ))}
            </select>
            {fromLoadFlow ? (
              <span className="muted field-hint">
                Prefills cartridge, powder, bullet, and other components from this load. Enter
                quantity to continue.
              </span>
            ) : null}
          </label>
        )}

        <div className="field field-span">
          <button
            type="button"
            className="btn-link"
            onClick={() => setField('showComponents', !form.showComponents)}
          >
            {form.showComponents ? 'Hide component details' : 'Show component details (optional)'}
          </button>
        </div>

        {form.showComponents ? (
          <>
            <label className="field">
              <span className="field-label">Bullet Manufacturer</span>
              <input
                list="ammo-bullet-mfr"
                value={form.bulletManufacturer}
                onChange={(e) => setField('bulletManufacturer', e.target.value)}
              />
              <datalist id="ammo-bullet-mfr">
                {BULLET_MANUFACTURERS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span className="field-label">Bullet Type</span>
              <input
                list="ammo-bullet-type"
                value={form.bulletType}
                onChange={(e) => setField('bulletType', e.target.value)}
              />
              <datalist id="ammo-bullet-type">
                {bulletSuggestions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span className="field-label">Powder Manufacturer</span>
              <input
                list="ammo-powder-mfr"
                value={form.powderManufacturer}
                onChange={(e) => setField('powderManufacturer', e.target.value)}
              />
              <datalist id="ammo-powder-mfr">
                {POWDER_MANUFACTURERS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span className="field-label">Powder</span>
              <input
                list="ammo-powder"
                value={form.powder}
                onChange={(e) => setField('powder', e.target.value)}
              />
              <datalist id="ammo-powder">
                {powderSuggestions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span className="field-label">Charge Weight (gr)</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.chargeWeight}
                onChange={(e) => setField('chargeWeight', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Primer Manufacturer</span>
              <input
                list="ammo-primer-mfr"
                value={form.primerManufacturer}
                onChange={(e) => setField('primerManufacturer', e.target.value)}
              />
              <datalist id="ammo-primer-mfr">
                {PRIMER_MANUFACTURERS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span className="field-label">Primer</span>
              <input
                list="ammo-primer"
                value={form.primer}
                onChange={(e) => setField('primer', e.target.value)}
              />
              <datalist id="ammo-primer">
                {primerSuggestions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span className="field-label">Case Manufacturer</span>
              <input
                list="ammo-case-mfr"
                value={form.caseManufacturer}
                onChange={(e) => setField('caseManufacturer', e.target.value)}
              />
              <datalist id="ammo-case-mfr">
                {BRASS_MANUFACTURERS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span className="field-label">Case</span>
              <input value={form.caseName} onChange={(e) => setField('caseName', e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Seating Depth / CBTO</span>
              <input
                value={form.seatingDepth}
                onChange={(e) => setField('seatingDepth', e.target.value)}
                placeholder="e.g. 2.150 CBTO"
              />
            </label>
          </>
        ) : null}

        <label className="field field-span">
          <span className="field-label">Notes</span>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </label>

        {error ? <p className="form-error field-span">{error}</p> : null}
      </form>
    </Modal>
  )
}
