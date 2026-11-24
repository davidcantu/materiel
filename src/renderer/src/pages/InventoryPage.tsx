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
  isMaintenanceTracked,
  maintenanceLabel,
  maintenancePercent,
  maintenanceTone,
  partPrimaryTitle,
  typeFilterLabel
} from '../lib/format'

const DEFAULT_STATUSES: PartStatus[] = ['In Stock', 'In Use']

/** Always-visible category chips (plus All). Remaining types live under +. */
const PRIMARY_TYPE_CHIPS: PartType[] = ['Action', 'Barrel', 'Chassis', 'Pistol', 'Optic', 'Misc']

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
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)
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

  const primaryTypeChips = useMemo(
    () => PRIMARY_TYPE_CHIPS.filter((t) => categoryOptions.includes(t)),
    [categoryOptions]
  )
  const extraTypeChips = useMemo(
    () => categoryOptions.filter((t) => !PRIMARY_TYPE_CHIPS.includes(t)),
    [categoryOptions]
  )

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
      await window.api.createCustomSystem({
        name,
        platform: 'pistol',
        actionId: part.id,
        barrelId: part.id,
        chassisId: part.id
      })
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
    if (
      !window.confirm(
        `Delete ${partPrimaryTitle(part)}? Session logs that used this part stay on file.`
      )
    ) {
      return
    }
    try {
      await window.api.deletePart(part.id)
      const snapshot = part
      toast.success('Part deleted.', {
        action: {
          label: 'Undo',
          onClick: () => {
            void (async () => {
              try {
                await window.api.createPart({
                  id: snapshot.id,
                  type: snapshot.type,
                  manufacturer: snapshot.manufacturer,
                  model: snapshot.model,
                  name: snapshot.name,
                  caliber: snapshot.caliber,
                  gunsmith: snapshot.gunsmith,
                  serialNumber: snapshot.serialNumber,
                  platforms: snapshot.platforms,
                  totalRoundCount: snapshot.totalRoundCount,
                  roundsAfterCleaning: snapshot.roundsAfterCleaning,
                  maintenanceInterval: snapshot.maintenanceInterval,
                  twistRate: snapshot.twistRate,
                  barrelLife: snapshot.barrelLife,
                  muzzleType: snapshot.muzzleType,
                  value: snapshot.value,
                  notes: snapshot.notes,
                  status: snapshot.status,
                  soldToNote: snapshot.soldToNote
                })
                toast.success('Part restored.')
                await load()
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Undo failed')
              }
            })()
          }
        }
      })
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  async function handleReset(part: PartInfo): Promise<void> {
    try {
      await window.api.resetPartMaintenance(part.id)
      toast.success('Maintenance performed — counter reset.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Maintenance reset failed')
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Parts Inventory"
        description="Track Components By Platform And Category. Wear Status Applies To Barrels And Triggers."
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
          placeholder="Search Parts By Manufacturer, Model, Or Cartridge…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search Parts"
        />
        <div className="chip-row" role="group" aria-label="Platform Filter">
          {(['All', ...availablePlatforms] as const).map((platform) => (
            <button
              key={platform}
              type="button"
              className={`chip${platformFilter === platform ? ' active' : ''}`}
              onClick={() => setPlatformFilter(platform)}
            >
              {platform === 'All' ? 'All Platforms' : PLATFORM_LABELS[platform]}
            </button>
          ))}
        </div>
        <div className="chip-row" role="group" aria-label="Category Filter">
          <button
            type="button"
            className={`chip${typeFilter === 'All' ? ' active' : ''}`}
            onClick={() => setTypeFilter('All')}
          >
            All
          </button>
          {primaryTypeChips.map((type) => (
            <button
              key={type}
              type="button"
              className={`chip${typeFilter === type ? ' active' : ''}`}
              onClick={() => setTypeFilter(type)}
            >
              {typeFilterLabel(type)}
            </button>
          ))}
          {extraTypeChips.length > 0 ? (
            <div className="type-chip-more">
              <button
                type="button"
                className={`chip${extraTypeChips.includes(typeFilter as PartType) ? ' active' : ''}`}
                aria-expanded={typeMenuOpen}
                aria-haspopup="menu"
                onClick={() => setTypeMenuOpen((open) => !open)}
              >
                +
              </button>
              {typeMenuOpen ? (
                <div className="type-chip-menu" role="menu">
                  {extraTypeChips.map((type) => (
                    <button
                      key={type}
                      type="button"
                      role="menuitem"
                      className={`chip${typeFilter === type ? ' active' : ''}`}
                      onClick={() => {
                        setTypeFilter(type)
                        setTypeMenuOpen(false)
                      }}
                    >
                      {typeFilterLabel(type)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="chip-row" role="group" aria-label="Wear Status Filter">
          {PART_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={`chip${statuses.includes(status) ? ' active' : ''}`}
              onClick={() => toggleStatus(status)}
              title="Filters Barrels And Triggers; Sold Also Hides Sold Items Of Any Type"
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
          description="Start with a Frame, Action, or Barrel — then assemble a build and log your first session."
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
                <th>Part</th>
                <th>Rounds</th>
                <th>Maintenance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((part) => {
                const percent = maintenancePercent(part)
                const tracksUse = isMaintenanceTracked(part.type) || part.type === 'Lower'
                return (
                  <tr
                    key={part.id}
                    onClick={() => {
                      setEditing(part)
                      setModalOpen(true)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className="type-pill">{partTypeLabel(part.type)}</span>
                    </td>
                    <td>
                      <div className="cell-title">{partPrimaryTitle(part)}</div>
                      {part.type === 'Pistol' || part.type === 'Frame' || part.type === 'Barrel'
                        ? part.caliber
                          ? (
                              <div className="cell-sub">{part.caliber}</div>
                            )
                          : null
                        : null}
                      {part.serialNumber ? (
                        <div className="cell-sub">S/N {part.serialNumber}</div>
                      ) : null}
                    </td>
                    <td className="rounds-cell">
                      {tracksUse ? (
                        <span className="rounds-badge">{part.totalRoundCount.toLocaleString()}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {percent != null ? (
                        <div className="maint-cell">
                          <div
                            className={`progress-track tone-${maintenanceTone(percent)}`}
                            title={`${maintenanceLabel(part)} · ${percent}%`}
                          >
                            <div
                              className="progress-fill"
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                          </div>
                          <span className="muted">
                            {maintenanceLabel(part)} · {percent}%
                          </span>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {isWearStatusTracked(part.type) || part.status === 'Sold' ? (
                        <StatusBadge status={part.status} />
                      ) : (
                        <span className="muted">{part.status}</span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        {isMaintenanceTracked(part.type) ? (
                          <button
                            type="button"
                            className="btn-ghost btn-sm"
                            onClick={() => void handleReset(part)}
                          >
                            Maintenance Performed
                          </button>
                        ) : null}
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
