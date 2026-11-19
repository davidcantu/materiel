import { useMemo, useState } from 'react'
import type { AmmoInput, AmmoInventoryInfo } from '../../../shared/ammo'
import { formatLogConfirmSummary } from '../../../shared/log-confirm'
import { pickDefaultAmmo, rankLocations, systemCaliber } from '../../../shared/log-defaults'
import type { PartInfo } from '../../../shared/parts'
import type {
  NewShootingLogInputInfo,
  SessionType,
  ShootingLogInfo
} from '../../../shared/shooting-logs'
import type { CompleteSystemInfo } from '../../../shared/systems'
import { getLogSessionDefaults, rememberLogSessionDefaults } from '../lib/session-defaults'
import { AmmoFormModal } from './AmmoFormModal'
import { Modal } from './Modal'
import { TypeaheadSelect } from './TypeaheadSelect'

type LogSessionModalProps = {
  systems: CompleteSystemInfo[]
  parts: PartInfo[]
  ammo: AmmoInventoryInfo[]
  logs: ShootingLogInfo[]
  loads?: import('../../../shared/loads').LoadDevelopmentInfo[]
  initial?: ShootingLogInfo | null
  onClose: () => void
  onSave: (input: NewShootingLogInputInfo, editingId?: string) => Promise<void>
  onAmmoChanged?: () => void
  onNavigateBuilds?: () => void
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
  placement: string
  percentOfWinner: string
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
    placement: '',
    percentOfWinner: '',
    notes: ''
  }
}

function fromLog(log: ShootingLogInfo): FormState {
  return {
    systemId: log.systemId ?? '',
    ammoChoice: log.ammoId ?? MANUAL_AMMO,
    cartridge: log.cartridge ?? '',
    date: log.date.slice(0, 10),
    roundsFired: String(log.roundsFired),
    location: log.location,
    velocity: log.velocity != null ? String(log.velocity) : '',
    sessionType: log.sessionType,
    placement: log.placement != null ? String(log.placement) : '',
    percentOfWinner: log.percentOfWinner != null ? log.percentOfWinner.toFixed(3) : '',
    notes: log.notes ?? ''
  }
}

function ammoOptionLabel(item: AmmoInventoryInfo): string {
  const lot = item.lotNumber?.trim()
  const qty = `${item.quantity} left`
  if (lot) return `${item.name} · Lot ${lot} (${qty})`
  return `${item.name} (${qty})`
}

