/**
 * Browser canvas helpers: resize/compress uploads and bake crop frames.
 * Persisted as JPEG data URIs in the encrypted SQLite TEXT columns.
 */

import {
  BUILD_IMAGE_ASPECT,
  IMAGE_JPEG_QUALITY,
  IMAGE_MAX_WIDTH,
  PROFILE_IMAGE_SIZE,
  clampImageScale,
  computeResizeDimensions
} from '../../../shared/image'

export type CropTransform = {
  /** Zoom factor ≥ 1. */
  scale: number
  /** Pan offset in CSS pixels relative to the preview frame center. */
  offsetX: number
  offsetY: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = src
  })
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Could not read image file'))
    }
    reader.onerror = () => reject(new Error('Could not read image file'))
    reader.readAsDataURL(file)
  })
}

/** Resize to max width and compress to JPEG data URI (spec: 1200px / 0.7). */
export async function resizeImageFile(
  file: File,
  options?: { maxWidth?: number; quality?: number }
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file')
  }
  const maxWidth = options?.maxWidth ?? IMAGE_MAX_WIDTH
  const quality = options?.quality ?? IMAGE_JPEG_QUALITY
  const raw = await readFileAsDataUrl(file)
  const img = await loadImage(raw)
  const { width, height } = computeResizeDimensions(img.naturalWidth, img.naturalHeight, maxWidth)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}

/**
 * Cover-fit draw: scale image to fill (outW × outH), apply user zoom + pan, JPEG out.
 * `frameW`/`frameH` are the on-screen preview dimensions used when measuring offsets.
 */
export async function renderCoverCrop(
  sourceDataUrl: string,
  outW: number,
  outH: number,
  transform: CropTransform,
  frameW: number,
  frameH: number,
  quality: number = IMAGE_JPEG_QUALITY
): Promise<string> {
  const img = await loadImage(sourceDataUrl)
  const scale = clampImageScale(transform.scale)
  const cover = Math.max(outW / img.naturalWidth, outH / img.naturalHeight) * scale
  const drawW = img.naturalWidth * cover
  const drawH = img.naturalHeight * cover

  // Map preview-pixel offsets into output-pixel space.
  const sx = frameW > 0 ? outW / frameW : 1
  const sy = frameH > 0 ? outH / frameH : 1
  const dx = transform.offsetX * sx
  const dy = transform.offsetY * sy

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.fillStyle = '#1a1f1c'
  ctx.fillRect(0, 0, outW, outH)
  ctx.drawImage(img, (outW - drawW) / 2 + dx, (outH - drawH) / 2 + dy, drawW, drawH)
  return canvas.toDataURL('image/jpeg', quality)
}

/** Landscape build photo: bake zoom/pan into a 1200×675 JPEG. */
export async function bakeBuildImage(
  sourceDataUrl: string,
  transform: CropTransform,
  frameW: number,
  frameH: number
): Promise<{ imageUrl: string; imageScale: number }> {
  const outW = IMAGE_MAX_WIDTH
  const outH = Math.round(outW / BUILD_IMAGE_ASPECT)
  const imageUrl = await renderCoverCrop(sourceDataUrl, outW, outH, transform, frameW, frameH)
  return { imageUrl, imageScale: clampImageScale(transform.scale) }
}

/** Square profile avatar: bake zoom/pan into PROFILE_IMAGE_SIZE JPEG. */
export async function bakeProfileImage(
  sourceDataUrl: string,
  transform: CropTransform,
  frameW: number,
  frameH: number
): Promise<string> {
  return renderCoverCrop(
    sourceDataUrl,
    PROFILE_IMAGE_SIZE,
    PROFILE_IMAGE_SIZE,
    transform,
    frameW,
    frameH
  )
}
