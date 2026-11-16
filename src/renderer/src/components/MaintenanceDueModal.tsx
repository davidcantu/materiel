import type { PartInfo } from '../../../shared/parts'
import type { CompleteSystemInfo } from '../../../shared/systems'
import { listSystemMaintenance } from '../../../shared/system-maintenance'
import { Icon } from './icons/Icon'
import { Modal } from './Modal'

type MaintenanceDueModalProps = {
  system: CompleteSystemInfo
  parts: PartInfo[]
  /** When true, opened automatically after a session log. */
  afterLog?: boolean
  onClose: () => void
  onReset: (partId: string) => Promise<void>
}

export function MaintenanceDueModal({
  system,
  parts,
  afterLog = false,
  onClose,
  onReset
}: MaintenanceDueModalProps): React.JSX.Element {
  const partsById = new Map(parts.map((part) => [part.id, part]))
  const items = listSystemMaintenance(system, partsById)
  const due = items.filter((item) => item.percent >= 61)

  return (
    <Modal
      title={`Maintenance · ${system.name}`}
      onClose={onClose}
      footer={
        <button type="button" className="btn-primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="maint-due">
        {afterLog ? (
          <p className="muted">
            Rounds logged on this firearm. Due items use each part’s known cleaning interval — no
            system picker needed.
          </p>
        ) : (
          <p className="muted">
            Parts on this firearm with known maintenance intervals. Reset clears rounds since last
            cleaning.
          </p>
        )}

        {items.length === 0 ? (
          <p className="muted">No maintenance-tracked parts with intervals on this firearm.</p>
        ) : (
          <ul className="alert-list">
            {items.map((item) => (
              <li key={item.partId} className="alert-row">
                <div className="alert-row-top">
                  <div>
                    <div className="cell-title">{item.title}</div>
                    <div className="muted status-inline">
                      {item.percent >= 61 ? (
                        <Icon name="maintenanceDue" size={14} title="Maintenance due" />
                      ) : (
                        <Icon name="maintenance" size={14} />
                      )}
                      {item.kind} · {item.roundsAfterCleaning}/{item.interval} rounds
                      {item.percent >= 61 ? ' · due' : ''}
                    </div>
                  </div>
                  <span className={`alert-pct${item.percent > 90 ? ' alert-pct-high' : ''}`}>
                    {item.percent}%
                  </span>
                </div>
                <div className={`progress-track tone-${item.tone}`}>
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(item.percent, 100)}%` }}
                  />
                </div>
                <div className="row-actions" style={{ marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => void onReset(item.partId)}
                  >
                    Reset maintenance
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {afterLog && due.length === 0 && items.length > 0 ? (
          <p className="muted">Nothing overdue yet — all tracked parts are under 61%.</p>
        ) : null}
      </div>
    </Modal>
  )
}
