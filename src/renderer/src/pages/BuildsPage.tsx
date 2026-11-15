import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PartInfo } from '../../../shared/parts'
import type { CompleteSystemInfo } from '../../../shared/systems'
import type { LicenseGateDenial, LicenseStatusInfo } from '../../../shared/license'
import { EmptyState } from '../components/EmptyState'
import { SystemFormModal } from '../components/SystemFormModal'
import { formatCurrency, maintenancePercent, partPrimaryTitle } from '../lib/format'

type BuildsPageProps = {
  trackValue: boolean
  license: LicenseStatusInfo | null
  onLicenseChange: () => void
}

export function BuildsPage({
  trackValue,
  license,
  onLicenseChange
}: BuildsPageProps): React.JSX.Element {
  const [systems, setSystems] = useState<CompleteSystemInfo[]>([])
  const [parts, setParts] = useState<PartInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [licenseBanner, setLicenseBanner] = useState<LicenseGateDenial | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CompleteSystemInfo | null>(null)

  const partsById = useMemo(() => {
    const map = new Map<string, PartInfo>()
    for (const part of parts) map.set(part.id, part)
    return map
  }, [parts])

  const load = useCallback(async () => {
    setError(null)
    try {
      const [nextSystems, nextParts] = await Promise.all([
        window.api.listSystems(),
        window.api.listParts()
      ])
      setSystems(nextSystems)
      setParts(nextParts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load builds')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.all([window.api.listSystems(), window.api.listParts()])
      .then(([nextSystems, nextParts]) => {
        if (!cancelled) {
          setSystems(nextSystems)
          setParts(nextParts)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load builds')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  function openCreate(): void {
    setLicenseBanner(null)
    if (license && !license.canCreateRifle) {
      setLicenseBanner({
        code: 'LICENSE_RIFLE_LIMIT',
        message:
          license.blockReason ??
          `Free tier allows ${license.freeRifleLimit} complete rifles. Activate a license to add more.`,
        license
      })
      return
    }
    setEditing(null)
    setModalOpen(true)
  }

  async function handleCreateCustom(
    input: Parameters<typeof window.api.createCustomSystem>[0]
  ): Promise<void> {
    const result = await window.api.createCustomSystem(input)
    if (!result.ok) {
      setLicenseBanner(result.error)
      onLicenseChange()
      throw new Error(result.error.message)
    }
    onLicenseChange()
    await load()
  }

  async function handleCreateFactory(
    input: Parameters<typeof window.api.createFactorySystem>[0]
  ): Promise<void> {
    const result = await window.api.createFactorySystem(input)
    if (!result.ok) {
      setLicenseBanner(result.error)
      onLicenseChange()
      throw new Error(result.error.message)
    }
    onLicenseChange()
    await load()
  }

  async function handleUpdate(
    id: string,
    patch: Parameters<typeof window.api.updateSystem>[1]
  ): Promise<void> {
    await window.api.updateSystem(id, patch)
    await load()
  }

  async function handleDelete(system: CompleteSystemInfo): Promise<void> {
    if (!window.confirm(`Delete build “${system.name}”? Assigned parts return to In Stock.`)) {
      return
    }
    try {
      await window.api.deleteSystem(system.id)
      onLicenseChange()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Complete Builds</h1>
          <p>Assemble custom or factory rifles from your inventory.</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          + New Build
        </button>
      </header>

      {licenseBanner ? (
        <div className="banner banner-warn" role="alert">
          <strong>{licenseBanner.code}</strong>
          <p>{licenseBanner.message}</p>
          <p className="muted">
            Using {licenseBanner.license.completeRifleCount} of{' '}
            {licenseBanner.license.freeRifleLimit} free rifles
            {licenseBanner.license.mode === 'unlocked' ? ' (dev unlocked)' : ''}.
          </p>
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      {loading ? (
        <p className="muted">Loading builds…</p>
      ) : systems.length === 0 ? (
        <EmptyState
          title="No Complete Systems"
          description="Build your first rifle from parts in stock, or add a factory rifle."
          actionLabel="Build Your First Rifle"
          onAction={openCreate}
        />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Build</th>
                <th>Type</th>
                <th>Components</th>
                <th>Barrel rounds</th>
                <th>Maintenance</th>
                {trackValue ? <th>Value</th> : null}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {systems.map((system) => {
                const barrel = partsById.get(system.barrelId)
                const action = partsById.get(system.actionId)
                const chassis = partsById.get(system.chassisId)
                const optic = system.opticId ? partsById.get(system.opticId) : undefined
                const muzzle = system.suppressorId ? partsById.get(system.suppressorId) : undefined
                const caliber =
                  system.buildType === 'factory' ? system.factoryCartridge : barrel?.caliber
                const maint = barrel ? maintenancePercent(barrel) : null
                const valueParts = [
                  action,
                  barrel,
                  chassis,
                  optic,
                  muzzle,
                  ...system.miscPartIds.map((id) => partsById.get(id))
                ].filter(Boolean) as PartInfo[]
                const totalValue = valueParts.reduce((sum, part) => sum + part.value, 0)

                return (
                  <tr key={system.id}>
                    <td>
                      <div className="cell-title">{system.name}</div>
                      <div className="cell-sub">{caliber ?? 'No Caliber Set'}</div>
                    </td>
                    <td>
                      <span className="type-pill">
                        {system.buildType === 'factory' ? 'Factory' : 'Custom'}
                      </span>
                    </td>
                    <td className="cell-meta">
                      {action ? <div>Action: {partPrimaryTitle(action)}</div> : null}
                      {barrel ? <div>Barrel: {partPrimaryTitle(barrel)}</div> : null}
                      {chassis ? <div>Chassis: {partPrimaryTitle(chassis)}</div> : null}
                      {optic ? <div>Optic: {partPrimaryTitle(optic)}</div> : null}
                      {muzzle ? <div>Muzzle: {partPrimaryTitle(muzzle)}</div> : null}
                      {system.miscPartIds.length > 0 ? (
                        <div>Misc: {system.miscPartIds.length}</div>
                      ) : null}
                    </td>
                    <td>{barrel?.totalRoundCount ?? 0}</td>
                    <td>{maint != null ? `${maint}%` : '—'}</td>
                    {trackValue ? <td>{formatCurrency(totalValue)}</td> : null}
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => {
                            setLicenseBanner(null)
                            setEditing(system)
                            setModalOpen(true)
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => void handleDelete(system)}
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
      )}

      {modalOpen ? (
        <SystemFormModal
          parts={parts}
          initial={editing}
          onClose={() => {
            setModalOpen(false)
            setEditing(null)
          }}
          onCreateCustom={handleCreateCustom}
          onCreateFactory={handleCreateFactory}
          onUpdate={handleUpdate}
        />
      ) : null}
    </div>
  )
}
