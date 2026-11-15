import { useMemo, useState } from 'react'
import type { AmmoInventoryInfo } from '../../../shared/ammo'
import type { PartInfo } from '../../../shared/parts'
import type {
  NewShootingLogInputInfo,
  SessionType,
  ShootingLogInfo
} from '../../../shared/shooting-logs'
import type { CompleteSystemInfo } from '../../../shared/systems'
import { Modal } from './Modal'

type LogSessionModalProps = {
  systems: CompleteSystemInfo[]
  parts: PartInfo[]
  ammo: AmmoInventoryInfo[]
  initial?: ShootingLogInfo | null
  onClose: () => void
  onSave: (input: NewShootingLogInputInfo, editingId?: string) => Promise<void>
}

type FormState = {
  systemId: string
  ammoChoice: string
  cartridge: string
  date: string
  roundsFired: string
  location: string
  velocity: string
  sessionType: SessionType
  notes: string
}

const MANUAL_AMMO = '__manual__'

function todayIsoDate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function systemCaliber(
  system: CompleteSystemInfo | undefined,
  partsById: Map<string, PartInfo>
): string | null {
  if (!system) return null
  if (system.buildType === 'factory') return system.factoryCartridge
  return partsById.get(system.barrelId)?.caliber ?? null
}

function blankForm(defaultSystemId = ''): FormState {
  return {
    systemId: defaultSystemId,
    ammoChoice: MANUAL_AMMO,
    cartridge: '',
    date: todayIsoDate(),
    roundsFired: '',
    location: '',
    velocity: '',
    sessionType: 'Practice',
    notes: ''
  }
}

function fromLog(log: ShootingLogInfo): FormState {
  return {
    systemId: log.systemId,
    ammoChoice: log.ammoId ?? MANUAL_AMMO,
    cartridge: log.cartridge ?? '',
    date: log.date.slice(0, 10),
    roundsFired: String(log.roundsFired),
    location: log.location,
    velocity: log.velocity != null ? String(log.velocity) : '',
    sessionType: log.sessionType,
    notes: log.notes ?? ''
  }
}

export function LogSessionModal({
  systems,
  parts,
  ammo,
  initial,
  onClose,
  onSave
}: LogSessionModalProps): React.JSX.Element {
  const editing = Boolean(initial)
  const [form, setForm] = useState<FormState>(() =>
    initial ? fromLog(initial) : blankForm(systems[0]?.id ?? '')
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const partsById = useMemo(() => {
    const map = new Map<string, PartInfo>()
    for (const part of parts) map.set(part.id, part)
    return map
  }, [parts])

  const selectedSystem = systems.find((system) => system.id === form.systemId)
  const caliber = systemCaliber(selectedSystem, partsById)

  const matchingAmmo = useMemo(() => {
    const matched = caliber ? ammo.filter((item) => item.caliber === caliber) : []
    if (form.ammoChoice !== MANUAL_AMMO && !matched.some((item) => item.id === form.ammoChoice)) {
      const selected = ammo.find((item) => item.id === form.ammoChoice)
      if (selected) return [selected, ...matched]
    }
    return matched
  }, [ammo, caliber, form.ammoChoice])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSystemChange(systemId: string): void {
    setForm((prev) => ({
      ...prev,
      systemId,
      ammoChoice: MANUAL_AMMO,
      cartridge: prev.ammoChoice === MANUAL_AMMO ? prev.cartridge : ''
    }))
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)

    if (!form.systemId) {
      setError('Select a rifle system.')
      return
    }

    const roundsFired = Number(form.roundsFired)
    if (!Number.isFinite(roundsFired) || roundsFired < 0 || !Number.isInteger(roundsFired)) {
      setError('Rounds fired must be a whole number ≥ 0.')
      return
    }

    if (!form.location.trim()) {
      setError('Location is required.')
      return
    }

    if (!form.date) {
      setError('Date is required.')
      return
    }

    const isManual = form.ammoChoice === MANUAL_AMMO
    const cartridge = form.cartridge.trim()
    if (isManual && !cartridge) {
      setError('Cartridge name is required for manual entry.')
      return
    }

    let velocity: number | null = null
    if (form.velocity.trim()) {
      velocity = Number(form.velocity)
      if (!Number.isFinite(velocity) || velocity < 0) {
        setError('Velocity must be a number ≥ 0.')
        return
      }
    }

    const input: NewShootingLogInputInfo = {
      systemId: form.systemId,
      ammoId: isManual ? null : form.ammoChoice,
      cartridge: isManual ? cartridge : cartridge || null,
      date: form.date,
      location: form.location.trim(),
      roundsFired,
      velocity,
      sessionType: form.sessionType,
      notes: form.notes.trim() || null
    }

    setSaving(true)
    try {
      await onSave(input, initial?.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save session')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={editing ? 'Edit Session' : 'Log Session'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="log-session-form" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Log Session'}
          </button>
        </>
      }
    >
      <form id="log-session-form" className="form-grid" onSubmit={(e) => void handleSubmit(e)}>
        {systems.length === 0 ? (
          <p className="form-error field-span">
            Add a complete rifle build before logging a session.
          </p>
        ) : null}

        <label className="field">
          <span className="field-label">Rifle System</span>
          <select
            value={form.systemId}
            onChange={(e) => handleSystemChange(e.target.value)}
            required
            disabled={systems.length === 0}
          >
            <option value="" disabled>
              Select system…
            </option>
            {systems.map((system) => (
              <option key={system.id} value={system.id}>
                {system.name}
                {systemCaliber(system, partsById) ? ` (${systemCaliber(system, partsById)})` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Ammunition</span>
          <select
            value={form.ammoChoice}
            onChange={(e) => setField('ammoChoice', e.target.value)}
            disabled={!form.systemId}
          >
            <option value={MANUAL_AMMO}>-- Manual Entry --</option>
            {matchingAmmo.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.quantity} left)
              </option>
            ))}
          </select>
        </label>

        {form.ammoChoice === MANUAL_AMMO ? (
          <label className="field field-span">
            <span className="field-label">Cartridge Name</span>
            <input
              value={form.cartridge}
              onChange={(e) => setField('cartridge', e.target.value)}
              placeholder="e.g. 6.5 Creedmoor Match"
              required
            />
          </label>
        ) : null}

        <label className="field">
          <span className="field-label">Date</span>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setField('date', e.target.value)}
            required
          />
        </label>

        <label className="field">
          <span className="field-label">Rounds Fired</span>
          <input
            type="number"
            min={0}
            step={1}
            value={form.roundsFired}
            onChange={(e) => setField('roundsFired', e.target.value)}
            required
          />
        </label>

        <label className="field field-span">
          <span className="field-label">Location</span>
          <input
            value={form.location}
            onChange={(e) => setField('location', e.target.value)}
            placeholder="Range or match venue"
            required
          />
        </label>

        <label className="field">
          <span className="field-label">Avg Velocity (fps)</span>
          <input
            type="number"
            min={0}
            step={1}
            value={form.velocity}
            onChange={(e) => setField('velocity', e.target.value)}
            placeholder="Optional"
          />
        </label>

        <div className="field">
          <span className="field-label">Session Type</span>
          <div className="chip-row" role="group" aria-label="Session type">
            {(['Practice', 'Match'] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={`chip${form.sessionType === type ? ' active' : ''}`}
                onClick={() => setField('sessionType', type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <label className="field field-span">
          <span className="field-label">Notes</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            placeholder="Optional notes"
          />
        </label>

        {error ? <p className="form-error field-span">{error}</p> : null}
      </form>
    </Modal>
  )
}
