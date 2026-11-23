import { createContext, useContext } from 'react'

export type ToastTone = 'error' | 'success' | 'info'

export type ToastAction = {
  label: string
  onClick: () => void
}

export type ToastOptions = {
  tone?: ToastTone
  action?: ToastAction
  durationMs?: number
}

export type ToastApi = {
  push: (message: string, toneOrOptions?: ToastTone | ToastOptions) => void
  error: (message: string) => void
  success: (message: string, options?: Omit<ToastOptions, 'tone'>) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}
