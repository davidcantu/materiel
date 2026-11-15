import { useMemo, useState } from 'react'
import type { PartInfo, PartInput, PartType } from '../../../shared/parts'
import type {
  CompleteSystemInfo,
  CustomSystemInputInfo,
  FactorySystemInputInfo
} from '../../../shared/systems'
import { CARTRIDGE_OPTIONS } from '../../../shared/catalogs'
import { partOptionLabel } from '../lib/format'
import { Modal } from './Modal'
import { PartFormModal } from './PartFormModal'
import { TypeaheadSelect } from './TypeaheadSelect'

type BuildMode = 'custom' | 'factory'

type SystemFormModalProps = {
  parts: PartInfo[]
  trackValue?: boolean
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
  name: string
  notes: string
  actionId: string
  barrelId: string
  chassisId: string
  opticId: string
  suppressorId: string
  miscPartIds: string[]
  factoryManufacturer: string
  factoryModel: string
  factoryCartridge: string
  factoryActionMaintenance: string
  factoryBarrelMaintenance: string
  factoryOpticId: string
  factorySuppressorId: string
}

function blankForm(): FormState {
  return {
    mode: 'custom',
    name: '',
    notes: '',
    actionId: '',
    barrelId: '',
    chassisId: '',
    opticId: '',
    suppressorId: '',
    miscPartIds: [],
    factoryManufacturer: '',
    factoryModel: '',
    factoryCartridge: '',
    factoryActionMaintenance: '500',
    factoryBarrelMaintenance: '300',
    factoryOpticId: '',
    factorySuppressorId: ''
  }
}

function fromSystem(system: CompleteSystemInfo): FormState {
  return {
    mode: system.buildType,
    name: system.name,
    notes: system.notes ?? '',
    actionId: system.actionId,
    barrelId: system.barrelId,
    chassisId: system.chassisId,
    opticId: system.opticId ?? '',
    suppressorId: system.suppressorId ?? '',
    miscPartIds: [...system.miscPartIds],
    factoryManufacturer: system.factoryManufacturer ?? '',
    factoryModel: system.factoryModel ?? '',
    factoryCartridge: system.factoryCartridge ?? '',
    factoryActionMaintenance: String(system.factoryActionMaintenance ?? 500),
    factoryBarrelMaintenance: String(system.factoryBarrelMaintenance ?? 300),
    factoryOpticId: system.opticId ?? '',
    factorySuppressorId: system.suppressorId ?? ''
  }
}

