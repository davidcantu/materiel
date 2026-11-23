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
import {
  computeJump,
  formatJump,
  isoDateFromTimestamp,
  todayIsoDate
} from '../../../shared/loads'
import { Modal } from './Modal'

type LoadFormModalProps = {
  initial?: LoadDevelopmentInfo | null
  onClose: () => void
  onSave: (input: LoadInput) => Promise<void>
}

type FormState = {
  caliber: string
  name: string
  dateUpdated: string
  brassManufacturer: string
  shoulderBump: string
  neckTension: string
  primerManufacturer: string
  primerModel: string
  powderManufacturer: string
  powderModel: string
  powderCharge: string
  bulletManufacturer: string
  bulletModel: string
  lands: string
  cbto: string
  velocity: string
  sd: string
  es: string
  notes: string
}

function blankForm(): FormState {
  return {
    caliber: '',
    name: '',
    dateUpdated: todayIsoDate(),
    brassManufacturer: '',
    shoulderBump: '',
    neckTension: '',
    primerManufacturer: '',
    primerModel: '',
    powderManufacturer: '',
    powderModel: '',
    powderCharge: '',
    bulletManufacturer: '',
    bulletModel: '',
    lands: '',
    cbto: '',
    velocity: '',
    sd: '',
    es: '',
    notes: ''
  }
}

function fromLoad(load: LoadDevelopmentInfo): FormState {
  return {
    caliber: load.caliber,
    name: load.name,
    dateUpdated: isoDateFromTimestamp(load.updatedAt),
    brassManufacturer: load.brassManufacturer,
    shoulderBump: load.shoulderBump != null ? String(load.shoulderBump) : '',
    neckTension: load.neckTension != null ? String(load.neckTension) : '',
    primerManufacturer: load.primerManufacturer,
    primerModel: load.primerModel,
    powderManufacturer: load.powderManufacturer,
    powderModel: load.powderModel,
    powderCharge: load.powderCharge != null ? String(load.powderCharge) : '',
    bulletManufacturer: load.bulletManufacturer,
    bulletModel: load.bulletModel,
    lands: load.lands != null ? String(load.lands) : '',
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

  const jump = computeJump(parseOptionalNumber(form.lands), parseOptionalNumber(form.cbto))

  function setField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)

    if (!form.name.trim() || !form.caliber.trim() || !form.dateUpdated.trim()) {
      setError('Cartridge, Load Name, And Date Updated Are Required')
      return
    }

    const input: LoadInput = {
      name: form.name.trim(),
      caliber: form.caliber.trim(),
      dateUpdated: form.dateUpdated.trim(),
      brassManufacturer: form.brassManufacturer.trim() || null,
      shoulderBump: parseOptionalNumber(form.shoulderBump),
      neckTension: parseOptionalNumber(form.neckTension),
      primerManufacturer: form.primerManufacturer.trim() || null,
      primerModel: form.primerModel.trim() || null,
      powderManufacturer: form.powderManufacturer.trim() || null,
      powderModel: form.powderModel.trim() || null,
      powderCharge: parseOptionalNumber(form.powderCharge),
      bulletManufacturer: form.bulletManufacturer.trim() || null,
      bulletModel: form.bulletModel.trim() || null,
      lands: parseOptionalNumber(form.lands),
      cbto: parseOptionalNumber(form.cbto),
      velocity: parseOptionalNumber(form.velocity),
      sd: parseOptionalNumber(form.sd),
      es: parseOptionalNumber(form.es),
      notes: form.notes.trim() || null,
      brassModel: null,
      coal: null
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
        <fieldset className="form-section field-span">
          <legend className="field-label">Identity</legend>
          <div className="form-grid">
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
              <input
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Date Updated</span>
              <input
                type="date"
                value={form.dateUpdated}
                onChange={(e) => setField('dateUpdated', e.target.value)}
                required
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="form-section field-span">
          <legend className="field-label">Case Prep</legend>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Brass</span>
              <input
                list="load-brass-mfr"
                value={form.brassManufacturer}
                onChange={(e) => setField('brassManufacturer', e.target.value)}
              />
              <datalist id="load-brass-mfr">
                {BRASS_MANUFACTURERS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>

            <label className="field">
              <span className="field-label">Shoulder Bump (in)</span>
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="0.002"
                value={form.shoulderBump}
                onChange={(e) => setField('shoulderBump', e.target.value)}
              />
            </label>

            <label className="field">
              <span className="field-label">Neck Tension (in)</span>
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="0.002"
                value={form.neckTension}
                onChange={(e) => setField('neckTension', e.target.value)}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="form-section field-span">
          <legend className="field-label">Components</legend>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Primer</span>
              <input
                list="load-primer-mfr"
                value={form.primerManufacturer}
                onChange={(e) => setField('primerManufacturer', e.target.value)}
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
              />
              <datalist id="load-primer-model">
                {primerSuggestions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>

            <label className="field">
              <span className="field-label">Powder</span>
              <input
                list="load-powder-mfr"
                value={form.powderManufacturer}
                onChange={(e) => setField('powderManufacturer', e.target.value)}
              />
              <datalist id="load-powder-mfr">
                {POWDER_MANUFACTURERS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span className="field-label">Powder Type</span>
              <input
                list="load-powder-model"
                value={form.powderModel}
                onChange={(e) => setField('powderModel', e.target.value)}
              />
              <datalist id="load-powder-model">
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
                min="0.1"
                placeholder="30.4"
                value={form.powderCharge}
                onChange={(e) => setField('powderCharge', e.target.value)}
              />
            </label>

            <label className="field">
              <span className="field-label">Bullet</span>
              <input
                list="load-bullet-mfr"
                value={form.bulletManufacturer}
                onChange={(e) => setField('bulletManufacturer', e.target.value)}
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
              />
              <datalist id="load-bullet-model">
                {bulletSuggestions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
          </div>
        </fieldset>

        <fieldset className="form-section field-span">
          <legend className="field-label">Seating</legend>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Lands (in)</span>
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="CBTO at touch"
                value={form.lands}
                onChange={(e) => setField('lands', e.target.value)}
              />
              <span className="muted field-hint">CBTO At Touch</span>
            </label>
            <label className="field">
              <span className="field-label">CBTO (in)</span>
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="Loaded CBTO"
                value={form.cbto}
                onChange={(e) => setField('cbto', e.target.value)}
              />
              <span className="muted field-hint">Loaded Cartridge Base To Ogive</span>
            </label>
            <div className="field">
              <span className="field-label">Jump (in)</span>
              <input value={formatJump(jump) === '—' ? '' : formatJump(jump)} readOnly disabled />
              <span className="muted field-hint">
                Lands − CBTO. Positive = Jump; Negative = Jam.
              </span>
            </div>
          </div>
        </fieldset>

        <fieldset className="form-section field-span">
          <legend className="field-label">Results</legend>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">Average Velocity (fps)</span>
              <input
                type="number"
                step="1"
                min="0"
                value={form.velocity}
                onChange={(e) => setField('velocity', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">SD (fps)</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={form.sd}
                onChange={(e) => setField('sd', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">ES (fps)</span>
              <input
                type="number"
                step="1"
                min="0"
                value={form.es}
                onChange={(e) => setField('es', e.target.value)}
              />
            </label>
          </div>
        </fieldset>

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
