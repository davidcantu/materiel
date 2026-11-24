/** App unlock passphrase types (no secrets in renderer). */

export type UnlockStatusInfo = {
  /** Passphrase required before the encrypted DB can open. */
  required: boolean
  /** Session already unlocked (DB open). */
  unlocked: boolean
  /** Minimum passphrase length enforced by Settings. */
  minLength: number
}

export type UnlockAttemptInput = {
  passphrase: string
}

export type UnlockAttemptResult =
  | { ok: true }
  | { ok: false; error: string }

export type UnlockEnableInput = {
  passphrase: string
  confirm: string
}

export type UnlockChangeInput = {
  currentPassphrase: string
  nextPassphrase: string
  confirm: string
}

export type UnlockDisableInput = {
  passphrase: string
}

export const UNLOCK_MIN_LENGTH = 8
