import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PartInfo } from '../../../shared/parts'
import type { CompleteSystemInfo } from '../../../shared/systems'
import type { LicenseGateDenial, LicenseStatusInfo } from '../../../shared/license'
import {
  PLATFORM_CORE_LABELS,
  PLATFORM_LABELS,
  PLATFORMS,
  type Platform
} from '../../../shared/platforms'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/icons/Icon'
import { MaintenanceDueModal } from '../components/MaintenanceDueModal'
import { PageFeedback } from '../components/PageFeedback'
import { PageHeader } from '../components/PageHeader'
import { SystemFormModal } from '../components/SystemFormModal'
import { useToast } from '../components/toast-context'
import { formatCurrency, maintenancePercent, partPrimaryTitle } from '../lib/format'

type BuildsPageProps = {
  trackValue: boolean
  trackedPlatforms?: Platform[]
  license: LicenseStatusInfo | null
  onLicenseChange: () => void
}

export function BuildsPage({
  trackValue,
  trackedPlatforms,
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

  const availablePlatforms = useMemo(
    () =>
      trackedPlatforms && trackedPlatforms.length > 0
        ? PLATFORMS.filter((p) => trackedPlatforms.includes(p))
        : [...PLATFORMS],
    [trackedPlatforms]
  )

  const partsById = useMemo(() => {
    const map = new Map<string, PartInfo>()
    for (const part of parts) map.set(part.id, part)
    return map
  }, [parts])

  const visibleSystems = useMemo(() => {
    const allowed = new Set(availablePlatforms)
    return systems.filter((system) => allowed.has(system.platform))
  }, [systems, availablePlatforms])

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
          <button type="button" className="btn-primary btn-with-icon" onClick={openCreate}>
            <Icon name="add" size={16} />
            New Build
          </button>
        }
      />

      {licenseBanner ? (
        <div className="banner banner-warn" role="alert">
          <strong className="status-inline is-locked">
            <Icon name="licenseLocked" size={16} />
            Firearm limit reached
          </strong>
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

      {!loading && visibleSystems.length === 0 ? (
        <EmptyState
          icon="builds"
          title="No complete firearms yet"
          description="Assemble a custom build from inventory parts, or add a factory firearm."
          actionLabel="Add your first complete build"
          onAction={openCreate}
        />
      ) : null}

      {!loading && visibleSystems.length > 0 ? (
        <div className="build-card-grid">
          {visibleSystems.map((system) => {
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
              <article key={system.id} className="build-card">
                <div
                  className={`build-card-media${system.imageUrl ? '' : ' build-card-media-empty'}`}
                  aria-hidden="true"
                >
                  {system.imageUrl ? (
                    <img
                      src={system.imageUrl}
                      alt=""
                      style={
                        system.imageScale && system.imageScale !== 1
                          ? { transform: `scale(${system.imageScale})` }
                          : undefined
                      }
                    />
                  ) : null}
                </div>

                <div className="build-card-body">
                  <header className="build-card-header">
                    <div>
                      <h3 className="build-card-title">{system.name}</h3>
                      <p className="build-card-sub muted">{caliber ?? 'No cartridge set'}</p>
                    </div>
                    <div className="build-card-badges">
                      <span className="type-pill">{PLATFORM_LABELS[system.platform]}</span>
                      <span className="type-pill">
                        {system.buildType === 'factory' ? 'Factory' : 'Custom'}
                      </span>
                    </div>
                  </header>

                  <dl className="build-card-details">
                    {action ? (
                      <div>
                        <dt>{labels.primary}</dt>
                        <dd>{partPrimaryTitle(action)}</dd>
                      </div>
                    ) : null}
                    {barrel && system.platform !== 'pistol' ? (
                      <div>
                        <dt>{labels.barrel}</dt>
                        <dd>{partPrimaryTitle(barrel)}</dd>
                      </div>
                    ) : null}
                    {chassis && system.platform !== 'pistol' ? (
                      <div>
                        <dt>{labels.furniture}</dt>
                        <dd>{partPrimaryTitle(chassis)}</dd>
                      </div>
                    ) : null}
                    {optic ? (
                      <div>
                        <dt>Optic</dt>
                        <dd>{partPrimaryTitle(optic)}</dd>
                      </div>
                    ) : null}
                    {laser ? (
                      <div>
                        <dt>Laser/IR</dt>
                        <dd>{partPrimaryTitle(laser)}</dd>
                      </div>
                    ) : null}
                    {light ? (
                      <div>
                        <dt>Light</dt>
                        <dd>{partPrimaryTitle(light)}</dd>
                      </div>
                    ) : null}
                    {muzzle ? (
                      <div>
                        <dt>Muzzle</dt>
                        <dd>{partPrimaryTitle(muzzle)}</dd>
                      </div>
                    ) : null}
                    {system.miscPartIds.length > 0 ? (
                      <div>
                        <dt>Accessories</dt>
                        <dd>{system.miscPartIds.length}</dd>
                      </div>
                    ) : null}
                  </dl>

                  <div className="build-card-meta">
                    <span>Barrel rounds: {barrel?.totalRoundCount ?? 0}</span>
                    <span>Maintenance: {maint != null ? `${maint}%` : '—'}</span>
                    {trackValue ? <span>Value: {formatCurrency(totalValue)}</span> : null}
                  </div>

                  <footer className="build-card-actions">
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
                  </footer>
                </div>
              </article>
            )
          })}
        </div>
      ) : null}

      {modalOpen ? (
        <SystemFormModal
          parts={parts}
          trackValue={trackValue}
          allowedPlatforms={availablePlatforms}
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
