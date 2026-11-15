import { useMemo, useState } from 'react'
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
import type { LoadDevelopmentInfo, LoadInput } from '../../../shared/loads'
import { Modal } from './Modal'

type LoadFormModalProps = {
  initial?: LoadDevelopmentInfo | null
  onClose: () => void
  onSave: (input: LoadInput) => Promise<void>
}

type FormState = {
  name: string
  caliber: string
  bulletManufacturer: string
  bulletModel: string
  brassManufacturer: string
  brassModel: string
  powderManufacturer: string
  powderModel: string
  primerManufacturer: string
  primerModel: string
  powderCharge: string
  coal: string
  cbto: string
  velocity: string
  sd: string
  es: string
  notes: string
}

function blankForm(): FormState {
  return {
    name: '',
    caliber: '',
    bulletManufacturer: '',
    bulletModel: '',
    brassManufacturer: '',
    brassModel: '',
    powderManufacturer: '',
    powderModel: '',
    primerManufacturer: '',
    primerModel: '',
    powderCharge: '',
    coal: '',
    cbto: '',
    velocity: '',
    sd: '',
    es: '',
    notes: ''
  }
}

function fromLoad(load: LoadDevelopmentInfo): FormState {
  return {
    name: load.name,
    caliber: load.caliber,
    bulletManufacturer: load.bulletManufacturer,
    bulletModel: load.bulletModel,
    brassManufacturer: load.brassManufacturer,
    brassModel: load.brassModel ?? '',
    powderManufacturer: load.powderManufacturer,
    powderModel: load.powderModel,
    primerManufacturer: load.primerManufacturer,
    primerModel: load.primerModel,
    powderCharge: String(load.powderCharge),
    coal: String(load.coal),
    cbto: load.cbto != null ? String(load.cbto) : '',
    velocity: load.velocity != null ? String(load.velocity) : '',
    sd: load.sd != null ? String(load.sd) : '',
    es: load.es != null ? String(load.es) : '',
    notes: load.notes ?? ''
  }
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

export function LoadFormModal({ initial, onClose, onSave }: LoadFormModalProps): React.JSX.Element {
  const editing = Boolean(initial)
  const [form, setForm] = useState<FormState>(() => (initial ? fromLoad(initial) : blankForm()))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)

    const powderCharge = Number(form.powderCharge)
    const coal = Number(form.coal)
    if (!form.name.trim() || !form.caliber.trim()) {
      setError('Load name and cartridge are required')
      return
    }
    if (!Number.isFinite(powderCharge) || powderCharge <= 0) {
      setError('Powder charge must be greater than 0')
      return
    }
    if (!Number.isFinite(coal) || coal <= 0) {
      setError('COAL must be greater than 0')
      return
    }

    const input: LoadInput = {
      name: form.name.trim(),
      caliber: form.caliber.trim(),
      bulletManufacturer: form.bulletManufacturer.trim(),
      bulletModel: form.bulletModel.trim(),
      brassManufacturer: form.brassManufacturer.trim(),
      brassModel: form.brassModel.trim() || null,
      powderManufacturer: form.powderManufacturer.trim(),
      powderModel: form.powderModel.trim(),
      primerManufacturer: form.primerManufacturer.trim(),
      primerModel: form.primerModel.trim(),
      powderCharge,
      coal,
      cbto: parseOptionalNumber(form.cbto),
      velocity: parseOptionalNumber(form.velocity),
      sd: parseOptionalNumber(form.sd),
      es: parseOptionalNumber(form.es),
      notes: form.notes.trim() || null
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
      title={editing ? 'Edit Load' : 'New Load'}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="load-form" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Load'}
          </button>
        </>
      }
    >
      <form id="load-form" className="form-grid" onSubmit={(e) => void handleSubmit(e)}>
        <label className="field">
          <span className="field-label">Cartridge</span>
          <input
            list="load-cartridge-suggestions"
            value={form.caliber}
            onChange={(e) => setField('caliber', e.target.value)}
            required
          />
          <datalist id="load-cartridge-suggestions">
            {CARTRIDGE_OPTIONS.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span className="field-label">Load Name</span>
          <input value={form.name} onChange={(e) => setField('name', e.target.value)} required />
        </label>

        <label className="field">
          <span className="field-label">Bullet Manufacturer</span>
          <input
            list="load-bullet-mfr"
            value={form.bulletManufacturer}
            onChange={(e) => setField('bulletManufacturer', e.target.value)}
            required
          />
          <datalist id="load-bullet-mfr">
            {BULLET_MANUFACTURERS.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span className="field-label">Bullet Model</span>
          <input
            list="load-bullet-model"
            value={form.bulletModel}
            onChange={(e) => setField('bulletModel', e.target.value)}
            required
          />
          <datalist id="load-bullet-model">
            {bulletSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span className="field-label">Powder Manufacturer</span>
          <input
            list="load-powder-mfr"
            value={form.powderManufacturer}
            onChange={(e) => setField('powderManufacturer', e.target.value)}
            required
          />
          <datalist id="load-powder-mfr">
            {POWDER_MANUFACTURERS.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span className="field-label">Powder Model</span>
          <input
            list="load-powder-model"
            value={form.powderModel}
            onChange={(e) => setField('powderModel', e.target.value)}
            required
          />
          <datalist id="load-powder-model">
            {powderSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span className="field-label">Powder Charge (gr)</span>
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={form.powderCharge}
            onChange={(e) => setField('powderCharge', e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">COAL (in)</span>
          <input
            type="number"
            step="0.001"
            min="0.001"
            value={form.coal}
            onChange={(e) => setField('coal', e.target.value)}
            required
          />
        </label>

        <label className="field">
          <span className="field-label">Brass Manufacturer</span>
          <input
            list="load-brass-mfr"
            value={form.brassManufacturer}
            onChange={(e) => setField('brassManufacturer', e.target.value)}
            required
          />
          <datalist id="load-brass-mfr">
            {BRASS_MANUFACTURERS.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span className="field-label">Brass Model</span>
          <input value={form.brassModel} onChange={(e) => setField('brassModel', e.target.value)} />
        </label>

        <label className="field">
          <span className="field-label">Primer Manufacturer</span>
          <input
            list="load-primer-mfr"
            value={form.primerManufacturer}
            onChange={(e) => setField('primerManufacturer', e.target.value)}
            required
          />
          <datalist id="load-primer-mfr">
            {PRIMER_MANUFACTURERS.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span className="field-label">Primer Model</span>
          <input
            list="load-primer-model"
            value={form.primerModel}
            onChange={(e) => setField('primerModel', e.target.value)}
            required
          />
          <datalist id="load-primer-model">
            {primerSuggestions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span className="field-label">CBTO (in)</span>
          <input
            type="number"
            step="0.001"
            min="0"
            value={form.cbto}
            onChange={(e) => setField('cbto', e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Velocity (fps)</span>
          <input
            type="number"
            step="1"
            min="0"
            value={form.velocity}
            onChange={(e) => setField('velocity', e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">SD</span>
          <input
            type="number"
            step="0.1"
            min="0"
            value={form.sd}
            onChange={(e) => setField('sd', e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">ES</span>
          <input
            type="number"
            step="1"
            min="0"
            value={form.es}
            onChange={(e) => setField('es', e.target.value)}
          />
        </label>

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
