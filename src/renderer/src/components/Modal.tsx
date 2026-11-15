import { useEffect, useId, useRef, type ReactNode } from 'react'
import { isTopModalLayer, popModalLayer, pushModalLayer } from '../lib/modal-stack'

type ModalProps = {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ title, onClose, children, footer, wide }: ModalProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const layerRef = useRef(0)
  const titleId = useId()

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    if (!dialog) return

    layerRef.current = pushModalLayer()

    const focusables = (): HTMLElement[] =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
      )

    const initial = focusables().find((el) => {
      if (!(el instanceof HTMLButtonElement)) return true
      return el.type === 'submit'
    })
    ;(initial ?? focusables()[0] ?? dialog).focus()

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        if (!isTopModalLayer(layerRef.current)) return
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      if (!isTopModalLayer(layerRef.current)) return

      const nodes = focusables()
      if (nodes.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      popModalLayer(layerRef.current)
      previouslyFocused.current?.focus?.()
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className={`modal${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </div>
    </div>
  )
}
