type PageFeedbackProps = {
  loading?: boolean
  loadingLabel?: string
  error?: string | null
  onRetry?: () => void
}

/** Shared loading / error strip used under page headers. */
export function PageFeedback({
  loading,
  loadingLabel = 'Loading…',
  error,
  onRetry
}: PageFeedbackProps): React.JSX.Element | null {
  if (!loading && !error) return null

  return (
    <div className="page-feedback" role={error ? 'alert' : 'status'}>
      {loading ? <p className="muted">{loadingLabel}</p> : null}
      {error ? (
        <div className="page-feedback-error">
          <p className="form-error">{error}</p>
          {onRetry ? (
            <button type="button" className="btn-ghost btn-sm" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
