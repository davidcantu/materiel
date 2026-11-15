import { useEffect, useId, useMemo, useRef, useState } from 'react'

export type TypeaheadOption = {
  id: string
  label: string
  /** Extra text matched while typing (e.g. serial, id). */
  keywords?: string
}

type TypeaheadSelectProps = {
  label: string
  value: string
  options: TypeaheadOption[]
  onChange: (id: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  allowEmpty?: boolean
  emptyLabel?: string
  /** Shown under the field; opens an inline create flow. */
  createLabel?: string
  onCreate?: () => void
  className?: string
}

function matchesQuery(option: TypeaheadOption, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = `${option.label} ${option.keywords ?? ''} ${option.id}`.toLowerCase()
  return hay.includes(q)
}

export function TypeaheadSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Type to search…',
  required,
  disabled,
  allowEmpty,
  emptyLabel = '— None —',
  createLabel,
  onCreate,
  className
}: TypeaheadSelectProps): React.JSX.Element {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = options.find((option) => option.id === value) ?? null
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)

  const filtered = useMemo(() => {
    const base = options.filter((option) => matchesQuery(option, query))
    if (allowEmpty && matchesQuery({ id: '', label: emptyLabel }, query)) {
      return [{ id: '', label: emptyLabel }, ...base]
    }
    return base
  }, [options, query, allowEmpty, emptyLabel])

  useEffect(() => {
    function onPointerDown(event: MouseEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  function close(): void {
    setOpen(false)
    setQuery('')
    setHighlight(0)
  }

  function openList(): void {
    setOpen(true)
    setHighlight(0)
  }

  function commit(id: string): void {
    onChange(id)
    close()
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (disabled) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) openList()
      else setHighlight((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (!open) {
        openList()
        return
      }
      const choice = filtered[highlight]
      if (choice) commit(choice.id)
      return
    }
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault()
        event.stopPropagation()
        close()
      }
    }
  }

  const display = open ? query : (selected?.label ?? '')

  return (
    <div className={`field typeahead${className ? ` ${className}` : ''}`} ref={rootRef}>
      <span className="field-label">{label}</span>
      <div className="typeahead-control">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-required={required || undefined}
          disabled={disabled}
          value={display}
          placeholder={selected ? selected.label : placeholder}
          onChange={(event) => {
            setQuery(event.target.value)
            setHighlight(0)
            setOpen(true)
          }}
          onFocus={() => {
            if (!disabled) openList()
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
        <button
          type="button"
          className="typeahead-toggle"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Toggle options"
          onClick={() => {
            if (disabled) return
            if (open) close()
            else {
              openList()
              inputRef.current?.focus()
            }
          }}
        >
          ▾
        </button>
      </div>

      {open ? (
        <ul id={listId} className="typeahead-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="typeahead-empty muted" role="presentation">
              No matches
            </li>
          ) : (
            filtered.map((option, index) => (
              <li key={option.id || '__empty__'} role="option" aria-selected={option.id === value}>
                <button
                  type="button"
                  className={`typeahead-option${index === highlight ? ' is-active' : ''}${
                    option.id === value ? ' is-selected' : ''
                  }`}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => commit(option.id)}
                >
                  {option.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {createLabel && onCreate ? (
        <button
          type="button"
          className="btn-link typeahead-create"
          onClick={onCreate}
          disabled={disabled}
        >
          {createLabel}
        </button>
      ) : null}

      {required && !value ? (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value=""
          onChange={() => undefined}
          className="typeahead-required-mirror"
        />
      ) : null}
    </div>
  )
}
