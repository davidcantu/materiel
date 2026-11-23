import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AmmoInput, AmmoInventoryInfo } from '../../../shared/ammo'
import type { LoadDevelopmentInfo, LoadInput } from '../../../shared/loads'
import {
  computeJump,
  formatInches3,
  formatJump,
  isoDateFromTimestamp
} from '../../../shared/loads'
import { AmmoFormModal } from '../components/AmmoFormModal'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/icons/Icon'
import { LoadFormModal } from '../components/LoadFormModal'
import { PageFeedback } from '../components/PageFeedback'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/toast-context'

type SubTab = 'inventory' | 'loads'

type AmmoPageProps = {
  trackAmmo?: boolean
  trackLoads?: boolean
}

function telemetry(value: number | null | undefined): string {
  return value == null ? '—' : String(value)
}

function formatAcquiredDate(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(`${iso.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function AmmoCard({
  ammo,
  loadName,
  onEdit,
  onDelete,
  onMoveToPractice
}: {
  ammo: AmmoInventoryInfo
  loadName: string | null
  onEdit: () => void
  onDelete: () => void
  onMoveToPractice: () => void
}): React.JSX.Element {
  const components = [
    ammo.bulletManufacturer || ammo.bulletType
      ? {
          label: 'Bullet',
          value: [ammo.bulletManufacturer, ammo.bulletType].filter(Boolean).join(' ')
        }
      : null,
    ammo.powderManufacturer || ammo.powder || ammo.chargeWeight != null
      ? {
          label: 'Powder',
          value: [
            [ammo.powderManufacturer, ammo.powder].filter(Boolean).join(' '),
            ammo.chargeWeight != null ? `${ammo.chargeWeight}gr` : null
          ]
            .filter(Boolean)
            .join(' · ')
        }
      : null,
    ammo.primerManufacturer || ammo.primer
      ? {
          label: 'Primer',
          value: [ammo.primerManufacturer, ammo.primer].filter(Boolean).join(' ')
        }
      : null,
    ammo.caseManufacturer
      ? {
          label: 'Brass',
          value: ammo.caseManufacturer
        }
      : null,
    ammo.seatingDepth
      ? {
          label: 'Seating',
          value: ammo.seatingDepth
        }
      : null
  ].filter(Boolean) as Array<{ label: string; value: string }>

  const isPractice = ammo.name === 'Practice Ammo'
  const acquiredLabel = formatAcquiredDate(ammo.acquiredDate)

  return (
    <article className="ammo-card">
      <header className="ammo-card-header">
        <div className="ammo-card-badges">
          <span className={`ammo-badge ammo-badge-${ammo.type.toLowerCase()}`}>{ammo.type}</span>
          <span className="ammo-badge ammo-badge-caliber">{ammo.caliber}</span>
        </div>
        <div className="ammo-card-actions">
          <button type="button" className="btn-ghost btn-sm" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={onDelete}>
            Delete
          </button>
        </div>
      </header>

      {ammo.manufacturer ? <p className="ammo-card-mfr">{ammo.manufacturer}</p> : null}
      {isPractice ? <h3 className="ammo-card-title">Practice Ammo</h3> : null}

      <div className="ammo-qty-row">
        <span className="ammo-qty">{ammo.quantity}</span>
        <span className="ammo-qty-label">rounds</span>
        {ammo.lotNumber ? <span className="ammo-lot">Lot #{ammo.lotNumber}</span> : null}
      </div>

      {acquiredLabel ? (
        <p className="ammo-acquired muted">
          {ammo.type === 'Handload' ? 'Made' : 'Purchased'} {acquiredLabel}
        </p>
      ) : null}

      {components.length ? (
        <dl className="ammo-component-grid">
          {components.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {loadName ? (
        <p className="ammo-load-link">
          Load recipe: <strong>{loadName}</strong>
        </p>
      ) : null}

      {ammo.notes ? <p className="ammo-notes">{ammo.notes}</p> : null}

      {!isPractice ? (
        <footer className="ammo-card-footer">
          <button type="button" className="btn-ghost" onClick={onMoveToPractice}>
            Move to practice
          </button>
        </footer>
      ) : null}
    </article>
  )
}

function chargeLabel(load: LoadDevelopmentInfo): string {
  if (load.powderCharge == null) return '—'
  const powder = [load.powderManufacturer, load.powderModel].filter(Boolean).join(' ')
  return powder ? `${powder} · ${load.powderCharge} gr` : `${load.powderCharge} gr`
}

function bulletLabel(load: LoadDevelopmentInfo): string {
  const label = [load.bulletManufacturer, load.bulletModel].filter(Boolean).join(' ')
  return label || '—'
}

export function AmmoPage({
  trackAmmo = true,
  trackLoads = true
}: AmmoPageProps): React.JSX.Element {
  const toast = useToast()
  const initialTab: SubTab = trackAmmo ? 'inventory' : 'loads'
  const [subTab, setSubTab] = useState<SubTab>(initialTab)
  const [ammo, setAmmo] = useState<AmmoInventoryInfo[]>([])
  const [loads, setLoads] = useState<LoadDevelopmentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ammoModalOpen, setAmmoModalOpen] = useState(false)
  const [loadModalOpen, setLoadModalOpen] = useState(false)
  const [editingAmmo, setEditingAmmo] = useState<AmmoInventoryInfo | null>(null)
  const [editingLoad, setEditingLoad] = useState<LoadDevelopmentInfo | null>(null)
  const [makeAmmoFromLoad, setMakeAmmoFromLoad] = useState<LoadDevelopmentInfo | null>(null)

  const loadsById = useMemo(() => {
    const map = new Map<string, LoadDevelopmentInfo>()
    for (const load of loads) map.set(load.id, load)
    return map
  }, [loads])

  const load = useCallback(async () => {
    setError(null)
    try {
      const [nextAmmo, nextLoads] = await Promise.all([
        window.api.listAmmo(),
        window.api.listLoads()
      ])
      setAmmo(nextAmmo)
      setLoads(nextLoads)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ammo data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.all([window.api.listAmmo(), window.api.listLoads()])
      .then(([nextAmmo, nextLoads]) => {
        if (!cancelled) {
          setAmmo(nextAmmo)
          setLoads(nextLoads)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load ammo data')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (subTab === 'inventory' && !trackAmmo && trackLoads) setSubTab('loads')
    if (subTab === 'loads' && !trackLoads && trackAmmo) setSubTab('inventory')
  }, [subTab, trackAmmo, trackLoads])

  function openCreateAmmo(): void {
    setEditingAmmo(null)
    setMakeAmmoFromLoad(null)
    setAmmoModalOpen(true)
  }

  function openMakeAmmo(loadItem: LoadDevelopmentInfo): void {
    setEditingAmmo(null)
    setMakeAmmoFromLoad(loadItem)
    setAmmoModalOpen(true)
  }

  function openCreateLoad(): void {
    setEditingLoad(null)
    setLoadModalOpen(true)
  }

  async function handleSaveAmmo(input: AmmoInput): Promise<void> {
    if (editingAmmo) {
      await window.api.updateAmmo(editingAmmo.id, input)
      toast.success('Ammo updated.')
    } else {
      await window.api.createAmmo(input)
      toast.success(makeAmmoFromLoad ? 'Ammo made from load.' : 'Ammo added.')
    }
    await load()
  }

  async function handleSaveLoad(input: LoadInput): Promise<void> {
    if (editingLoad) {
      await window.api.updateLoad(editingLoad.id, input)
      toast.success('Load updated.')
    } else {
      await window.api.createLoad(input)
      toast.success('Load created.')
    }
    await load()
  }

  async function handleDeleteAmmo(item: AmmoInventoryInfo): Promise<void> {
    const label = item.name === 'Practice Ammo' ? 'Practice Ammo' : item.caliber
    if (!window.confirm(`Delete ${label}?`)) return
    try {
      await window.api.deleteAmmo(item.id)
      toast.success('Ammo deleted.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  async function handleDeleteLoad(item: LoadDevelopmentInfo): Promise<void> {
    if (!window.confirm(`Delete load “${item.name}”?`)) return
    try {
      await window.api.deleteLoad(item.id)
      toast.success('Load deleted.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  async function handleMoveToPractice(item: AmmoInventoryInfo): Promise<void> {
    if (
      !window.confirm(
        `Move ${item.quantity} rounds of ${item.caliber} into Practice Ammo?`
      )
    ) {
      return
    }
    try {
      await window.api.moveAmmoToPractice(item.id)
      toast.success('Moved to practice ammo.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Move to practice failed')
    }
  }

  const showInventory = trackAmmo
  const showLoads = trackLoads
  const activeTab: SubTab =
    subTab === 'inventory' && showInventory
      ? 'inventory'
      : subTab === 'loads' && showLoads
        ? 'loads'
        : showInventory
          ? 'inventory'
          : 'loads'

  const primaryAction =
    activeTab === 'inventory' ? (
      <button type="button" className="btn-primary btn-with-icon" onClick={openCreateAmmo}>
        <Icon name="add" size={16} />
        Add Ammo
      </button>
    ) : (
      <button type="button" className="btn-primary btn-with-icon" onClick={openCreateLoad}>
        <Icon name="add" size={16} />
        New Load
      </button>
    )

  return (
    <div className="page">
      <PageHeader
        title={
          showInventory && showLoads
            ? 'Ammo & Reloading'
            : showLoads
              ? 'Load Data'
              : 'Ammo Inventory'
        }
        description={
          showInventory && !showLoads
            ? 'Track Ammunition Lots On Hand.'
            : !showInventory && showLoads
              ? 'Reloading Load Development Recipes.'
              : 'Track Ammunition Lots And Reloading Load Development.'
        }
        actions={
          <>
            {showInventory && showLoads ? (
              <div className="subtab-row" role="tablist" aria-label="Ammo sections">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'inventory'}
                  className={`chip${activeTab === 'inventory' ? ' active' : ''}`}
                  onClick={() => setSubTab('inventory')}
                >
                  Inventory
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'loads'}
                  className={`chip${activeTab === 'loads' ? ' active' : ''}`}
                  onClick={() => setSubTab('loads')}
                >
                  Load data
                </button>
              </div>
            ) : null}
            {showInventory || showLoads ? primaryAction : null}
          </>
        }
      />

      <PageFeedback
        loading={loading}
        loadingLabel="Loading ammo…"
        error={error}
        onRetry={() => void load()}
      />

      {activeTab === 'inventory' && showInventory ? (
        <>
          {!loading && ammo.length === 0 ? (
            <EmptyState
              icon="ammo"
              title="No ammunition tracked"
              description="Add factory or handload lots to track on-hand quantity."
              actionLabel="Add first ammo"
              onAction={openCreateAmmo}
            />
          ) : null}

          {!loading && ammo.length > 0 ? (
            <div className="ammo-card-grid">
              {ammo.map((item) => (
                <AmmoCard
                  key={item.id}
                  ammo={item}
                  loadName={item.loadId ? (loadsById.get(item.loadId)?.name ?? null) : null}
                  onEdit={() => {
                    setEditingAmmo(item)
                    setMakeAmmoFromLoad(null)
                    setAmmoModalOpen(true)
                  }}
                  onDelete={() => void handleDeleteAmmo(item)}
                  onMoveToPractice={() => void handleMoveToPractice(item)}
                />
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {activeTab === 'loads' && showLoads ? (
        <>
          {!loading && loads.length === 0 ? (
            <EmptyState
              icon="loads"
              title="No load data yet"
              description="Create A Reloading Recipe. Only Cartridge, Load Name, And Date Updated Are Required."
              actionLabel="Create first load"
              onAction={openCreateLoad}
            />
          ) : null}

          {!loading && loads.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cartridge</th>
                    <th>Load Name</th>
                    <th>Date Updated</th>
                    <th>Charge</th>
                    <th>Bullet</th>
                    <th>Jump</th>
                    <th>Avg Vel</th>
                    <th>SD</th>
                    <th>ES</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loads.map((item) => {
                    const jump = computeJump(item.lands, item.cbto)
                    return (
                      <tr
                        key={item.id}
                        className="clickable-row"
                        onClick={() => {
                          setEditingLoad(item)
                          setLoadModalOpen(true)
                        }}
                      >
                        <td>{item.caliber}</td>
                        <td>
                          <div className="cell-title">{item.name}</div>
                          {item.notes ? <div className="cell-sub">{item.notes}</div> : null}
                        </td>
                        <td>{isoDateFromTimestamp(item.updatedAt)}</td>
                        <td>{chargeLabel(item)}</td>
                        <td>{bulletLabel(item)}</td>
                        <td title={jump == null ? undefined : `Lands ${formatInches3(item.lands)} − CBTO ${formatInches3(item.cbto)}`}>
                          {formatJump(jump)}
                        </td>
                        <td>{telemetry(item.velocity)}</td>
                        <td>{item.sd == null ? '—' : item.sd.toFixed(1)}</td>
                        <td>{telemetry(item.es)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="btn-primary btn-sm"
                              onClick={() => openMakeAmmo(item)}
                            >
                              Make Ammo
                            </button>
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              onClick={() => void handleDeleteLoad(item)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}

      {ammoModalOpen ? (
        <AmmoFormModal
          initial={editingAmmo}
          fromLoad={makeAmmoFromLoad}
          loads={loads}
          onClose={() => {
            setAmmoModalOpen(false)
            setEditingAmmo(null)
            setMakeAmmoFromLoad(null)
          }}
          onSave={handleSaveAmmo}
        />
      ) : null}

      {loadModalOpen ? (
        <LoadFormModal
          initial={editingLoad}
          onClose={() => {
            setLoadModalOpen(false)
            setEditingLoad(null)
          }}
          onSave={handleSaveLoad}
        />
      ) : null}
    </div>
  )
}
