/**
 * Tracks open modal depth so only the topmost dialog handles Escape.
 */

let depth = 0

export function pushModalLayer(): number {
  depth += 1
  return depth
}

export function popModalLayer(layer: number): void {
  if (depth === layer) depth -= 1
  else if (depth > 0) depth -= 1
}

export function isTopModalLayer(layer: number): boolean {
  return layer === depth
}
