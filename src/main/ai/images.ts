/**
 * Prepare COF images for vision: JPEG/PNG via Electron nativeImage;
 * HEIC/PDF soft-fail per platform constraints.
 */

import { readFileSync } from 'fs'
import { nativeImage } from 'electron'
import { AI_COACH_FEATURE_STATUS } from '../../shared/ai-coach'

export type PreparedImage = {
  mimeType: 'image/jpeg'
  base64: string
  bytes: Buffer
  width: number
  height: number
}

const LONG_EDGE = 1600

export function isHeicMime(mimeType: string, filename?: string | null): boolean {
  const lower = mimeType.toLowerCase()
  const name = (filename ?? '').toLowerCase()
  return (
    lower.includes('heic') ||
    lower.includes('heif') ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  )
}

export function isPdfMime(mimeType: string, filename?: string | null): boolean {
  const lower = mimeType.toLowerCase()
  const name = (filename ?? '').toLowerCase()
  return lower === 'application/pdf' || name.endsWith('.pdf')
}

export function prepareImageForVision(options: {
  absolutePath?: string
  bytes?: Buffer
  mimeType: string
  originalFilename?: string | null
}): PreparedImage {
  if (isHeicMime(options.mimeType, options.originalFilename)) {
    throw new Error(AI_COACH_FEATURE_STATUS.heicUnsupported)
  }
  if (isPdfMime(options.mimeType, options.originalFilename)) {
    throw new Error(AI_COACH_FEATURE_STATUS.pdfSoftFail)
  }

  const input =
    options.bytes ??
    (options.absolutePath ? readFileSync(options.absolutePath) : null)
  if (!input) {
    throw new Error('No image bytes to prepare.')
  }

  let image = nativeImage.createFromBuffer(input)
  if (image.isEmpty()) {
    // Fallback: if nativeImage cannot decode, only allow already-JPEG passthrough.
    if (options.mimeType === 'image/jpeg' || options.mimeType === 'image/jpg') {
      return {
        mimeType: 'image/jpeg',
        base64: input.toString('base64'),
        bytes: input,
        width: 0,
        height: 0
      }
    }
    throw new Error('Could not decode image. Use JPEG or PNG.')
  }

  const size = image.getSize()
  const longEdge = Math.max(size.width, size.height)
  if (longEdge > LONG_EDGE && longEdge > 0) {
    const scale = LONG_EDGE / longEdge
    image = image.resize({
      width: Math.max(1, Math.round(size.width * scale)),
      height: Math.max(1, Math.round(size.height * scale)),
      quality: 'better'
    })
  }

  const jpeg = image.toJPEG(85)
  const outSize = image.getSize()
  return {
    mimeType: 'image/jpeg',
    base64: jpeg.toString('base64'),
    bytes: jpeg,
    width: outSize.width,
    height: outSize.height
  }
}