export function LogSessionModal({
  systems,
  parts,
  ammo: ammoProp,
  logs,
  loads = [],
  initial,
  onClose,
  onSave,
  onAmmoChanged,
  onNavigateBuilds
}: LogSessionModalProps): React.JSX.Element {
  const editing = Boolean(initial)
  const partsById = useMemo(() => {
    const map = new Map<string, PartInfo>()
    for (const part of parts) map.set(part.id, part)
    return map
  }, [parts])

  const [createdAmmo, setCreatedAmmo] = useState<AmmoInventoryInfo[]>([])
  const ammo = useMemo(() => {
    const byId = new Map<string, AmmoInventoryInfo>()
    for (const item of ammoProp) byId.set(item.id, item)
    for (const item of createdAmmo) byId.set(item.id, item)
    return [...byId.values()]
  }, [ammoProp, createdAmmo])

  const [form, setForm] = useState<FormState>(() =>
    initial ? fromLog(initial) : blankForm(systems, partsById, ammoProp, logs)
  )
  const [ammoTouched, setAmmoTouched] = useState(() => Boolean(initial))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [pendingInput, setPendingInput] = useState<NewShootingLogInputInfo | null>(null)
  const [creatingAmmo, setCreatingAmmo] = useState(false)

  const selectedSystem = systems.find((system) => system.id === form.systemId)
  const caliber = systemCaliber(selectedSystem, partsById)

  const locationSuggestions = useMemo(() => rankLocations(logs), [logs])

  const matchedByCaliber = caliber ? ammo.filter((item) => item.caliber === caliber) : []
  const matchingAmmo =
    form.ammoChoice !== MANUAL_AMMO && !matchedByCaliber.some((item) => item.id === form.ammoChoice)
      ? (() => {
          const selected = ammo.find((item) => item.id === form.ammoChoice)
          return selected ? [selected, ...matchedByCaliber] : matchedByCaliber
        })()
      : matchedByCaliber

  const selectedAmmo =
    form.ammoChoice !== MANUAL_AMMO
      ? (ammo.find((item) => item.id === form.ammoChoice) ?? null)
      : null

  const confirmSummary = pendingInput
    ? formatLogConfirmSummary({
        roundsFired: pendingInput.roundsFired,
        cartridge: pendingInput.cartridge ?? caliber,
        ammo: selectedAmmo,
        location: pendingInput.location,
        systemName: selectedSystem?.name ?? null
      })
    : null

  function setField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }))
    setConfirming(false)
    setPendingInput(null)
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
    setConfirming(false)
    setPendingInput(null)
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
    setConfirming(false)
    setPendingInput(null)
    setForm((prev) => {
      const next = { ...prev, roundsFired: value }
      return applySmartAmmo(next, getLogSessionDefaults().ammoId)
    })
  }

  function handleAmmoChange(value: string): void {
    setAmmoTouched(true)
    setField('ammoChoice', value)
  }

  function buildInput(): NewShootingLogInputInfo | null {
    setError(null)

    if (!form.systemId) {
      setError('Select a firearm system.')
      return null
    }

    const roundsFired = Number(form.roundsFired)
    if (!Number.isFinite(roundsFired) || roundsFired < 0 || !Number.isInteger(roundsFired)) {
      setError('Rounds fired must be a whole number ≥ 0.')
      return null
    }

    if (!form.location.trim()) {
      setError('Location is required.')
      return null
    }

    if (!form.date) {
      setError('Date is required.')
      return null
    }

    const isManual = form.ammoChoice === MANUAL_AMMO
    const cartridge = form.cartridge.trim()
    if (isManual && !cartridge) {
      setError('Cartridge name is required for manual entry.')
      return null
    }

    let velocity: number | null = null
    if (form.velocity.trim()) {
      velocity = Number(form.velocity)
      if (!Number.isFinite(velocity) || velocity < 0) {
        setError('Velocity must be a number ≥ 0.')
        return null
      }
    }

    let placement: number | null = null
    let percentOfWinner: number | null = null
    if (form.sessionType === 'Match') {
      if (form.placement.trim()) {
        placement = Number(form.placement)
        if (!Number.isFinite(placement) || !Number.isInteger(placement) || placement < 1) {
          setError('Place must be a whole number ≥ 1.')
          return null
        }
      }
      if (form.percentOfWinner.trim()) {
        percentOfWinner = Number(form.percentOfWinner)
        if (!Number.isFinite(percentOfWinner) || percentOfWinner < 0 || percentOfWinner > 100) {
          setError('% of Winner must be between 0 and 100.')
          return null
        }
      }
    }

    return {
      systemId: form.systemId,
      ammoId: isManual ? null : form.ammoChoice,
      cartridge: isManual ? cartridge : cartridge || null,
      date: form.date,
      location: form.location.trim(),
      roundsFired,
      velocity,
      sessionType: form.sessionType,
      placement,
      percentOfWinner,
      notes: form.notes.trim() || null
    }
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault()
    const input = buildInput()
    if (!input) return

    if (!confirming) {
      setPendingInput(input)
      setConfirming(true)
      return
    }

    void commitSave(input)
  }

  async function commitSave(input: NewShootingLogInputInfo): Promise<void> {
    setSaving(true)
    setError(null)
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
      setConfirming(false)
      setPendingInput(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleInlineAmmoSave(input: AmmoInput): Promise<void> {
    const created = await window.api.createAmmo(input)
    setCreatedAmmo((prev) => [...prev, created])
    setAmmoTouched(true)
    setForm((prev) => ({ ...prev, ammoChoice: created.id }))
    setCreatingAmmo(false)
    setConfirming(false)
    setPendingInput(null)
    onAmmoChanged?.()
  }

  const isNewLocation =
    form.location.trim().length > 0 &&
    !locationSuggestions.some(
      (item) => item.location.toLowerCase() === form.location.trim().toLowerCase()
    )

  return (
    <>
      <Modal
        title={editing ? 'Edit Session' : 'Log Session'}
        onClose={onClose}
        footer={
          <>
            {confirming ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setConfirming(false)
                  setPendingInput(null)
                }}
                disabled={saving}
              >
                Back
              </button>
            ) : (
              <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
                Cancel
              </button>
            )}
            <button type="submit" form="log-session-form" className="btn-primary" disabled={saving}>
              {saving
                ? 'Saving…'
                : confirming
                  ? editing
                    ? 'Confirm Save'
                    : 'Confirm Log'
                  : editing
                    ? 'Review Changes'
                    : 'Review Session'}
            </button>
          </>
        }
      >
        <form id="log-session-form" className="form-grid" onSubmit={handleSubmit}>
          {systems.length === 0 ? (
            <div className="empty-state field-span">
              <h2>No complete firearms yet</h2>
              <p>Add your first complete build before logging a session.</p>
              {onNavigateBuilds ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    onClose()
                    onNavigateBuilds()
                  }}
                >
                  Add your first complete build
                </button>
              ) : null}
            </div>
          ) : null}

          {confirming && confirmSummary ? (
            <div className="confirm-summary field-span" role="status">
              <div className="confirm-summary-label">Confirm before save</div>
              <div className="confirm-summary-line">{confirmSummary}</div>
              {selectedSystem ? <div className="muted">{selectedSystem.name}</div> : null}
            </div>
          ) : null}

          <TypeaheadSelect
            label="Firearm system"
            value={form.systemId}
            options={systems.map((system) => ({
              id: system.id,
              label: `${system.name}${
                systemCaliber(system, partsById) ? ` (${systemCaliber(system, partsById)})` : ''
              }`,
              keywords: system.id
            }))}
            onChange={handleSystemChange}
            required
            disabled={systems.length === 0 || confirming}
            placeholder="Type system name…"
          />

          <TypeaheadSelect
            label="Ammunition"
            value={form.ammoChoice}
            options={[
              { id: MANUAL_AMMO, label: '-- Manual Entry --' },
              ...matchingAmmo.map((item) => ({
                id: item.id,
                label: ammoOptionLabel(item),
                keywords: [item.name, item.lotNumber, item.caliber, item.id]
                  .filter(Boolean)
                  .join(' ')
              }))
            ]}
            onChange={handleAmmoChange}
            disabled={!form.systemId || confirming}
            placeholder="Type lot name or id…"
            createLabel="+ New ammo lot"
            onCreate={() => setCreatingAmmo(true)}
          />

          {form.ammoChoice === MANUAL_AMMO ? (
            <label className="field field-span">
              <span className="field-label">Cartridge Name</span>
              <input
                value={form.cartridge}
                onChange={(e) => setField('cartridge', e.target.value)}
                placeholder="e.g. 6.5 Creedmoor Match"
                required
                disabled={confirming}
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
              disabled={confirming}
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
              disabled={confirming}
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
              disabled={confirming}
            />
            <datalist id="log-location-suggestions">
              {locationSuggestions.map((item) => (
                <option key={item.location} value={item.location} />
              ))}
            </datalist>
            {locationSuggestions.length > 0 ? (
              <div className="chip-row location-chip-row" aria-label="Recent locations">
                {locationSuggestions.slice(0, 5).map((item) => (
                  <button
                    key={item.location}
                    type="button"
                    className={`chip${form.location === item.location ? ' active' : ''}`}
                    disabled={confirming}
                    onClick={() => setField('location', item.location)}
                  >
                    {item.location}
                  </button>
                ))}
              </div>
            ) : null}
            {isNewLocation ? (
              <span className="muted field-hint">
                + New location — will be remembered after you save this session
              </span>
            ) : null}
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
              disabled={confirming}
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
                  disabled={confirming}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {form.sessionType === 'Match' ? (
            <>
              <label className="field">
                <span className="field-label">Place</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.placement}
                  onChange={(e) => setField('placement', e.target.value)}
                  placeholder="e.g. 1"
                  disabled={confirming}
                />
              </label>
              <label className="field">
                <span className="field-label">% of Winner</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.001}
                  value={form.percentOfWinner}
                  onChange={(e) => setField('percentOfWinner', e.target.value)}
                  placeholder="e.g. 97.250"
                  disabled={confirming}
                />
              </label>
            </>
          ) : null}

          <label className="field field-span">
            <span className="field-label">Notes</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Optional notes"
              disabled={confirming}
            />
          </label>

          {error ? <p className="form-error field-span">{error}</p> : null}
        </form>
      </Modal>

      {creatingAmmo ? (
        <AmmoFormModal
          loads={loads}
          defaultCaliber={caliber}
          onClose={() => setCreatingAmmo(false)}
          onSave={handleInlineAmmoSave}
        />
      ) : null}
    </>
  )
}
