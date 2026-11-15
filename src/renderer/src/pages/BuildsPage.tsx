import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PartInfo } from '../../../shared/parts'
import type { CompleteSystemInfo } from '../../../shared/systems'
import type { LicenseGateDenial, LicenseStatusInfo } from '../../../shared/license'
import { PLATFORM_CORE_LABELS, PLATFORM_LABELS } from '../../../shared/platforms'
import { EmptyState } from '../components/EmptyState'
import { MaintenanceDueModal } from '../components/MaintenanceDueModal'
import { PageFeedback } from '../components/PageFeedback'
import { PageHeader } from '../components/PageHeader'
import { SystemFormModal } from '../components/SystemFormModal'
import { useToast } from '../components/toast-context'
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
  const toast = useToast()
  const [systems, setSystems] = useState<CompleteSystemInfo[]>([])
  const [parts, setParts] = useState<PartInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [licenseBanner, setLicenseBanner] = useState<LicenseGateDenial | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CompleteSystemInfo | null>(null)
  const [maintenanceSystem, setMaintenanceSystem] = useState<CompleteSystemInfo | null>(null)

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
          `Free tier allows ${license.freeRifleLimit} complete firearms. Activate a license to add more.`,
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
      toast.error(result.error.message)
      throw new Error(result.error.message)
    }
    onLicenseChange()
    toast.success('Build created.')
    await load()
  }

  async function handleCreateFactory(
    input: Parameters<typeof window.api.createFactorySystem>[0]
  ): Promise<void> {
    const result = await window.api.createFactorySystem(input)
    if (!result.ok) {
      setLicenseBanner(result.error)
      onLicenseChange()
      toast.error(result.error.message)
      throw new Error(result.error.message)
    }
    onLicenseChange()
    toast.success('Factory firearm created.')
    await load()
  }

  async function handleUpdate(
    id: string,
    patch: Parameters<typeof window.api.updateSystem>[1]
  ): Promise<void> {
    await window.api.updateSystem(id, patch)
    toast.success('Build updated.')
    await load()
  }

  async function handleDelete(system: CompleteSystemInfo): Promise<void> {
    if (!window.confirm(`Delete build “${system.name}”? Assigned parts return to In Stock.`)) {
      return
    }
    try {
      await window.api.deleteSystem(system.id)
      onLicenseChange()
      toast.success('Build deleted.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  async function handleMaintenanceReset(partId: string): Promise<void> {
    try {
      await window.api.resetPartMaintenance(partId)
      toast.success('Maintenance reset.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Maintenance reset failed')
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Complete Builds"
        description="Assemble bolt-action, AR-pattern, or pistol systems from compatible inventory."
        actions={
          <button type="button" className="btn-primary" onClick={openCreate}>
            + New Build
          </button>
        }
      />

      {licenseBanner ? (
        <div className="banner banner-warn" role="alert">
          <strong>Firearm limit reached</strong>
          <p>{licenseBanner.message}</p>
          <p className="muted">
            Using {licenseBanner.license.completeRifleCount} of{' '}
            {licenseBanner.license.freeRifleLimit} free firearms
            {licenseBanner.license.mode === 'unlocked' ? ' (dev unlocked)' : ''}.
          </p>
        </div>
      ) : null}

      <PageFeedback
        loading={loading}
        loadingLabel="Loading builds…"
        error={error}
        onRetry={() => void load()}
      />

      {!loading && systems.length === 0 ? (
        <EmptyState
          title="No complete firearms yet"
          description="Assemble a custom build from inventory parts, or add a factory firearm."
          actionLabel="Add your first complete build"
          onAction={openCreate}
        />
      ) : null}

      {!loading && systems.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Build</th>
                <th>Platform</th>
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
                const labels = PLATFORM_CORE_LABELS[system.platform]
                const barrel = partsById.get(system.barrelId)
                const action = partsById.get(system.actionId)
                const chassis = partsById.get(system.chassisId)
                const optic = system.opticId ? partsById.get(system.opticId) : undefined
                const muzzle = system.suppressorId ? partsById.get(system.suppressorId) : undefined
                const laser = system.laserIrId ? partsById.get(system.laserIrId) : undefined
                const light = system.lightId ? partsById.get(system.lightId) : undefined
                const caliber =
                  system.buildType === 'factory' ? system.factoryCartridge : barrel?.caliber
                const maint = barrel ? maintenancePercent(barrel) : null
                const valueParts = [
                  action,
                  barrel,
                  chassis,
                  optic,
                  muzzle,
                  laser,
                  light,
                  ...system.miscPartIds.map((id) => partsById.get(id))
                ].filter(Boolean) as PartInfo[]
                const totalValue = valueParts.reduce((sum, part) => sum + part.value, 0)

                return (
                  <tr key={system.id}>
                    <td>
                      <div className="build-name-cell">
                        {system.imageUrl ? (
                          <div className="build-thumb" aria-hidden="true">
                            <img src={system.imageUrl} alt="" />
                          </div>
                        ) : (
                          <div className="build-thumb build-thumb-empty" aria-hidden="true" />
                        )}
                        <div>
                          <div className="cell-title">{system.name}</div>
                          <div className="cell-sub">{caliber ?? 'No cartridge set'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="type-pill">{PLATFORM_LABELS[system.platform]}</span>
                    </td>
                    <td>
                      <span className="type-pill">
                        {system.buildType === 'factory' ? 'Factory' : 'Custom'}
                      </span>
                    </td>
                    <td className="cell-meta">
                      {action ? (
                        <div>
                          {labels.primary}: {partPrimaryTitle(action)}
                        </div>
                      ) : null}
                      {barrel ? (
                        <div>
                          {labels.barrel}: {partPrimaryTitle(barrel)}
                        </div>
                      ) : null}
                      {chassis ? (
                        <div>
                          {labels.furniture}: {partPrimaryTitle(chassis)}
                        </div>
                      ) : null}
                      {optic ? <div>Optic: {partPrimaryTitle(optic)}</div> : null}
                      {laser ? <div>Laser/IR: {partPrimaryTitle(laser)}</div> : null}
                      {light ? <div>Light: {partPrimaryTitle(light)}</div> : null}
                      {muzzle ? <div>Muzzle: {partPrimaryTitle(muzzle)}</div> : null}
                      {system.miscPartIds.length > 0 ? (
                        <div>Accessories: {system.miscPartIds.length}</div>
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
                          onClick={() => setMaintenanceSystem(system)}
                        >
                          Maintenance
                        </button>
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
      ) : null}

      {modalOpen ? (
        <SystemFormModal
          parts={parts}
          trackValue={trackValue}
          initial={editing}
          onClose={() => {
            setModalOpen(false)
            setEditing(null)
          }}
          onCreateCustom={handleCreateCustom}
          onCreateFactory={handleCreateFactory}
          onUpdate={handleUpdate}
          onPartsChanged={() => {
            void window.api.listParts().then(setParts)
          }}
        />
      ) : null}

      {maintenanceSystem ? (
        <MaintenanceDueModal
          system={maintenanceSystem}
          parts={parts}
          onClose={() => setMaintenanceSystem(null)}
          onReset={handleMaintenanceReset}
        />
      ) : null}
    </div>
  )
}
