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
}

export function InventoryPage({ trackValue }: InventoryPageProps): React.JSX.Element {
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

  const categoryOptions = useMemo(() => {
    if (platformFilter === 'All') {
      const seen = new Set<PartType>()
      const types: PartType[] = []
      for (const platform of PLATFORMS) {
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
  }, [platformFilter])

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
    return parts.filter((part) => {
      if (platformFilter !== 'All' && !part.platforms.includes(platformFilter)) return false
      if (typeFilter !== 'All' && part.type !== typeFilter) return false
      // Wear status filter applies only to barrels/triggers; other parts always pass.
      if (isWearStatusTracked(part.type) && !statuses.includes(part.status)) return false
      if (!q) return true
      const hay = [part.manufacturer, part.model, part.caliber, part.serialNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [parts, search, platformFilter, typeFilter, statuses])

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
    } else {
      await window.api.createPart(input)
      toast.success('Part added.')
    }
    await load()
  }

  async function handleDelete(part: PartInfo): Promise<void> {
    if (!window.confirm(`Delete ${partPrimaryTitle(part)}?`)) return
    try {
      await window.api.deletePart(part.id)
      toast.success('Part deleted.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
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
          {(['All', ...PLATFORMS] as const).map((platform) => (
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
              title="Filters barrels and triggers only"
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
                <th>Details</th>
                <th>Status</th>
                <th>Maintenance</th>
                {trackValue ? <th>Value</th> : null}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((part) => {
                const percent = maintenancePercent(part)
                return (
                  <tr key={part.id}>
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
                    </td>
                    <td className="cell-meta">
                      {isMaintenanceTracked(part.type) ? (
                        <div>Rounds: {part.totalRoundCount}</div>
                      ) : null}
                      {part.type === 'Barrel' ? (
                        <>
                          <div>Twist 1:{part.twistRate ?? '—'}</div>
                          <div>{part.gunsmith}</div>
                        </>
                      ) : null}
                      {part.type === 'Suppressor' ? <div>{part.muzzleType}</div> : null}
                    </td>
                    <td>
                      {isWearStatusTracked(part.type) ? (
                        <StatusBadge status={part.status} />
                      ) : (
                        <span className="muted">—</span>
                      )}
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
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => void handleReset(part)}
                          >
                            Reset
                          </button>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    {trackValue ? <td>{formatCurrency(part.value)}</td> : null}
                    <td>
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
                        {isWearStatusTracked(part.type) && part.status !== 'Sold' ? (
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => void handleStatus(part, 'Sold')}
                          >
                            Mark sold
                          </button>
                        ) : null}
                        {isWearStatusTracked(part.type) && part.status !== 'Retired' ? (
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => void handleStatus(part, 'Retired')}
                          >
                            Retire
                          </button>
                        ) : null}
                        {isWearStatusTracked(part.type) &&
                        (part.status === 'Sold' || part.status === 'Retired') ? (
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => void handleStatus(part, 'In Stock')}
                          >
                            Return to stock
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {modalOpen ? (
        <PartFormModal
          trackValue={trackValue}
          initial={editing}
          defaultPlatforms={platformFilter === 'All' ? undefined : [platformFilter]}
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
