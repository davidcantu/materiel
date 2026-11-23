import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ToastContext,
  type ToastAction,
  type ToastApi,
  type ToastOptions,
  type ToastTone
} from './toast-context'

type ToastItem = {
  id: number
  message: string
  tone: ToastTone
  action?: ToastAction
  durationMs: number
}

const AUTO_DISMISS_MS = 4200
const UNDO_DISMISS_MS = 8000

export function ToastProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const push = useCallback((message: string, toneOrOptions?: ToastTone | ToastOptions) => {
    const options: ToastOptions =
      typeof toneOrOptions === 'string' || toneOrOptions == null
        ? { tone: toneOrOptions ?? 'info' }
        : toneOrOptions
    const id = nextId.current++
    const durationMs = options.durationMs ?? (options.action ? UNDO_DISMISS_MS : AUTO_DISMISS_MS)
    setItems((prev) => [
      ...prev.slice(-4),
      {
        id,
        message,
        tone: options.tone ?? 'info',
        action: options.action,
        durationMs
      }
    ])
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      push,
      error: (message) => push(message, 'error'),
      success: (message, options) => push(message, { ...options, tone: 'success' })
    }),
    [push]
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions text">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({
  item,
  onDismiss
}: {
  item: ToastItem
  onDismiss: () => void
}): React.JSX.Element {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, item.durationMs)
    return () => window.clearTimeout(timer)
  }, [onDismiss, item.durationMs])

  return (
    <div className={`toast toast-${item.tone}`} role={item.tone === 'error' ? 'alert' : 'status'}>
      <p>{item.message}</p>
      {item.action ? (
        <button
          type="button"
          className="btn-ghost btn-sm toast-action"
          onClick={() => {
            item.action?.onClick()
            onDismiss()
          }}
        >
          {item.action.label}
        </button>
      ) : null}
      <button
        type="button"
        className="icon-btn toast-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}
