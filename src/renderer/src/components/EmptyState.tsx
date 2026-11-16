import { Icon, type IconName } from './icons/Icon'

type EmptyStateProps = {
  title: string
  description?: string
  actionLabel: string
  onAction: () => void
  icon?: IconName
  actionIcon?: IconName
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = 'inventory',
  actionIcon = 'add'
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        <Icon name={icon} size={28} />
      </div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      <button type="button" className="btn-primary btn-with-icon" onClick={onAction}>
        <Icon name={actionIcon} size={16} />
        {actionLabel}
      </button>
    </div>
  )
}
