/** Shared image resize / crop constants (software-spec §9.2). */

export const IMAGE_MAX_WIDTH = 1200
export const IMAGE_JPEG_QUALITY = 0.7

/** Landscape frame for build photos (matches ~256px header height at 16:9). */
export const BUILD_IMAGE_ASPECT = 16 / 9

/** Square profile avatar output size (px). */
export const PROFILE_IMAGE_SIZE = 512

export type ImageSize = { width: number; height: number }

/** Downscale so width ≤ maxWidth, preserving aspect ratio. */
export function computeResizeDimensions(
  width: number,
  height: number,
  maxWidth: number = IMAGE_MAX_WIDTH
): ImageSize {
  if (width <= 0 || height <= 0) {
    return { width: Math.max(1, width), height: Math.max(1, height) }
  }
  if (width <= maxWidth) {
    return { width, height }
  }
  const scale = maxWidth / width
  return {
    width: maxWidth,
    height: Math.max(1, Math.round(height * scale))
  }
}

/** Clamp zoom used in build/profile crop editors. */
export function clampImageScale(scale: number, min = 1, max = 3): number {
  if (!Number.isFinite(scale)) return 1
  return Math.min(max, Math.max(min, scale))
}
