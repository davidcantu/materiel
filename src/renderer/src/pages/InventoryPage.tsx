import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PartInfo, PartInput, PartStatus, PartType } from '../../../shared/parts'
import { PART_STATUSES, isWearStatusTracked, partTypeLabel } from '../../../shared/parts'
import {
  PLATFORMS,
  PLATFORM_LABELS,
  PLATFORM_PART_TYPES,
  type Platform
} from '../../../shared/platforms'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/icons/Icon'
import { PageFeedback } from '../components/PageFeedback'
import { PageHeader } from '../components/PageHeader'
import { PartFormModal } from '../components/PartFormModal'
import { StatusBadge } from '../components/StatusBadge'
import { useToast } from '../components/toast-context'
import {
  formatCurrency,
  isMaintenanceTracked,
  maintenancePercent,
  maintenanceTone,
  partPrimaryTitle,
  typeFilterLabel
} from '../lib/format'

const DEFAULT_STATUSES: PartStatus[] = ['In Stock', 'In Use']

type InventoryPageProps = {
  trackValue: boolean
  trackedPlatforms?: Platform[]
}

export function InventoryPage({
  trackValue,
  trackedPlatforms
}: InventoryPageProps): React.JSX.Element {
  const toast = useToast()
  const [parts, setParts] = useState<PartInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState<Platform | 'All'>('All')
  const [typeFilter, setTypeFilter] = useState<PartType | 'All'>('All')
  const [statuses, setStatuses] = useState<PartStatus[]>(DEFAULT_STATUSES)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PartInfo | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingPistolBuild, setPendingPistolBuild] = useState<PartInfo | null>(null)
  const [pistolBuildBusy, setPistolBuildBusy] = useState(false)

  const availablePlatforms = useMemo(
    () =>
      trackedPlatforms && trackedPlatforms.length > 0
        ? PLATFORMS.filter((p) => trackedPlatforms.includes(p))
        : [...PLATFORMS],
    [trackedPlatforms]
  )

  const categoryOptions = useMemo(() => {
    if (platformFilter === 'All') {
      const seen = new Set<PartType>()
      const types: PartType[] = []
      for (const platform of availablePlatforms) {
        for (const type of PLATFORM_PART_TYPES[platform]) {
          if (!seen.has(type)) {
            seen.add(type)
            types.push(type)
          }
        }
      }
      return types
    }
    return [...PLATFORM_PART_TYPES[platformFilter]]
  }, [platformFilter, availablePlatforms])

  const load = useCallback(async () => {
    setError(null)
    try {
      const rows = await window.api.listParts()
      setParts(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load parts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void window.api
      .listParts()
      .then((rows) => {
        if (!cancelled) {
          setParts(rows)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load parts')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeFilter !== 'All' && !categoryOptions.includes(typeFilter)) {
      setTypeFilter('All')
    }
  }, [categoryOptions, typeFilter])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const platformSet = new Set(availablePlatforms)
    return parts.filter((part) => {
      if (!part.platforms.some((p) => platformSet.has(p))) return false
      if (platformFilter !== 'All' && !part.platforms.includes(platformFilter)) return false
      if (typeFilter !== 'All' && part.type !== typeFilter) return false
      // Wear status filter applies only to barrels/triggers; sold items of any type respect Sold chip.
      if (part.status === 'Sold') {
        if (!statuses.includes('Sold')) return false
      } else if (isWearStatusTracked(part.type) && !statuses.includes(part.status)) {
        return false
      }
      if (!q) return true
      const hay = [
        part.name,
        part.manufacturer,
        part.model,
        part.caliber,
        part.serialNumber,
        part.soldToNote
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [parts, search, platformFilter, typeFilter, statuses, availablePlatforms])

  const selected = useMemo(
    () => (selectedId ? (parts.find((p) => p.id === selectedId) ?? null) : null),
    [parts, selectedId]
  )

  function toggleStatus(status: PartStatus): void {
    setStatuses((prev) => {
      if (prev.includes(status)) {
        if (prev.length === 1) return prev
        return prev.filter((s) => s !== status)
      }
      return [...prev, status]
    })
  }

  function openCreate(): void {
    setEditing(null)
    setModalOpen(true)
  }

  async function handleSave(input: PartInput): Promise<void> {
    if (editing) {
      await window.api.updatePart(editing.id, input)
      toast.success('Part updated.')
      await load()
      return
    }

    const created = await window.api.createPart(input)
    toast.success('Part added.')
    await load()
    setSelectedId(created.id)

    if (created.type === 'Pistol' && created.platforms.includes('pistol')) {
      setPendingPistolBuild(created)
    }
  }

  async function createPistolAsBuild(part: PartInfo): Promise<void> {
    setPistolBuildBusy(true)
    try {
      const name =
        [part.manufacturer, part.model].filter(Boolean).join(' ').trim() ||
        partPrimaryTitle(part) ||
        'Pistol'
      const result = await window.api.createCustomSystem({
        name,
        platform: 'pistol',
        actionId: part.id,
        barrelId: part.id,
        chassisId: part.id
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Pistol build created — you can log rounds against it.')
      setPendingPistolBuild(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create build')
    } finally {
      setPistolBuildBusy(false)
    }
  }

  async function handleDelete(part: PartInfo): Promise<void> {
    if (!window.confirm(`Delete ${partPrimaryTitle(part)}?`)) return
    try {
      await window.api.deletePart(part.id)
      toast.success('Part deleted.')
      if (selectedId === part.id) setSelectedId(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  async function handleMarkSold(part: PartInfo): Promise<void> {
    const note = window.prompt(
      'Sold to (optional note that stays with this item):',
      part.soldToNote ?? ''
    )
    if (note === null) return
    try {
      await window.api.setPartStatus(part.id, 'Sold', { soldToNote: note.trim() || null })
      toast.success('Marked as sold.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Status update failed')
    }
  }

  async function handleStatus(part: PartInfo, status: PartStatus): Promise<void> {
    try {
      await window.api.setPartStatus(part.id, status)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Status update failed')
    }
  }

  async function handleReset(part: PartInfo): Promise<void> {
    try {
      await window.api.resetPartMaintenance(part.id)
      toast.success('Maintenance reset.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Maintenance reset failed')
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Parts Inventory"
        description="Track components by platform and category. Wear status applies to barrels and triggers."
        actions={
          <button type="button" className="btn-primary btn-with-icon" onClick={openCreate}>
            <Icon name="add" size={16} />
            Add Part
          </button>
        }
      />

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search parts by manufacturer, model, or cartridge…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search parts"
        />
        <div className="chip-row" role="group" aria-label="Platform filter">
          {(['All', ...availablePlatforms] as const).map((platform) => (
            <button
              key={platform}
              type="button"
              className={`chip${platformFilter === platform ? ' active' : ''}`}
              onClick={() => setPlatformFilter(platform)}
            >
              {platform === 'All' ? 'All platforms' : PLATFORM_LABELS[platform]}
            </button>
          ))}
        </div>
        <div className="chip-row" role="group" aria-label="Category filter">
          {(['All', ...categoryOptions] as const).map((type) => (
            <button
              key={type}
              type="button"
              className={`chip${typeFilter === type ? ' active' : ''}`}
              onClick={() => setTypeFilter(type)}
            >
              {typeFilterLabel(type)}
            </button>
          ))}
        </div>
        <div className="chip-row" role="group" aria-label="Wear status filter">
          {PART_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={`chip${statuses.includes(status) ? ' active' : ''}`}
              onClick={() => toggleStatus(status)}
              title="Filters barrels and triggers; Sold also hides sold items of any type"
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <PageFeedback
        loading={loading}
        loadingLabel="Loading inventory…"
        error={error}
        onRetry={() => void load()}
      />

      {!loading && parts.length === 0 ? (
        <EmptyState
          icon="inventory"
          title="Your armory is empty"
          description="Add bolt-action, AR, or pistol parts to get started."
          actionLabel="Add your first part"
          onAction={openCreate}
        />
      ) : null}

      {!loading && parts.length > 0 && filtered.length === 0 ? (
        <EmptyState
          icon="filter"
          actionIcon="filter"
          title="No parts match the current filters"
          description="Clear search, platform, and status filters to see your full inventory."
          actionLabel="Clear filters"
          onAction={() => {
            setSearch('')
            setPlatformFilter('All')
            setTypeFilter('All')
            setStatuses(DEFAULT_STATUSES)
          }}
        />
      ) : null}

      {!loading && filtered.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Platform</th>
                <th>Part</th>
                <th>Maintenance</th>
                {trackValue ? <th>Value</th> : null}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((part) => {
                const percent = maintenancePercent(part)
                const isSelected = selectedId === part.id
                return (
                  <tr
                    key={part.id}
                    className={isSelected ? 'row-selected' : undefined}
                    onClick={() => setSelectedId(part.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className="type-pill">{partTypeLabel(part.type)}</span>
                    </td>
                    <td className="cell-meta">
                      {part.platforms.map((p) => PLATFORM_LABELS[p]).join(', ')}
                    </td>
                    <td>
                      <div className="cell-title">{partPrimaryTitle(part)}</div>
                      {part.serialNumber ? (
                        <div className="cell-sub">S/N {part.serialNumber}</div>
                      ) : null}
                      {part.status === 'Sold' ? (
                        <div className="cell-sub">Sold</div>
                      ) : isWearStatusTracked(part.type) ? (
                        <div className="cell-sub">{part.status}</div>
                      ) : null}
                    </td>
                    <td>
                      {percent != null ? (
                        <div className="maint-cell">
                          <div
                            className={`progress-track tone-${maintenanceTone(percent)}`}
                            title={`${percent}%`}
                          >
                            <div
                              className="progress-fill"
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                          </div>
                          <span className="muted">{percent}%</span>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    {trackValue ? <td>{formatCurrency(part.value)}</td> : null}
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => {
                            setEditing(part)
                            setModalOpen(true)
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => void handleDelete(part)}
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

      {selected ? (
        <article className="inventory-detail-card" aria-label="Part details">
          <header className="inventory-detail-header">
            <div>
              <h2>{partPrimaryTitle(selected)}</h2>
              <p className="muted">
                {partTypeLabel(selected.type)} ·{' '}
                {selected.platforms.map((p) => PLATFORM_LABELS[p]).join(', ')}
              </p>
            </div>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setSelectedId(null)}>
              Close
            </button>
          </header>

          <dl className="meta-list inventory-detail-meta">
            {selected.serialNumber ? (
              <div>
                <dt>Serial</dt>
                <dd>{selected.serialNumber}</dd>
              </div>
            ) : null}
            {selected.caliber ? (
              <div>
                <dt>Cartridge</dt>
                <dd>{selected.caliber}</dd>
              </div>
            ) : null}
            {isWearStatusTracked(selected.type) || selected.status === 'Sold' ? (
              <div>
                <dt>Status</dt>
                <dd>
                  {isWearStatusTracked(selected.type) ? (
                    <StatusBadge status={selected.status} />
                  ) : (
                    selected.status
                  )}
                </dd>
              </div>
            ) : null}
            {selected.soldToNote ? (
              <div>
                <dt>Sold to</dt>
                <dd>{selected.soldToNote}</dd>
              </div>
            ) : null}
            {isMaintenanceTracked(selected.type) ? (
              <div>
                <dt>Rounds</dt>
                <dd>{selected.totalRoundCount}</dd>
              </div>
            ) : null}
            {selected.type === 'Barrel' ? (
              <>
                <div>
                  <dt>Twist</dt>
                  <dd>1:{selected.twistRate ?? '—'}</dd>
                </div>
                <div>
                  <dt>Gunsmith</dt>
                  <dd>{selected.gunsmith || '—'}</dd>
                </div>
              </>
            ) : null}
            {selected.type === 'Suppressor' ? (
              <div>
                <dt>Muzzle</dt>
                <dd>{selected.muzzleType ?? '—'}</dd>
              </div>
            ) : null}
            {trackValue ? (
              <div>
                <dt>Value</dt>
                <dd>{formatCurrency(selected.value)}</dd>
              </div>
            ) : null}
            {selected.notes ? (
              <div>
                <dt>Notes</dt>
                <dd>{selected.notes}</dd>
              </div>
            ) : null}
          </dl>

          <div className="row-actions inventory-detail-actions">
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => {
                setEditing(selected)
                setModalOpen(true)
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => void handleDelete(selected)}
            >
              Delete
            </button>
            {selected.status !== 'Sold' ? (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => void handleMarkSold(selected)}
              >
                Mark as Sold
              </button>
            ) : (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => void handleStatus(selected, 'In Stock')}
              >
                Return to stock
              </button>
            )}
            {isWearStatusTracked(selected.type) &&
            selected.status !== 'Retired' &&
            selected.status !== 'Sold' ? (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => void handleStatus(selected, 'Retired')}
              >
                Retire
              </button>
            ) : null}
            {isWearStatusTracked(selected.type) && selected.status === 'Retired' ? (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => void handleStatus(selected, 'In Stock')}
              >
                Return to stock
              </button>
            ) : null}
            {maintenancePercent(selected) != null ? (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => void handleReset(selected)}
              >
                Reset maintenance
              </button>
            ) : null}
          </div>
        </article>
      ) : null}

      {pendingPistolBuild ? (
        <div className="inventory-pistol-prompt" role="dialog" aria-label="Create pistol build">
          <div className="inventory-pistol-prompt-card">
            <h3>Shoot without accessories?</h3>
            <p>
              Many pistol shooters don’t add optics or lights. Create{' '}
              <strong>{partPrimaryTitle(pendingPistolBuild)}</strong> as a build now so you can log
              rounds against it?
            </p>
            <div className="row-actions">
              <button
                type="button"
                className="btn-ghost"
                disabled={pistolBuildBusy}
                onClick={() => setPendingPistolBuild(null)}
              >
                Not now
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={pistolBuildBusy}
                onClick={() => void createPistolAsBuild(pendingPistolBuild)}
              >
                {pistolBuildBusy ? 'Creating…' : 'Create as build'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <PartFormModal
          trackValue={trackValue}
          initial={editing}
          defaultPlatforms={
            platformFilter === 'All' ? availablePlatforms : [platformFilter]
          }
          lockPlatforms={
            availablePlatforms.length < PLATFORMS.length ? availablePlatforms : undefined
          }
          onClose={() => {
            setModalOpen(false)
            setEditing(null)
          }}
          onSave={handleSave}
        />
      ) : null}
    </div>
  )
}
