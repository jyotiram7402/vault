'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastTone = 'default' | 'success' | 'danger'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  message: string
  tone?: ToastTone
  /** Milliseconds before it disappears. Defaults to 4000, or 8000 with an action. */
  duration?: number
  action?: ToastAction
}

interface ActiveToast extends ToastOptions {
  id: number
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside <ToastProvider>')
  return value
}

const TONE_CLASSES: Record<ToastTone, string> = {
  default: 'border-line',
  success: 'border-ok/50',
  danger: 'border-danger/50',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ActiveToast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current
      nextId.current += 1
      const duration = options.duration ?? (options.action ? 8000 : 4000)
      setToasts((current) => [...current.slice(-2), { ...options, id }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      )
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={cn(
              'anim-rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-panel border bg-surface px-4 py-3 shadow-overlay',
              TONE_CLASSES[item.tone ?? 'default'],
            )}
          >
            {item.tone === 'success' ? (
              <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ok" />
            ) : null}
            {item.tone === 'danger' ? (
              <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
            ) : null}
            <p className="min-w-0 flex-1 text-sm text-ink">{item.message}</p>
            {item.action ? (
              <button
                type="button"
                onClick={() => {
                  item.action?.onClick()
                  dismiss(item.id)
                }}
                className="shrink-0 text-sm font-semibold text-safe underline underline-offset-2 hover:no-underline"
              >
                {item.action.label}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss"
              className="-my-1 -mr-1 shrink-0 rounded-field p-1 text-ink-muted hover:text-ink"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