export function SystemFormModal({
  parts: partsProp,
  trackValue = false,
  initial,
  onClose,
  onCreateCustom,
  onCreateFactory,
  onUpdate,
  onPartsChanged
}: SystemFormModalProps): React.JSX.Element {
  const editing = Boolean(initial)
  const [form, setForm] = useState<FormState>(() => (initial ? fromSystem(initial) : blankForm()))
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
  const [createTarget, setCreateTarget] = useState<
    | 'actionId'
    | 'barrelId'
    | 'chassisId'
    | 'opticId'
    | 'suppressorId'
    | 'factoryOpticId'
    | 'factorySuppressorId'
    | { misc: number }
    | null
  >(null)

  const assignedIds = useMemo(() => {
    if (!initial) return new Set<string>()
    return new Set(
      [
        initial.actionId,
        initial.barrelId,
        initial.chassisId,
        initial.opticId,
        initial.suppressorId,
        ...initial.miscPartIds
      ].filter(Boolean) as string[]
    )
  }, [initial])

  function available(type: PartType, selectedId?: string): PartInfo[] {
    return parts.filter(
      (part) =>
        part.type === type &&
        (part.status !== 'In Use' || assignedIds.has(part.id) || part.id === selectedId)
    )
  }

  async function handleInlinePartSave(input: PartInput): Promise<void> {
    const created = await window.api.createPart(input)
    setCreatedParts((prev) => [...prev, created])
    if (createTarget === 'actionId') setField('actionId', created.id)
    else if (createTarget === 'barrelId') setField('barrelId', created.id)
    else if (createTarget === 'chassisId') setField('chassisId', created.id)
    else if (createTarget === 'opticId') setField('opticId', created.id)
    else if (createTarget === 'suppressorId') setField('suppressorId', created.id)
    else if (createTarget === 'factoryOpticId') setField('factoryOpticId', created.id)
    else if (createTarget === 'factorySuppressorId') setField('factorySuppressorId', created.id)
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

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const miscPartIds = form.miscPartIds.filter(Boolean)
      if (form.mode === 'custom') {
        const input: CustomSystemInputInfo = {
          name: form.name.trim(),
          actionId: form.actionId,
          barrelId: form.barrelId,
          chassisId: form.chassisId,
          opticId: form.opticId || null,
          suppressorId: form.suppressorId || null,
          miscPartIds,
          notes: form.notes.trim() || null
        }
        if (!input.actionId || !input.barrelId || !input.chassisId || !input.opticId) {
          throw new Error('Custom builds require Action, Barrel, Chassis, and Optic')
        }
        if (editing && initial) {
          await onUpdate(initial.id, { ...input, buildType: 'custom' })
        } else {
          await onCreateCustom(input)
        }
      } else {
        const input: FactorySystemInputInfo = {
          name: form.name.trim(),
          factoryManufacturer: form.factoryManufacturer.trim(),
          factoryModel: form.factoryModel.trim(),
          factoryCartridge: form.factoryCartridge.trim(),
          factoryActionMaintenance: Number(form.factoryActionMaintenance) || 500,
          factoryBarrelMaintenance: Number(form.factoryBarrelMaintenance) || 300,
          opticId: form.factoryOpticId || null,
          suppressorId: form.factorySuppressorId || null,
          miscPartIds,
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
                Factory Rifle
              </button>
            </div>
          </div>

          <label className="field field-span">
            <span className="field-label">Build Name</span>
            <input value={form.name} onChange={(e) => setField('name', e.target.value)} required />
          </label>

          {form.mode === 'custom' ? (
            <>
              <PartSelect
                label="Action / Receiver"
                value={form.actionId}
                options={available('Action', form.actionId)}
                onChange={(v) => setField('actionId', v)}
                required
                onCreate={() => {
                  setCreateTarget('actionId')
                  setCreatingType('Action')
                }}
              />
              <PartSelect
                label="Barrel"
                value={form.barrelId}
                options={available('Barrel', form.barrelId)}
                onChange={(v) => setField('barrelId', v)}
                required
                onCreate={() => {
                  setCreateTarget('barrelId')
                  setCreatingType('Barrel')
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
                label="Chassis / Stock"
                value={form.chassisId}
                options={available('Chassis', form.chassisId)}
                onChange={(v) => setField('chassisId', v)}
                required
                onCreate={() => {
                  setCreateTarget('chassisId')
                  setCreatingType('Chassis')
                }}
              />
              <PartSelect
                label="Optic / Scope"
                value={form.opticId}
                options={available('Optic', form.opticId)}
                onChange={(v) => setField('opticId', v)}
                required
                onCreate={() => {
                  setCreateTarget('opticId')
                  setCreatingType('Optic')
                }}
              />
              <PartSelect
                label="Muzzle Device (optional)"
                value={form.suppressorId}
                options={available('Suppressor', form.suppressorId)}
                onChange={(v) => setField('suppressorId', v)}
                allowEmpty
                onCreate={() => {
                  setCreateTarget('suppressorId')
                  setCreatingType('Suppressor')
                }}
              />
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
                        .concat(['Bergara', 'Tikka', 'Remington', 'Howa', 'Savage'])
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
                <span className="field-label">Action Maint. Interval</span>
                <input
                  type="number"
                  min="1"
                  value={form.factoryActionMaintenance}
                  onChange={(e) => setField('factoryActionMaintenance', e.target.value)}
                  required
                />
              </label>
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
              <PartSelect
                label="Optic (optional)"
                value={form.factoryOpticId}
                options={available('Optic', form.factoryOpticId)}
                onChange={(v) => setField('factoryOpticId', v)}
                allowEmpty
                onCreate={() => {
                  setCreateTarget('factoryOpticId')
                  setCreatingType('Optic')
                }}
              />
              <PartSelect
                label="Muzzle Device (optional)"
                value={form.factorySuppressorId}
                options={available('Suppressor', form.factorySuppressorId)}
                onChange={(v) => setField('factorySuppressorId', v)}
                allowEmpty
                onCreate={() => {
                  setCreateTarget('factorySuppressorId')
                  setCreatingType('Suppressor')
                }}
              />
            </>
          )}

          <div className="field field-span">
            <div className="field-row-header">
              <span className="field-label">Misc Parts</span>
              <button
                type="button"
                className="btn-link"
                onClick={addMisc}
                disabled={form.miscPartIds.length >= 8}
              >
                + Add Misc Part
              </button>
            </div>
            {form.miscPartIds.length === 0 ? (
              <p className="muted">No accessories added.</p>
            ) : (
              <div className="misc-list">
                {form.miscPartIds.map((id, index) => (
                  <div key={`misc-${index}`} className="misc-row">
                    <PartSelect
                      label={`Misc ${index + 1}`}
                      value={id}
                      options={available('Misc', id)}
                      onChange={(v) => setMiscAt(index, v)}
                      allowEmpty
                      onCreate={() => {
                        setCreateTarget({ misc: index })
                        setCreatingType('Misc')
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
          lockType
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
