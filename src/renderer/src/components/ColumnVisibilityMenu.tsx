import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './icons/Icon'

export type ColumnOption<T extends string> = {
  id: T
  label: string
}

type ColumnVisibilityMenuProps<T extends string> = {
  label: string
  options: readonly ColumnOption<T>[]
  visible: readonly T[]
  onChange: (next: T[]) => void
  onReset: () => void
}

export function ColumnVisibilityMenu<T extends string>({
  label,
  options,
  visible,
  onChange,
  onReset
}: ColumnVisibilityMenuProps<T>): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const visibleSet = new Set(visible)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="column-visibility type-chip-more" ref={rootRef}>
      <button
        type="button"
        className={`chip btn-with-icon${open ? ' active' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="filter" size={14} />
        {label}
      </button>
      {open ? (
        <div className="type-chip-menu column-visibility-menu" role="menu" id={menuId}>
          <p className="column-visibility-hint muted">Show columns</p>
          {options.map((option) => {
            const checked = visibleSet.has(option.id)
            return (
              <label key={option.id} className="column-visibility-option" role="menuitemcheckbox">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={checked && visible.length <= 1}
                  onChange={() => {
                    const set = new Set(visible)
                    if (set.has(option.id)) {
                      if (set.size <= 1) return
                      set.delete(option.id)
                    } else {
                      set.add(option.id)
                    }
                    onChange(options.map((row) => row.id).filter((id) => set.has(id)))
                  }}
                />
                <span>{option.label}</span>
              </label>
            )
          })}
          <button
            type="button"
            className="btn-ghost btn-sm column-visibility-reset"
            onClick={() => {
              onReset()
              setOpen(false)
            }}
          >
            Reset columns
          </button>
        </div>
      ) : null}
    </div>
  )
}
