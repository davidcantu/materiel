type EmptyStateProps = {
  title: string
  description?: string
  actionLabel: string
  onAction: () => void
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      <button type="button" className="btn-primary" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  )
}
