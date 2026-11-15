import { useId, useState } from 'react'
import { Modal } from './Modal'

type PreferenceInfoButtonProps = {
  title: string
  children: React.ReactNode
}

/** Small “i” control that opens a short explanation popup for a preference. */
export function PreferenceInfoButton({
  title,
  children
}: PreferenceInfoButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const labelId = useId()

  return (
    <>
      <button
        type="button"
        className="pref-info-btn"
        aria-label={`About ${title}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? labelId : undefined}
        onClick={() => setOpen(true)}
      >
        i
      </button>
      {open ? (
        <Modal title={title} onClose={() => setOpen(false)}>
          <div id={labelId} className="pref-info-body">
            {children}
          </div>
        </Modal>
      ) : null}
    </>
  )
}
