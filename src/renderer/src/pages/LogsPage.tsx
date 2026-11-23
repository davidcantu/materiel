import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AmmoInventoryInfo } from '../../../shared/ammo'
import type { LoadDevelopmentInfo } from '../../../shared/loads'
import type { PartInfo } from '../../../shared/parts'
import type {
  LogsTimeRange,
  NewShootingLogInputInfo,
  SessionType,
  ShootingLogInfo
} from '../../../shared/shooting-logs'
import { formatPercentOfWinner, formatPlacement } from '../../../shared/shooting-logs'
import type { CompleteSystemInfo } from '../../../shared/systems'
import { systemHasDueMaintenance } from '../../../shared/system-maintenance'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/icons/Icon'
import { LogSessionModal } from '../components/LogSessionModal'
import { MaintenanceDueModal } from '../components/MaintenanceDueModal'
import { PageFeedback } from '../components/PageFeedback'
import { PageHeader } from '../components/PageHeader'
import { useToast } from '../components/toast-context'
import { partPrimaryTitle } from '../lib/format'

type LogsPageProps = {
  onNavigateBuilds?: () => void
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatLogDate(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function cartridgeLabel(log: ShootingLogInfo, ammoById: Map<string, AmmoInventoryInfo>): string {
  if (log.cartridge?.trim()) return log.cartridge
  if (log.ammoId) {
    const ammo = ammoById.get(log.ammoId)
    if (ammo?.name) return ammo.name
  }
  return 'Manual entry'
}

export function LogsPage({ onNavigateBuilds }: LogsPageProps = {}): React.JSX.Element {
  const toast = useToast()
  const [logs, setLogs] = useState<ShootingLogInfo[]>([])
  const [systems, setSystems] = useState<CompleteSystemInfo[]>([])
  const [parts, setParts] = useState<PartInfo[]>([])
  const [ammo, setAmmo] = useState<AmmoInventoryInfo[]>([])
  const [loads, setLoads] = useState<LoadDevelopmentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [systemFilter, setSystemFilter] = useState<string>('All')
  const [sessionFilter, setSessionFilter] = useState<SessionType | 'All'>('All')
  const [timeRange, setTimeRange] = useState<LogsTimeRange>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ShootingLogInfo | null>(null)
  const [maintenanceSystemId, setMaintenanceSystemId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(10)

  const systemsById = useMemo(() => {
    const map = new Map<string, CompleteSystemInfo>()
    for (const system of systems) map.set(system.id, system)
    return map
  }, [systems])

  const ammoById = useMemo(() => {
    const map = new Map<string, AmmoInventoryInfo>()
    for (const item of ammo) map.set(item.id, item)
    return map
  }, [ammo])

  const partsById = useMemo(() => {
    const map = new Map<string, PartInfo>()
    for (const part of parts) map.set(part.id, part)
    return map
  }, [parts])

  const load = useCallback(async () => {
    setError(null)
    try {
      const [nextLogs, nextSystems, nextParts, nextAmmo, nextLoads] = await Promise.all([
        window.api.listLogs(),
        window.api.listSystems(),
        window.api.listParts(),
        window.api.listAmmo(),
        window.api.listLoads()
      ])
      setLogs(nextLogs)
      setSystems(nextSystems)
      setParts(nextParts)
      setAmmo(nextAmmo)
      setLoads(nextLoads)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shooting logs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      window.api.listLogs(),
      window.api.listSystems(),
      window.api.listParts(),
      window.api.listAmmo(),
      window.api.listLoads()
    ])
      .then(([nextLogs, nextSystems, nextParts, nextAmmo, nextLoads]) => {
        if (!cancelled) {
          setLogs(nextLogs)
          setSystems(nextSystems)
          setParts(nextParts)
          setAmmo(nextAmmo)
          setLoads(nextLoads)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load shooting logs')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const minDate =
      timeRange === 'year' ? daysAgoIso(365) : timeRange === 'month' ? daysAgoIso(30) : null

    return logs.filter((log) => {
      if (systemFilter !== 'All' && log.systemId !== systemFilter) return false
      if (sessionFilter !== 'All' && log.sessionType !== sessionFilter) return false
      if (minDate && log.date.slice(0, 10) < minDate) return false

      if (!q) return true
      const systemName = log.systemId
        ? (systemsById.get(log.systemId)?.name ?? '')
        : 'Former build'
      const cartridge = cartridgeLabel(log, ammoById)
      const hay = [systemName, log.location, cartridge, log.notes, log.sessionType]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [logs, search, systemFilter, sessionFilter, timeRange, systemsById, ammoById])

  useEffect(() => {
    setVisibleCount(10)
  }, [search, systemFilter, sessionFilter, timeRange])

  const visibleLogs = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])
  const hasMore = filtered.length > visibleCount

  function openCreate(): void {
    setEditing(null)
    setModalOpen(true)
  }

  async function handleSave(input: NewShootingLogInputInfo, editingId?: string): Promise<void> {
    if (editingId) {
      await window.api.updateLog({ id: editingId, ...input })
      toast.success('Session updated.')
    } else {
      await window.api.addLog(input)
      toast.success('Session logged.')
    }
    await load()

    // After a new session, scope due maintenance to that firearm (no system picker).
    if (!editingId) {
      const system = systemsById.get(input.systemId)
      if (system) {
        const nextParts = await window.api.listParts()
        setParts(nextParts)
        const nextById = new Map(nextParts.map((part) => [part.id, part]))
        if (systemHasDueMaintenance(system, nextById)) {
          setMaintenanceSystemId(system.id)
        }
      }
    }
  }

  async function handleMaintenanceReset(partId: string): Promise<void> {
    try {
      await window.api.resetPartMaintenance(partId)
      toast.success('Maintenance reset.')
      const nextParts = await window.api.listParts()
      setParts(nextParts)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Maintenance reset failed')
    }
  }

  async function handleDelete(log: ShootingLogInfo): Promise<void> {
    const systemName = log.systemId
      ? (systemsById.get(log.systemId)?.name ?? 'session')
      : 'Former build'
    if (!window.confirm(`Delete log for “${systemName}” on ${formatLogDate(log.date)}?`)) {
      return
    }
    try {
      await window.api.deleteLog(log.id)
      toast.success('Session deleted.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Shooting Logs"
        description="Record Practice And Match Sessions; Rounds Update Builds And Ammo."
        actions={
          <button type="button" className="btn-primary btn-with-icon" onClick={openCreate}>
            <Icon name="add" size={16} />
            Log Session
          </button>
        }
      />

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search logs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search logs"
        />
        <div className="toolbar-filters">
          <label className="filter-select">
            <span className="field-label">System</span>
            <select value={systemFilter} onChange={(e) => setSystemFilter(e.target.value)}>
              <option value="All">All systems</option>
              {systems.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.name}
                </option>
              ))}
            </select>
          </label>
          <div className="chip-row" role="group" aria-label="Session type filter">
            {(['All', 'Practice', 'Match'] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={`chip${sessionFilter === type ? ' active' : ''}`}
                onClick={() => setSessionFilter(type)}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="chip-row" role="group" aria-label="Time range">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'year', label: 'Year' },
                { id: 'month', label: 'Month' }
              ] as const
            ).map((range) => (
              <button
                key={range.id}
                type="button"
                className={`chip${timeRange === range.id ? ' active' : ''}`}
                onClick={() => setTimeRange(range.id)}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <PageFeedback
        loading={loading}
        loadingLabel="Loading logs…"
        error={error}
        onRetry={() => void load()}
      />

      {!loading && systems.length === 0 ? (
        <EmptyState
          icon="builds"
          title="No complete firearms yet"
          description="Add a complete build before you can log practice or match sessions."
          actionLabel="Add your first complete build"
          onAction={() => onNavigateBuilds?.()}
        />
      ) : null}

      {!loading && systems.length > 0 && logs.length === 0 ? (
        <EmptyState
          icon="logs"
          title="No shooting logs yet"
          description="Log your first practice or match session to start tracking rounds."
          actionLabel="Log first session"
          onAction={openCreate}
        />
      ) : null}

      {!loading && logs.length > 0 && filtered.length === 0 ? (
        <EmptyState
          icon="filter"
          actionIcon="filter"
          title="No shooting logs found for this period"
          description="Clear filters to see every logged session."
          actionLabel="Clear filters"
          onAction={() => {
            setSearch('')
            setSystemFilter('All')
            setSessionFilter('All')
            setTimeRange('all')
            setVisibleCount(10)
          }}
        />
      ) : null}

      {!loading && filtered.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Barrel</th>
                  <th>Location</th>
                  <th>Rounds</th>
                  <th>Cartridge</th>
                  <th>Place</th>
                  <th>% Of Winner</th>
                  <th>Velocity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleLogs.map((log) => {
                  const barrel = log.barrelId ? partsById.get(log.barrelId) : undefined
                  return (
                    <tr key={log.id}>
                      <td>
                        <div className="cell-title">{formatLogDate(log.date)}</div>
                        <div className="cell-sub">{log.sessionType}</div>
                      </td>
                      <td>
                        {barrel ? partPrimaryTitle(barrel) : '—'}
                      </td>
                      <td>{log.location}</td>
                      <td>
                        <span className="rounds-badge">{log.roundsFired}</span>
                      </td>
                      <td>{cartridgeLabel(log, ammoById)}</td>
                      <td>
                        {log.sessionType === 'Match' && log.placement != null
                          ? formatPlacement(log.placement)
                          : '—'}
                      </td>
                      <td>
                        {log.sessionType === 'Match' && log.percentOfWinner != null
                          ? formatPercentOfWinner(log.percentOfWinner)
                          : '—'}
                      </td>
                      <td>{log.velocity != null ? `${log.velocity} fps` : '—'}</td>
                      <td>
                        <div className="row-actions">
                          {log.systemId ? (
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              onClick={() => {
                                setEditing(log)
                                setModalOpen(true)
                              }}
                            >
                              Edit
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn-ghost btn-sm"
                            onClick={() => void handleDelete(log)}
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
          {hasMore ? (
            <div className="see-more-row">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setVisibleCount((n) => n + 10)}
              >
                See More
              </button>
              <span className="muted">
                Showing {visibleLogs.length} of {filtered.length}
              </span>
            </div>
          ) : null}
        </>
      ) : null}

      {modalOpen ? (
        <LogSessionModal
          systems={systems}
          parts={parts}
          ammo={ammo}
          logs={logs}
          loads={loads}
          initial={editing}
          onClose={() => {
            setModalOpen(false)
            setEditing(null)
          }}
          onSave={handleSave}
          onAmmoChanged={() => {
            void window.api.listAmmo().then(setAmmo)
          }}
          onNavigateBuilds={onNavigateBuilds}
        />
      ) : null}

      {maintenanceSystemId && systemsById.get(maintenanceSystemId) ? (
        <MaintenanceDueModal
          system={systemsById.get(maintenanceSystemId)!}
          parts={parts}
          afterLog
          onClose={() => setMaintenanceSystemId(null)}
          onReset={handleMaintenanceReset}
        />
      ) : null}
    </div>
  )
}
