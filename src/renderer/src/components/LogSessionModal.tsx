import { useMemo, useState } from 'react'
import type { AmmoInventoryInfo } from '../../../shared/ammo'
import { pickDefaultAmmo, rankLocations, systemCaliber } from '../../../shared/log-defaults'
import type { PartInfo } from '../../../shared/parts'
import type {
  NewShootingLogInputInfo,
  SessionType,
  ShootingLogInfo
} from '../../../shared/shooting-logs'
import type { CompleteSystemInfo } from '../../../shared/systems'
import { getLogSessionDefaults, rememberLogSessionDefaults } from '../lib/session-defaults'
import { Modal } from './Modal'

type LogSessionModalProps = {
  systems: CompleteSystemInfo[]
  parts: PartInfo[]
  ammo: AmmoInventoryInfo[]
  logs: ShootingLogInfo[]
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

function parseRounds(value: string): number | null {
  if (!value.trim()) return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null
  return n
}

function resolveAmmoChoice(options: {
  ammo: AmmoInventoryInfo[]
  caliber: string | null
  roundsFired: number | null
  systemId: string | null
  logs: ShootingLogInfo[]
  preferredAmmoId: string | null
}): string {
  const rounds = options.roundsFired
  if (rounds == null) {
    // No rounds yet — sticky lot if it still matches caliber.
    if (
      options.preferredAmmoId &&
      options.ammo.some(
        (item) => item.id === options.preferredAmmoId && item.caliber === options.caliber
      )
    ) {
      return options.preferredAmmoId
    }
    return MANUAL_AMMO
  }

  const picked = pickDefaultAmmo({
    ammo: options.ammo,
    caliber: options.caliber,
    roundsFired: rounds,
    systemId: options.systemId,
    logs: options.logs,
    preferredAmmoId: options.preferredAmmoId
  })
  return picked ?? MANUAL_AMMO
}

function blankForm(
  systems: CompleteSystemInfo[],
  partsById: Map<string, PartInfo>,
  ammo: AmmoInventoryInfo[],
  logs: ShootingLogInfo[]
): FormState {
  const sticky = getLogSessionDefaults()
  const systemId =
    (sticky.systemId && systems.some((s) => s.id === sticky.systemId) ? sticky.systemId : null) ??
    systems[0]?.id ??
    ''
  const selected = systems.find((s) => s.id === systemId)
  const caliber = systemCaliber(selected, partsById)
  const ammoChoice = resolveAmmoChoice({
    ammo,
    caliber,
    roundsFired: null,
    systemId: systemId || null,
    logs,
    preferredAmmoId: sticky.ammoId
  })

  return {
    systemId,
    ammoChoice,
    cartridge: caliber ?? '',
    date: todayIsoDate(),
    roundsFired: '',
    location: sticky.location ?? '',
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
  logs,
  initial,
  onClose,
  onSave
}: LogSessionModalProps): React.JSX.Element {
  const editing = Boolean(initial)
  const partsById = useMemo(() => {
    const map = new Map<string, PartInfo>()
    for (const part of parts) map.set(part.id, part)
    return map
  }, [parts])

  const [form, setForm] = useState<FormState>(() =>
    initial ? fromLog(initial) : blankForm(systems, partsById, ammo, logs)
  )
  /** When true, user picked ammo manually — stop auto-replacing. */
  const [ammoTouched, setAmmoTouched] = useState(() => Boolean(initial))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedSystem = systems.find((system) => system.id === form.systemId)
  const caliber = systemCaliber(selectedSystem, partsById)

  const locationSuggestions = useMemo(() => rankLocations(logs), [logs])

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

  function applySmartAmmo(
    next: FormState,
    preferredAmmoId: string | null,
    force = false
  ): FormState {
    if (ammoTouched && !force) return next
    const sticky = getLogSessionDefaults()
    const choice = resolveAmmoChoice({
      ammo,
      caliber: systemCaliber(
        systems.find((s) => s.id === next.systemId),
        partsById
      ),
      roundsFired: parseRounds(next.roundsFired),
      systemId: next.systemId || null,
      logs,
      preferredAmmoId: preferredAmmoId ?? sticky.ammoId
    })
    return { ...next, ammoChoice: choice }
  }

  function handleSystemChange(systemId: string): void {
    const nextCaliber = systemCaliber(
      systems.find((s) => s.id === systemId),
      partsById
    )
    setAmmoTouched(false)
    setForm((prev) => {
      const next: FormState = {
        ...prev,
        systemId,
        cartridge: nextCaliber ?? '',
        ammoChoice: MANUAL_AMMO
      }
      return applySmartAmmo(next, getLogSessionDefaults().ammoId, true)
    })
  }

  function handleRoundsChange(value: string): void {
    setForm((prev) => {
      const next = { ...prev, roundsFired: value }
      return applySmartAmmo(next, getLogSessionDefaults().ammoId)
    })
  }

  function handleAmmoChange(value: string): void {
    setAmmoTouched(true)
    setField('ammoChoice', value)
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
      rememberLogSessionDefaults({
        systemId: input.systemId,
        location: input.location,
        ammoId: input.ammoId ?? null
      })
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
            onChange={(e) => handleAmmoChange(e.target.value)}
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
            onChange={(e) => handleRoundsChange(e.target.value)}
            required
          />
        </label>

        <label className="field field-span">
          <span className="field-label">Location</span>
          <input
            list="log-location-suggestions"
            value={form.location}
            onChange={(e) => setField('location', e.target.value)}
            placeholder="Range or match venue"
            required
          />
          <datalist id="log-location-suggestions">
            {locationSuggestions.map((item) => (
              <option key={item.location} value={item.location} />
            ))}
          </datalist>
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
