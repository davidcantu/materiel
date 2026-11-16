import { useId, useRef, useState } from 'react'
import { BUILD_IMAGE_ASPECT, clampImageScale } from '../../../shared/image'
import {
  bakeBuildImage,
  bakeProfileImage,
  resizeImageFile,
  type CropTransform
} from '../lib/resize-image'
import { Icon } from './icons/Icon'

export type ImageCropValue = {
  /** Final compressed JPEG data URI (or null if cleared). */
  imageUrl: string | null
  /** Last zoom used when baking a build photo (profile ignores). */
  imageScale: number
}

type ImageCropFieldProps = {
  label: string
  variant: 'build' | 'profile'
  value: ImageCropValue
  onChange: (next: ImageCropValue) => void
  disabled?: boolean
}

const DEFAULT_TRANSFORM: CropTransform = { scale: 1, offsetX: 0, offsetY: 0 }

export function ImageCropField({
  label,
  variant,
  value,
  onChange,
  disabled
}: ImageCropFieldProps): React.JSX.Element {
  const inputId = useId()
  const frameRef = useRef<HTMLDivElement>(null)
  const [draftSrc, setDraftSrc] = useState<string | null>(null)
  const [transform, setTransform] = useState<CropTransform>(DEFAULT_TRANSFORM)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  const editing = Boolean(draftSrc)
  const previewSrc = draftSrc ?? value.imageUrl

  async function handleFile(file: File | null): Promise<void> {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const resized = await resizeImageFile(file)
      setDraftSrc(resized)
      setTransform({
        scale: variant === 'build' ? clampImageScale(value.imageScale || 1) : 1,
        offsetX: 0,
        offsetY: 0
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process image')
    } finally {
      setBusy(false)
    }
  }

  async function applyCrop(): Promise<void> {
    if (!draftSrc || !frameRef.current) return
    setBusy(true)
    setError(null)
    try {
      const { width, height } = frameRef.current.getBoundingClientRect()
      if (variant === 'build') {
        const baked = await bakeBuildImage(draftSrc, transform, width, height)
        onChange(baked)
      } else {
        const imageUrl = await bakeProfileImage(draftSrc, transform, width, height)
        onChange({ imageUrl, imageScale: 1 })
      }
      setDraftSrc(null)
      setTransform(DEFAULT_TRANSFORM)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save crop')
    } finally {
      setBusy(false)
    }
  }

  function cancelCrop(): void {
    setDraftSrc(null)
    setTransform(DEFAULT_TRANSFORM)
    setError(null)
  }

  function clearImage(): void {
    setDraftSrc(null)
    setTransform(DEFAULT_TRANSFORM)
    setError(null)
    onChange({ imageUrl: null, imageScale: 1 })
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if (!editing || disabled || busy) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: transform.offsetX,
      originY: transform.offsetY
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setTransform((prev) => ({
      ...prev,
      offsetX: drag.originX + (event.clientX - drag.startX),
      offsetY: drag.originY + (event.clientY - drag.startY)
    }))
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
    }
  }

  const frameClass =
    variant === 'build'
      ? 'image-crop-frame image-crop-frame-build'
      : 'image-crop-frame image-crop-frame-profile'

  return (
    <div className={`image-crop-field${variant === 'profile' ? ' image-crop-field-profile' : ''}`}>
      <div className="field-row-header">
        <span className="field-label" id={`${inputId}-label`}>
          {label}
        </span>
        <div className="row-actions">
          {value.imageUrl && !draftSrc ? (
            <button
              type="button"
              className="btn-link"
              disabled={disabled || busy}
              onClick={() => {
                setDraftSrc(value.imageUrl)
                setTransform({
                  scale: clampImageScale(value.imageScale || 1),
                  offsetX: 0,
                  offsetY: 0
                })
                setError(null)
              }}
            >
              Adjust
            </button>
          ) : null}
          {value.imageUrl || draftSrc ? (
            <button
              type="button"
              className="btn-link"
              disabled={disabled || busy}
              onClick={clearImage}
            >
              Remove
            </button>
          ) : null}
          <label className="btn-link btn-with-icon" htmlFor={inputId}>
            <Icon name="upload" size={14} />
            {previewSrc ? 'Replace photo' : 'Upload photo'}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={disabled || busy}
            aria-labelledby={`${inputId}-label`}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null
              e.target.value = ''
              void handleFile(file)
            }}
          />
        </div>
      </div>

      <div
        ref={frameRef}
        className={`${frameClass}${editing ? ' is-editing' : ''}${previewSrc ? '' : ' is-empty'}`}
        style={variant === 'build' ? { aspectRatio: String(BUILD_IMAGE_ASPECT) } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label={previewSrc ? `${label} preview` : `${label} placeholder`}
      >
        {previewSrc ? (
          <img
            src={previewSrc}
            alt=""
            draggable={false}
            className="image-crop-img"
            style={
              editing
                ? {
                    transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`
                  }
                : undefined
            }
          />
        ) : (
          <span className="image-crop-placeholder">
            {variant === 'build' ? 'Landscape build photo' : 'Profile photo'}
          </span>
        )}
        {editing ? (
          <span className="image-crop-hint">Drag to position · use slider to zoom</span>
        ) : null}
      </div>

      {editing ? (
        <div className="image-crop-controls">
          <label className="image-crop-zoom">
            <span className="field-label">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={transform.scale}
              disabled={disabled || busy}
              onChange={(e) =>
                setTransform((prev) => ({
                  ...prev,
                  scale: clampImageScale(Number(e.target.value))
                }))
              }
            />
            <span className="muted">{transform.scale.toFixed(2)}×</span>
          </label>
          <div className="row-actions">
            <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={cancelCrop}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={busy}
              onClick={() => void applyCrop()}
            >
              {busy ? 'Saving…' : 'Apply crop'}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      {!editing && variant === 'build' ? (
        <p className="muted field-hint">
          Photos are resized to 1200px wide and stored in the encrypted local database. Zoom and
          position before applying the crop.
        </p>
      ) : null}
    </div>
  )
}
